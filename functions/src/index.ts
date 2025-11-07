import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

// Firebase Admin SDK 初期化
admin.initializeApp();

// シークレットの定義
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');
const sendgridFromEmail = defineSecret('SENDGRID_FROM_EMAIL');

type RoomContext = {
  roomId?: string;
  roomDocId?: string;
};

/**
 * 🔹 現在のルーム限定で期限が近いタスクを取得（修正版）
 */
async function getUpcomingTasks(
  room?: RoomContext,
  daysBeforeList: number[] = [1, 3, 7]
): Promise<any[]> {
  try {
    const db = admin.firestore();
    const today = new Date();
    const allTasks: any[] = [];

    if (!room?.roomId) {
      console.warn('⚠️ ルーム情報が未指定のため処理を中断します');
      return [];
    }

    const projectsSnapshot = await db
      .collection('projects')
      .where('roomId', '==', room.roomId)
      .get();

    console.log(
      `🎯 対象ルーム(${room.roomId})のプロジェクト数: ${projectsSnapshot.docs.length}`
    );

    // JST（Asia/Tokyo）で今日の日付を取得
    const jstToday = new Date(
      today.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
    );
    jstToday.setHours(0, 0, 0, 0);

    for (const daysBefore of daysBeforeList) {
      // JSTで日付を計算
      const targetDate = new Date(jstToday);
      targetDate.setDate(jstToday.getDate() + daysBefore);

      // ローカルタイムゾーンで日付文字列を生成（YYYY-MM-DD形式）
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');
      const targetDateStr = `${year}-${month}-${day}`;

      console.log(
        `🔎 ${daysBefore}日前に期限を迎えるタスクを検索中 (${targetDateStr})`
      );

      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        const projectData = projectDoc.data();

        const tasksSnapshot = await db
          .collection(`projects/${projectId}/tasks`)
          .where('roomId', '==', room.roomId)
          .where('dueDate', '==', targetDateStr)
          .where('status', 'in', ['未着手', '作業中'])
          .get();

        for (const taskDoc of tasksSnapshot.docs) {
          const taskData = taskDoc.data();
          allTasks.push({
            id: taskDoc.id,
            projectId,
            projectName: projectData.projectName || 'プロジェクト',
            ...taskData,
            daysBefore,
          });
        }
      }

      const standaloneTasksSnapshot = await db
        .collection('tasks')
        .where('roomId', '==', room.roomId)
        .where('dueDate', '==', targetDateStr)
        .where('status', 'in', ['未着手', '作業中'])
        .get();

      for (const taskDoc of standaloneTasksSnapshot.docs) {
        const taskData = taskDoc.data();
        allTasks.push({
          id: taskDoc.id,
          projectId: taskData.projectId || '',
          projectName: taskData.projectName || 'タスク',
          ...taskData,
          daysBefore,
        });
      }
    }

    allTasks.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
    console.log(`📬 抽出されたタスク数: ${allTasks.length}`);
    return allTasks;
  } catch (error) {
    console.error('❌ getUpcomingTasks エラー:', error);
    return [];
  }
}

/**
 * ユーザーごとにタスクをグループ化（メールアドレスをメンバーコレクションから取得）
 */
async function groupTasksByUser(
  tasks: any[],
  roomId: string
): Promise<{ [email: string]: any[] }> {
  const db = admin.firestore();
  const grouped: { [email: string]: any[] } = {};

  // メンバーコレクションからメールアドレスを取得
  const membersSnapshot = await db
    .collection('members')
    .where('roomId', '==', roomId)
    .get();

  const memberEmailMap = new Map<string, string>(); // name -> email
  membersSnapshot.forEach((doc) => {
    const memberData = doc.data();
    if (memberData.name && memberData.email) {
      memberEmailMap.set(memberData.name, memberData.email);
    }
  });

  tasks.forEach((task) => {
    const emails: string[] = [];

    // 1. assigneeEmail が直接設定されている場合
    if (task.assigneeEmail) {
      emails.push(task.assigneeEmail);
    }
    // 2. assignedMembers が配列の場合（UID配列）
    if (
      Array.isArray(task.assignedMembers) &&
      task.assignedMembers.length > 0
    ) {
      // UIDからメールアドレスを取得（membersコレクションでIDとemailを照合）
      const memberIds = task.assignedMembers;
      membersSnapshot.forEach((doc) => {
        if (memberIds.includes(doc.id) && doc.data().email) {
          const email = doc.data().email;
          if (!emails.includes(email)) {
            emails.push(email);
          }
        }
      });
    }
    // 3. assignee が名前の場合、メンバーコレクションからメールアドレスを取得
    if (task.assignee && emails.length === 0) {
      const assigneeNames = task.assignee
        .split(',')
        .map((n: string) => n.trim());
      for (const name of assigneeNames) {
        const memberEmail = memberEmailMap.get(name);
        if (memberEmail && !emails.includes(memberEmail)) {
          emails.push(memberEmail);
        }
      }
    }

    if (emails.length === 0) {
      console.warn('⚠️ メールアドレスが見つからないタスク:', {
        taskName: task.taskName,
        assignee: task.assignee,
        assigneeEmail: task.assigneeEmail,
        assignedMembers: task.assignedMembers,
      });
      return;
    }

    // 各メールアドレスにタスクを追加
    emails.forEach((email) => {
      if (!grouped[email]) grouped[email] = [];
      grouped[email].push(task);
    });
  });

  return grouped;
}

/**
 * タスクリマインダーメールのHTML生成
 */
function generateTaskReminderHTML(tasks: any[]): string {
  const taskList = tasks
    .map(
      (task, index) => `
      <div style="background-color:#f8f9fa;padding:15px;margin:10px 0;
        border-radius:8px;border-left:4px solid #1976d2;">
        <h3 style="margin:0 0 10px;">${index + 1}. ${task.taskName}</h3>
        <p>プロジェクト: ${task.projectName}</p>
        <p>期限: ${task.dueDate}</p>
        <p>ステータス: ${task.status}</p>
      </div>`
    )
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1976d2;">📋 タスク期限通知</h2>
      <p>以下のタスクの期限が近づいています。</p>
      ${taskList}
      <p style="color:#999;font-size:12px;">
        このメールはタスク管理アプリから自動送信されました。
      </p>
    </div>`;
}

/**
 * 🔹 手動で期限が近いタスクのメール通知を送信（安全チェック付き修正版）
 */
export const sendTaskRemindersManual = onCall(
  { secrets: [sendgridApiKey, sendgridFromEmail], cors: true },
  async (request) => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', '認証が必要です');

    const roomId = request.data?.roomId;
    const roomDocId = request.data?.roomDocId;
    if (!roomId || !roomDocId)
      throw new HttpsError('invalid-argument', 'roomIdとroomDocIdが必要です');

    const roomContext: RoomContext = { roomId, roomDocId };
    const apiKey = sendgridApiKey
      .value()
      .trim()
      .replace(/[\r\n\t\s]+/g, '');
    sgMail.setApiKey(apiKey);

    const upcomingTasks = await getUpcomingTasks(roomContext);

    if (upcomingTasks.length === 0)
      return {
        success: true,
        message: '期限が近いタスクはありません',
        taskCount: 0,
        userCount: 0,
      };

    const tasksByUser = await groupTasksByUser(upcomingTasks, roomId);
    const fromEmail = sendgridFromEmail.value() || 'noreply@taskmanager.com';

    const sendPromises = Object.entries(tasksByUser).map(
      async ([email, userTasks]) => {
        if (!email) {
          console.warn(
            '⚠️ 宛先メールアドレスが未設定のタスクがあります:',
            userTasks
          );
          return;
        }

        try {
          const msg = {
            to: email,
            from: fromEmail,
            subject: `【期限間近】${userTasks.length}件のタスクが期限間近です`,
            html: generateTaskReminderHTML(userTasks),
          };
          await sgMail.send(msg);
          console.log(`✅ メール送信成功: ${email}`);
        } catch (error: any) {
          console.error(
            `❌ SendGrid送信エラー(${email}):`,
            error.response?.body || error
          );
        }
      }
    );

    await Promise.all(sendPromises);
    return {
      success: true,
      message: '期限が近いタスク通知を送信しました',
      taskCount: upcomingTasks.length,
      userCount: Object.keys(tasksByUser).length,
    };
  }
);

/**
 * テスト通知関数（そのまま）
 */
export const sendTestEmail = onCall(
  { secrets: [sendgridApiKey, sendgridFromEmail], cors: true },
  async (request) => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', '認証が必要です');

    const apiKey = sendgridApiKey
      .value()
      .trim()
      .replace(/[\r\n\t\s]+/g, '');
    sgMail.setApiKey(apiKey);
    const email = request.data?.email;
    const fromEmail = sendgridFromEmail.value() || 'noreply@taskmanager.com';

    const msg = {
      to: email,
      from: fromEmail,
      subject: '【テスト通知】タスク管理アプリ',
      html: `<div>このメールはテスト通知です。</div>`,
    };

    await sgMail.send(msg);
    return { success: true, message: 'テスト通知を送信しました' };
  }
);

/**
 * 自動スケジュール関数（既存維持）
 */
export const sendDailyTaskReminders = onSchedule(
  {
    schedule: '0 10 * * *',
    timeZone: 'Asia/Tokyo',
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async () => {
    console.log('🕙 自動タスク通知実行開始');
  }
);

/**
 * 🔹 タスク期限通知をスケジュール実行（毎分チェック）
 */
export const sendTaskDeadlineNotifications = onSchedule(
  {
    schedule: '* * * * *', // 毎分実行
    timeZone: 'Asia/Tokyo',
    memory: '512MiB',
    timeoutSeconds: 540, // 9分（複数ユーザー処理のため）
    secrets: [sendgridApiKey, sendgridFromEmail],
  },
  async () => {
    console.log('🕙 タスク期限通知スケジュール実行開始');
    const db = admin.firestore();
    const apiKey = sendgridApiKey
      .value()
      .trim()
      .replace(/[\r\n\t\s]+/g, '');
    sgMail.setApiKey(apiKey);
    const fromEmail = sendgridFromEmail.value() || 'noreply@taskmanager.com';

    // JST（Asia/Tokyo）で現在時刻を取得
    const now = new Date();
    const jstNow = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
    );
    const currentTime = `${jstNow
      .getHours()
      .toString()
      .padStart(2, '0')}:${jstNow.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = jstNow.getDay(); // 曜日を取得（0=日曜日, 6=土曜日）

    console.log(`⏰ JST現在時刻: ${currentTime} (UTC: ${now.toISOString()})`);

    try {
      // 全通知設定を取得
      const settingsSnapshot = await db
        .collection('notificationSettings')
        .where('taskDeadlineNotifications.enabled', '==', true)
        .get();

      console.log(
        `📋 通知設定が有効なユーザー数: ${settingsSnapshot.docs.length}`
      );

      for (const settingsDoc of settingsSnapshot.docs) {
        const settings = settingsDoc.data();
        const userId = settings.userId;
        const roomId = settings.roomId;
        const roomDocId = settings.roomDocId;

        if (!roomId || !roomDocId) {
          console.warn(`⚠️ ルーム情報が未設定: userId=${userId}`);
          continue;
        }

        // 通知時間が現在時刻と一致するかチェック
        const notificationTime = settings.taskDeadlineNotifications?.timeOfDay;
        console.log(
          `🔍 ユーザー ${userId}: 設定時刻=${notificationTime}, 現在時刻=${currentTime}`
        );
        if (notificationTime !== currentTime) {
          continue;
        }

        console.log(`✅ 通知時刻一致！ユーザー ${userId} の通知を処理開始`);

        // 通知オフ期間をチェック
        if (settings.quietHours?.enabled) {
          if (
            settings.quietHours.weekends &&
            (currentDay === 0 || currentDay === 6)
          ) {
            continue;
          }

          const startTime = settings.quietHours.startTime;
          const endTime = settings.quietHours.endTime;
          if (startTime && endTime) {
            if (startTime <= endTime) {
              if (currentTime >= startTime && currentTime <= endTime) {
                continue;
              }
            } else {
              if (currentTime >= startTime || currentTime <= endTime) {
                continue;
              }
            }
          }
        }

        // メール通知が有効かチェック
        if (!settings.notificationChannels?.email?.enabled) {
          continue;
        }

        const emailAddress = settings.notificationChannels.email.address;
        if (!emailAddress) {
          console.warn(`⚠️ メールアドレスが未設定: userId=${userId}`);
          continue;
        }

        // ユーザーのメールアドレスを取得
        const userEmail = settings.notificationChannels.email.address;

        // ルーム内のメンバー情報を取得（ユーザー名とメールアドレスのマッピング用）
        const membersSnapshot = await db
          .collection('members')
          .where('roomId', '==', roomId)
          .get();

        const memberEmailMap = new Map<string, string>(); // name -> email
        const memberIdMap = new Map<string, string>(); // email -> memberId
        membersSnapshot.forEach((doc) => {
          const memberData = doc.data();
          if (memberData.name && memberData.email) {
            memberEmailMap.set(memberData.name, memberData.email);
            memberIdMap.set(memberData.email, doc.id);
          }
        });

        // ユーザーのメンバーIDを取得（assignedMembersで使用）
        const userMemberId = memberIdMap.get(userEmail);

        // ルーム内のタスクを取得
        const roomContext: RoomContext = { roomId, roomDocId };
        const daysBeforeList = settings.taskDeadlineNotifications
          ?.daysBeforeDeadline || [1, 3, 7];
        const allTasks = await getUpcomingTasks(roomContext, daysBeforeList);

        // JST（Asia/Tokyo）で今日の日付を取得
        const now = new Date();
        const jstToday = new Date(
          now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
        );
        jstToday.setHours(0, 0, 0, 0);

        // 通知タイミングに一致するタスクだけをフィルタリング
        const tasksMatchingTiming = allTasks.filter((task) => {
          if (!task.dueDate) {
            return false;
          }

          // 期日をローカルタイムゾーンでDateオブジェクトに変換
          let dueDate: Date;
          if (typeof task.dueDate === 'string') {
            // 文字列形式（YYYY-MM-DD）の場合、ローカルタイムゾーンで日付を作成
            const [year, month, day] = task.dueDate
              .split('T')[0]
              .split('-')
              .map(Number);
            dueDate = new Date(year, month - 1, day);
          } else {
            dueDate = new Date(task.dueDate);
          }
          dueDate.setHours(0, 0, 0, 0);

          // 期日までの日数を計算（ミリ秒→日数）
          const diffTime = dueDate.getTime() - jstToday.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // 設定された通知タイミングに含まれるかチェック
          return daysBeforeList.includes(diffDays);
        });

        // ユーザーが担当者に含まれるタスクを抽出
        const userTasks = tasksMatchingTiming.filter((task) => {
          // 詳細設定のタスク期限ボタンがONになっているかチェック
          const detailSettings = task.detailSettings;
          if (detailSettings?.notifications?.beforeDeadline === false) {
            return false;
          }
          // beforeDeadlineがundefinedの場合はデフォルトでONとみなす

          // ユーザーが担当者に含まれるかチェック
          const assigneeEmail = task.assigneeEmail;
          const assignee = task.assignee;
          const assignedMembers = task.assignedMembers || [];

          // メールアドレスで一致
          if (assigneeEmail === userEmail) {
            return true;
          }

          // assignedMembersにuserMemberIdが含まれる
          if (userMemberId && assignedMembers.includes(userMemberId)) {
            return true;
          }

          // assigneeが名前の場合、メールアドレスで確認
          if (assignee) {
            const assigneeNames = assignee
              .split(',')
              .map((n: string) => n.trim());
            for (const name of assigneeNames) {
              const memberEmail = memberEmailMap.get(name);
              if (memberEmail === userEmail) {
                return true;
              }
            }
          }

          return false;
        });

        if (userTasks.length === 0) {
          console.log(`📭 通知対象タスクなし: userId=${userId}`);
          continue;
        }

        // メール送信
        try {
          const msg = {
            to: emailAddress,
            from: fromEmail,
            subject: `【タスク期限通知】${userTasks.length}件のタスクが期限間近です`,
            html: generateTaskReminderHTML(userTasks),
          };
          await sgMail.send(msg);
          console.log(
            `✅ タスク期限通知メール送信成功: ${emailAddress} (${userTasks.length}件)`
          );
        } catch (error: any) {
          console.error(
            `❌ SendGrid送信エラー(${emailAddress}):`,
            error.response?.body || error
          );
        }
      }

      console.log('✅ タスク期限通知スケジュール実行完了');
    } catch (error) {
      console.error('❌ タスク期限通知スケジュール実行エラー:', error);
    }
  }
);

export const sendUserTaskNotifications = onSchedule(
  {
    schedule: '* * * * *',
    timeZone: 'Asia/Tokyo',
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async () => {
    console.log('🕙 ユーザー個別通知実行');
  }
);

/**
 * 🔹 タスク期限通知を手動実行（デバッグ用）
 */
export const sendTaskDeadlineNotificationsManual = onCall(
  { secrets: [sendgridApiKey, sendgridFromEmail], cors: true },
  async (request) => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', '認証が必要です');

    const userId = request.data?.userId;
    const roomId = request.data?.roomId;
    const roomDocId = request.data?.roomDocId;

    console.log('🔍 手動実行開始:', { userId, roomId, roomDocId });

    const db = admin.firestore();
    const apiKey = sendgridApiKey
      .value()
      .trim()
      .replace(/[\r\n\t\s]+/g, '');
    sgMail.setApiKey(apiKey);
    const fromEmail = sendgridFromEmail.value() || 'noreply@taskmanager.com';

    // JST（Asia/Tokyo）で現在時刻を取得
    const now = new Date();
    const jstNow = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
    );
    const currentTime = `${jstNow
      .getHours()
      .toString()
      .padStart(2, '0')}:${jstNow.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = jstNow.getDay(); // 曜日を取得（0=日曜日, 6=土曜日）

    console.log(`⏰ JST現在時刻: ${currentTime} (UTC: ${now.toISOString()})`);

    try {
      // 通知設定を取得
      let settingsQuery: admin.firestore.Query = db.collection(
        'notificationSettings'
      );

      if (userId) {
        settingsQuery = settingsQuery.where('userId', '==', userId);
      } else {
        settingsQuery = settingsQuery.where(
          'taskDeadlineNotifications.enabled',
          '==',
          true
        );
      }

      const settingsSnapshot = await settingsQuery.get();
      console.log(`📋 通知設定数: ${settingsSnapshot.docs.length}`);

      const results: any[] = [];

      for (const settingsDoc of settingsSnapshot.docs) {
        const settings = settingsDoc.data();
        const settingUserId = settings.userId;
        const settingRoomId = settings.roomId;
        const settingRoomDocId = settings.roomDocId;

        console.log(`\n👤 ユーザーID: ${settingUserId}`);
        console.log(
          `📦 ルームID: ${settingRoomId}, ルームDocID: ${settingRoomDocId}`
        );

        if (!settingRoomId || !settingRoomDocId) {
          console.warn(`⚠️ ルーム情報が未設定: userId=${settingUserId}`);
          results.push({ userId: settingUserId, error: 'ルーム情報が未設定' });
          continue;
        }

        // ルームIDでフィルタリング（指定されている場合）
        if (roomId && settingRoomId !== roomId) {
          console.log(`⏭️ ルームID不一致のためスキップ`);
          continue;
        }
        if (roomDocId && settingRoomDocId !== roomDocId) {
          console.log(`⏭️ ルームDocID不一致のためスキップ`);
          continue;
        }

        // 通知時間チェック（手動実行時はスキップ可能）
        const notificationTime = settings.taskDeadlineNotifications?.timeOfDay;
        console.log(`⏰ 設定された通知時間: ${notificationTime}`);
        if (
          notificationTime &&
          notificationTime !== currentTime &&
          !request.data?.force
        ) {
          console.log(
            `⏭️ 通知時間不一致のためスキップ（force=trueで強制実行可能）`
          );
          results.push({
            userId: settingUserId,
            skipped: true,
            reason: `通知時間不一致: ${notificationTime} !== ${currentTime}`,
          });
          continue;
        }

        // 通知オフ期間をチェック
        if (settings.quietHours?.enabled) {
          if (
            settings.quietHours.weekends &&
            (currentDay === 0 || currentDay === 6)
          ) {
            console.log(`⏭️ 週末のためスキップ`);
            results.push({
              userId: settingUserId,
              skipped: true,
              reason: '週末',
            });
            continue;
          }

          const startTime = settings.quietHours.startTime;
          const endTime = settings.quietHours.endTime;
          if (startTime && endTime) {
            if (startTime <= endTime) {
              if (currentTime >= startTime && currentTime <= endTime) {
                console.log(`⏭️ 通知オフ期間中のためスキップ`);
                results.push({
                  userId: settingUserId,
                  skipped: true,
                  reason: '通知オフ期間中',
                });
                continue;
              }
            } else {
              if (currentTime >= startTime || currentTime <= endTime) {
                console.log(`⏭️ 通知オフ期間中のためスキップ`);
                results.push({
                  userId: settingUserId,
                  skipped: true,
                  reason: '通知オフ期間中',
                });
                continue;
              }
            }
          }
        }

        // メール通知が有効かチェック
        if (!settings.notificationChannels?.email?.enabled) {
          console.log(`⏭️ メール通知が無効のためスキップ`);
          results.push({
            userId: settingUserId,
            skipped: true,
            reason: 'メール通知が無効',
          });
          continue;
        }

        const emailAddress = settings.notificationChannels.email.address;
        if (!emailAddress) {
          console.warn(`⚠️ メールアドレスが未設定: userId=${settingUserId}`);
          results.push({
            userId: settingUserId,
            error: 'メールアドレスが未設定',
          });
          continue;
        }

        console.log(`📧 メールアドレス: ${emailAddress}`);

        // ユーザーのメールアドレスを取得
        const userEmail = settings.notificationChannels.email.address;

        // ルーム内のメンバー情報を取得
        const membersSnapshot = await db
          .collection('members')
          .where('roomId', '==', settingRoomId)
          .get();

        console.log(`👥 メンバー数: ${membersSnapshot.docs.length}`);

        const memberEmailMap = new Map<string, string>(); // name -> email
        const memberIdMap = new Map<string, string>(); // email -> memberId
        membersSnapshot.forEach((doc) => {
          const memberData = doc.data();
          if (memberData.name && memberData.email) {
            memberEmailMap.set(memberData.name, memberData.email);
            memberIdMap.set(memberData.email, doc.id);
          }
        });

        // ユーザーのメンバーIDを取得
        const userMemberId = memberIdMap.get(userEmail);
        console.log(
          `🆔 ユーザーメンバーID: ${userMemberId || '見つかりません'}`
        );

        // ルーム内のタスクを取得
        const roomContext: RoomContext = {
          roomId: settingRoomId,
          roomDocId: settingRoomDocId,
        };
        const daysBeforeList = settings.taskDeadlineNotifications
          ?.daysBeforeDeadline || [1, 3, 7];
        console.log(`📅 通知タイミング: ${daysBeforeList.join(', ')}日前`);

        const allTasks = await getUpcomingTasks(roomContext, daysBeforeList);
        console.log(`📋 取得したタスク数: ${allTasks.length}`);

        // JST（Asia/Tokyo）で今日の日付を取得
        const now = new Date();
        const jstToday = new Date(
          now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
        );
        jstToday.setHours(0, 0, 0, 0);

        // 通知タイミングに一致するタスクだけをフィルタリング
        const tasksMatchingTiming = allTasks.filter((task) => {
          if (!task.dueDate) {
            return false;
          }

          // 期日をローカルタイムゾーンでDateオブジェクトに変換
          let dueDate: Date;
          if (typeof task.dueDate === 'string') {
            // 文字列形式（YYYY-MM-DD）の場合、ローカルタイムゾーンで日付を作成
            const [year, month, day] = task.dueDate
              .split('T')[0]
              .split('-')
              .map(Number);
            dueDate = new Date(year, month - 1, day);
          } else {
            dueDate = new Date(task.dueDate);
          }
          dueDate.setHours(0, 0, 0, 0);

          // 期日までの日数を計算（ミリ秒→日数）
          const diffTime = dueDate.getTime() - jstToday.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // 設定された通知タイミングに含まれるかチェック
          const matches = daysBeforeList.includes(diffDays);

          if (!matches) {
            console.log(
              `  ⏭️ タスク「${
                task.taskName || task.task
              }」: 通知タイミング不一致 (期日まで${diffDays}日、設定: ${daysBeforeList.join(
                ', '
              )}日前)`
            );
          }

          return matches;
        });

        console.log(
          `📅 通知タイミングに一致するタスク数: ${tasksMatchingTiming.length}`
        );

        // デバッグ用：各タスクの情報をログ出力
        if (tasksMatchingTiming.length > 0) {
          console.log('\n📝 通知タイミングに一致するタスクの詳細:');
          tasksMatchingTiming.slice(0, 5).forEach((task, idx) => {
            // 期日をローカルタイムゾーンでDateオブジェクトに変換
            let dueDate: Date;
            if (typeof task.dueDate === 'string') {
              const [year, month, day] = task.dueDate
                .split('T')[0]
                .split('-')
                .map(Number);
              dueDate = new Date(year, month - 1, day);
            } else {
              dueDate = new Date(task.dueDate);
            }
            dueDate.setHours(0, 0, 0, 0);
            const diffTime = dueDate.getTime() - jstToday.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            console.log(`  タスク ${idx + 1}:`, {
              taskName: task.taskName || task.task,
              dueDate: task.dueDate,
              daysUntilDeadline: diffDays,
              assigneeEmail: task.assigneeEmail,
              assignee: task.assignee,
              assignedMembers: task.assignedMembers,
              detailSettings: task.detailSettings,
            });
          });
          if (tasksMatchingTiming.length > 5) {
            console.log(`  ... 他 ${tasksMatchingTiming.length - 5}件`);
          }
        }

        // ユーザーが担当者に含まれるタスクを抽出
        const userTasks = tasksMatchingTiming.filter((task) => {
          // 詳細設定のタスク期限ボタンがONになっているかチェック
          const detailSettings = task.detailSettings;
          if (detailSettings?.notifications?.beforeDeadline === false) {
            console.log(
              `  ❌ タスク「${task.taskName || task.task}」: 詳細設定で通知OFF`
            );
            return false;
          }

          // ユーザーが担当者に含まれるかチェック
          const assigneeEmail = task.assigneeEmail;
          const assignee = task.assignee;
          const assignedMembers = task.assignedMembers || [];

          // メールアドレスで一致
          if (assigneeEmail === userEmail) {
            console.log(
              `  ✅ タスク「${task.taskName || task.task}」: assigneeEmail一致`
            );
            return true;
          }

          // assignedMembersにuserMemberIdが含まれる
          if (userMemberId && assignedMembers.includes(userMemberId)) {
            console.log(
              `  ✅ タスク「${
                task.taskName || task.task
              }」: assignedMembers一致`
            );
            return true;
          }

          // assigneeが名前の場合、メールアドレスで確認
          if (assignee) {
            const assigneeNames = assignee
              .split(',')
              .map((n: string) => n.trim());
            for (const name of assigneeNames) {
              const memberEmail = memberEmailMap.get(name);
              if (memberEmail === userEmail) {
                console.log(
                  `  ✅ タスク「${
                    task.taskName || task.task
                  }」: assignee名一致 (${name})`
                );
                return true;
              }
            }
          }

          console.log(
            `  ❌ タスク「${task.taskName || task.task}」: 担当者不一致`,
            {
              assigneeEmail,
              assignee,
              assignedMembers,
              userEmail,
              userMemberId,
            }
          );
          return false;
        });

        console.log(`✅ ユーザーが担当者のタスク数: ${userTasks.length}`);

        if (userTasks.length === 0) {
          console.log(`📭 通知対象タスクなし: userId=${settingUserId}`);
          results.push({
            userId: settingUserId,
            taskCount: 0,
            message: '通知対象タスクなし',
          });
          continue;
        }

        // メール送信
        try {
          const msg = {
            to: emailAddress,
            from: fromEmail,
            subject: `【タスク期限通知】${userTasks.length}件のタスクが期限間近です`,
            html: generateTaskReminderHTML(userTasks),
          };
          await sgMail.send(msg);
          console.log(
            `✅ タスク期限通知メール送信成功: ${emailAddress} (${userTasks.length}件)`
          );
          results.push({
            userId: settingUserId,
            success: true,
            taskCount: userTasks.length,
            email: emailAddress,
          });
        } catch (error: any) {
          console.error(
            `❌ SendGrid送信エラー(${emailAddress}):`,
            error.response?.body || error
          );
          results.push({
            userId: settingUserId,
            error: 'メール送信エラー',
            details: error.response?.body || error.message,
          });
        }
      }

      return {
        success: true,
        message: 'タスク期限通知の手動実行が完了しました',
        currentTime,
        results,
      };
    } catch (error: any) {
      console.error('❌ タスク期限通知手動実行エラー:', error);
      throw new HttpsError('internal', `エラー: ${error.message}`);
    }
  }
);

export const sendUserTaskNotificationsManual = onCall(
  { secrets: [sendgridApiKey, sendgridFromEmail], cors: true },
  async (request) => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', '認証が必要です');

    const roomId = request.data?.roomId;
    const roomDocId = request.data?.roomDocId;
    if (!roomId || !roomDocId)
      throw new HttpsError('invalid-argument', 'roomIdとroomDocIdが必要です');

    const roomContext: RoomContext = { roomId, roomDocId };
    const apiKey = sendgridApiKey
      .value()
      .trim()
      .replace(/[\r\n\t\s]+/g, '');
    sgMail.setApiKey(apiKey);

    // 期限が近いタスクを取得（1, 3, 7日前）
    const upcomingTasks = await getUpcomingTasks(roomContext, [1, 3, 7]);

    if (upcomingTasks.length === 0)
      return {
        success: true,
        message: '期限が近いタスクはありません',
        taskCount: 0,
        userCount: 0,
      };

    // ユーザーごとにタスクをグループ化
    const tasksByUser = await groupTasksByUser(upcomingTasks, roomId);
    const fromEmail = sendgridFromEmail.value() || 'noreply@taskmanager.com';

    const sendPromises = Object.entries(tasksByUser).map(
      async ([email, userTasks]) => {
        if (!email) {
          console.warn(
            '⚠️ 宛先メールアドレスが未設定のタスクがあります:',
            userTasks
          );
          return;
        }

        try {
          const msg = {
            to: email,
            from: fromEmail,
            subject: `【期限間近】${userTasks.length}件のタスクが期限間近です`,
            html: generateTaskReminderHTML(userTasks),
          };
          await sgMail.send(msg);
          console.log(`✅ メール送信成功: ${email}`);
        } catch (error: any) {
          console.error(
            `❌ SendGrid送信エラー(${email}):`,
            error.response?.body || error
          );
        }
      }
    );

    await Promise.all(sendPromises);
    return {
      success: true,
      message: 'ユーザー個別のタスク通知を送信しました',
      taskCount: upcomingTasks.length,
      userCount: Object.keys(tasksByUser).length,
    };
  }
);

export { addTaskToCalendar } from './calendarSync';
