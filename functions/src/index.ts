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
  // 今日の日付をJSTで取得（時刻を00:00:00に設定）
  const now = new Date();
  const jstNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
  );
  const today = new Date(jstNow);
  today.setHours(0, 0, 0, 0);

  // 期日までの日数を計算する関数
  const getDaysUntilDue = (dueDate: string): number => {
    if (!dueDate) return 0;

    // 期日をローカルタイムゾーンで取得
    const [year, month, day] = dueDate.split('T')[0].split('-').map(Number);
    const due = new Date(year, month - 1, day);
    due.setHours(0, 0, 0, 0);

    // 日数の差分を計算（ミリ秒→日数）
    const diff = due.getTime() - today.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const taskList = tasks
    .map((task, index) => {
      const daysUntilDue = getDaysUntilDue(task.dueDate);
      const daysText =
        daysUntilDue < 0
          ? `(${Math.abs(daysUntilDue)}日遅れ)`
          : daysUntilDue === 0
          ? '(今日)'
          : `(${daysUntilDue}日後)`;

      return `
      <div style="background-color:#f8f9fa;padding:15px;margin:10px 0;
        border-radius:8px;border-left:4px solid #1976d2;">
        <h3 style="margin:0 0 10px;">${index + 1}. ${task.taskName}</h3>
        <p>プロジェクト: ${task.projectName}</p>
        <p>期限: ${task.dueDate} ${daysText}</p>
        <p>ステータス: ${task.status}</p>
      </div>`;
    })
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
/**
 * 🔹 すぐやるタスクを取得（ユーザーが担当者のタスク）
 */
async function getQuickTasksForUser(
  roomId: string,
  roomDocId: string,
  userEmail: string,
  userName?: string,
  days: number = 7
): Promise<any[]> {
  const db = admin.firestore();
  const now = new Date();
  const jstNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
  );
  const jstToday = new Date(jstNow);
  jstToday.setHours(0, 0, 0, 0);

  const targetDate = new Date(jstToday);
  targetDate.setDate(targetDate.getDate() + days);
  targetDate.setHours(23, 59, 59, 999);

  const todayStr = `${jstToday.getFullYear()}-${String(
    jstToday.getMonth() + 1
  ).padStart(2, '0')}-${String(jstToday.getDate()).padStart(2, '0')}`;
  const targetDateStr = `${targetDate.getFullYear()}-${String(
    targetDate.getMonth() + 1
  ).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

  console.log(
    `📅 すぐやるタスク取得期間: ${todayStr} ～ ${targetDateStr} (${days}日間)`
  );

  // メンバー情報を取得
  const membersSnapshot = await db
    .collection('members')
    .where('roomId', '==', roomId)
    .get();

  const memberEmailMap = new Map<string, string>(); // memberId -> email
  const memberNameMap = new Map<string, string>(); // name -> email
  const memberIdMap = new Map<string, string>(); // email -> memberId
  const memberIdToNameMap = new Map<string, string>(); // memberId -> name
  membersSnapshot.forEach((doc) => {
    const memberData = doc.data();
    if (memberData.email) {
      if (doc.id) {
        memberEmailMap.set(doc.id, memberData.email);
        memberIdMap.set(memberData.email, doc.id);
        if (memberData.name) {
          memberIdToNameMap.set(doc.id, memberData.name);
        }
      }
      if (memberData.name) {
        memberNameMap.set(memberData.name, memberData.email);
      }
    }
  });

  // ユーザーのメンバーIDを取得
  const userMemberId = memberIdMap.get(userEmail);
  const normalizedUserName = userName?.trim().toLowerCase();

  // ユーザー名の配列を作成（フロントエンド側と同じロジック）
  const members = normalizedUserName ? [normalizedUserName] : [];

  // プロジェクトを取得
  const projectsRef = db.collection('projects');
  let projectsSnapshot = await projectsRef
    .where('roomDocId', '==', roomDocId)
    .get();

  if (projectsSnapshot.empty) {
    projectsSnapshot = await projectsRef.where('roomId', '==', roomId).get();
  }

  const allTasks: any[] = [];

  // 各プロジェクトのタスクを取得
  for (const projectDoc of projectsSnapshot.docs) {
    const projectId = projectDoc.id;
    const projectData = projectDoc.data();
    const tasksRef = db.collection(`projects/${projectId}/tasks`);

    const tasksSnapshot = await tasksRef.get();

    tasksSnapshot.forEach((taskDoc) => {
      const taskData = taskDoc.data();
      const due = taskData.dueDate;

      // 期間内で、ステータスが「未着手」または「作業中」のタスク
      const isWithin =
        due >= todayStr &&
        due <= targetDateStr &&
        (taskData.status === '未着手' || taskData.status === '作業中');

      if (!isWithin) {
        return;
      }

      // 担当者をチェック
      let assignees: string[] = [];

      // ① assignee（カンマ区切り）
      if (taskData.assignee) {
        assignees.push(
          ...taskData.assignee
            .split(',')
            .map((n: string) => n.trim().toLowerCase())
            .filter((n: string) => n.length > 0)
        );
      }

      // ② assignedMembers
      if (Array.isArray(taskData.assignedMembers)) {
        taskData.assignedMembers.forEach((member: any) => {
          if (typeof member === 'string') {
            // 文字列の場合、メンバーIDまたはメンバー名の可能性がある
            // フロントエンド側と同じロジック：そのまま追加
            assignees.push(member.trim().toLowerCase());
          } else if (typeof member === 'object' && member) {
            if (member.memberName)
              assignees.push(member.memberName.trim().toLowerCase());
            if (member.name) assignees.push(member.name.trim().toLowerCase());
            if (member.memberEmail)
              assignees.push(member.memberEmail.trim().toLowerCase());
            if (member.email) assignees.push(member.email.trim().toLowerCase());
          }
        });
      }

      // ③ assigneeEmail
      if (taskData.assigneeEmail) {
        assignees.push(taskData.assigneeEmail.trim().toLowerCase());
      }

      assignees = [...new Set(assignees)];

      const normalizedUserEmail = userEmail.trim().toLowerCase();

      // フロントエンド側と同じロジック
      // members.length > 0 の場合、assignees.some((a) => members.includes(a))
      // そうでない場合、assignees.includes(userEmail)
      const match =
        members.length > 0
          ? assignees.some((a) => members.includes(a))
          : assignees.includes(normalizedUserEmail);

      if (match) {
        allTasks.push({
          id: taskDoc.id,
          projectId,
          projectName: projectData.projectName || 'プロジェクト',
          taskName: taskData.taskName || taskData.task,
          dueDate: taskData.dueDate,
          status: taskData.status,
          priority: taskData.priority,
        });
      }
    });
  }

  // 期日でソート（早い順）
  allTasks.sort((a, b) => {
    if (a.dueDate < b.dueDate) return -1;
    if (a.dueDate > b.dueDate) return 1;
    return 0;
  });

  // 上位5つに制限
  return allTasks.slice(0, 5);
}

/**
 * 🔹 日次リマインダーをスケジュール実行（毎分チェック）
 */
export const sendDailyTaskReminders = onSchedule(
  {
    schedule: '* * * * *', // 毎分実行
    timeZone: 'Asia/Tokyo',
    memory: '512MiB',
    timeoutSeconds: 540,
    secrets: [sendgridApiKey, sendgridFromEmail],
  },
  async () => {
    console.log('🕙 日次リマインダースケジュール実行開始');
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
    const currentDay = jstNow.getDay();

    console.log(`⏰ JST現在時刻: ${currentTime} (UTC: ${now.toISOString()})`);

    try {
      // 全通知設定を取得
      const settingsSnapshot = await db
        .collection('notificationSettings')
        .where('dailyDeadlineReminder.enabled', '==', true)
        .get();

      console.log(
        `📋 日次リマインダー有効な設定数: ${settingsSnapshot.docs.length}`
      );

      for (const settingsDoc of settingsSnapshot.docs) {
        const settings = settingsDoc.data();
        const settingUserId = settings.userId;
        const roomId = settings.roomId;
        const roomDocId = settings.roomDocId;

        if (!roomId || !roomDocId) {
          console.warn(`⚠️ ルーム情報が未設定: userId=${settingUserId}`);
          continue;
        }

        const notificationTime =
          settings.dailyDeadlineReminder?.timeOfDay || '09:00';
        console.log(
          `🔍 ユーザー ${settingUserId}: 設定時刻=${notificationTime}, 現在時刻=${currentTime}`
        );

        if (notificationTime !== currentTime) {
          continue;
        }

        console.log(
          `✅ 通知時刻一致！ユーザー ${settingUserId} の通知を処理開始`
        );

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
          console.warn(`⚠️ メールアドレスが未設定: userId=${settingUserId}`);
          continue;
        }

        // ユーザーのメールアドレスを取得
        const userEmail = emailAddress;

        // メンバー情報を取得（ユーザー名を取得するため）
        const membersSnapshot = await db
          .collection('members')
          .where('roomId', '==', roomId)
          .get();

        let userName: string | undefined;
        membersSnapshot.forEach((doc) => {
          const memberData = doc.data();
          if (memberData.email === userEmail && memberData.name) {
            userName = memberData.name;
          }
        });

        // すぐやるタスクを取得（上位5つ）
        const quickTasks = await getQuickTasksForUser(
          roomId,
          roomDocId,
          userEmail,
          userName,
          7 // 7日間
        );

        if (quickTasks.length === 0) {
          console.log(`📭 すぐやるタスクなし: userId=${settingUserId}`);
          continue;
        }

        console.log(
          `📋 すぐやるタスク数: ${quickTasks.length}件 (userId=${settingUserId})`
        );

        // メール送信
        try {
          const taskList = quickTasks
            .map(
              (task, index) => `
            <div style="background-color:#f8f9fa;padding:15px;margin:10px 0;border-radius:8px;border-left:4px solid #1976d2;">
              <h3 style="margin:0 0 10px;">${index + 1}. ${task.taskName}</h3>
              <p style="margin:5px 0;"><strong>期日:</strong> ${
                task.dueDate
              }</p>
              <p style="margin:5px 0;"><strong>プロジェクト:</strong> ${
                task.projectName
              }</p>
              <p style="margin:5px 0;"><strong>ステータス:</strong> ${
                task.status
              }</p>
            </div>`
            )
            .join('');

          const msg = {
            to: emailAddress,
            from: fromEmail,
            subject: `【日次リマインダー】期限が近いタスクが${quickTasks.length}件あります`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#1976d2;">📋 日次リマインダー</h2>
                <p>期限が近いタスクが${quickTasks.length}件あります。以下をご確認ください。</p>
                ${taskList}
                <p style="color:#999;font-size:12px;margin-top:20px;">
                  このメールはタスク管理アプリから自動送信されました。
                </p>
              </div>
            `,
          };
          await sgMail.send(msg);
          console.log(
            `✅ 日次リマインダーメール送信成功: ${emailAddress} (${quickTasks.length}件)`
          );
        } catch (error: any) {
          console.error(
            `❌ SendGrid送信エラー(${emailAddress}):`,
            error.response?.body || error
          );
        }
      }
    } catch (error: any) {
      console.error('❌ 日次リマインダースケジュール実行エラー:', error);
    }
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

          // 通知先（recipients）が設定されている場合、そのユーザーのみに通知
          const recipients = detailSettings?.notifications?.recipients;
          if (Array.isArray(recipients) && recipients.length > 0) {
            // ユーザー名またはメールアドレスでrecipientsに含まれるかチェック
            const userMember = membersSnapshot.docs.find(
              (doc) => doc.data().email === userEmail
            );
            const userName = userMember?.data()?.name;

            const isInRecipients = recipients.some((recipient: string) => {
              const recipientTrimmed = recipient.trim();
              return (
                recipientTrimmed === userEmail ||
                recipientTrimmed === userName ||
                recipientTrimmed === userMember?.id
              );
            });

            if (!isInRecipients) {
              return false;
            }
          }
          // recipientsが空または未設定の場合は、全担当者に通知（既存の動作）

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

          // 通知先（recipients）が設定されている場合、そのユーザーのみに通知
          const recipients = detailSettings?.notifications?.recipients;
          if (Array.isArray(recipients) && recipients.length > 0) {
            // ユーザー名またはメールアドレスでrecipientsに含まれるかチェック
            const userMember = membersSnapshot.docs.find(
              (doc) => doc.data().email === userEmail
            );
            const userName = userMember?.data()?.name;

            const isInRecipients = recipients.some((recipient: string) => {
              const recipientTrimmed = recipient.trim();
              return (
                recipientTrimmed === userEmail ||
                recipientTrimmed === userName ||
                recipientTrimmed === userMember?.id
              );
            });

            if (!isInRecipients) {
              console.log(
                `  ❌ タスク「${
                  task.taskName || task.task
                }」: 通知先に含まれていない (通知先: ${recipients.join(', ')})`
              );
              return false;
            }

            console.log(
              `  ✅ タスク「${
                task.taskName || task.task
              }」: 通知先に含まれている`
            );
          }
          // recipientsが空または未設定の場合は、全担当者に通知（既存の動作）

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

/**
 * 🔹 未来N日間のタスクを取得し、ユーザーごとに予定時間を集計
 */
async function getUserWorkTimeSummary(
  roomId: string,
  roomDocId: string,
  checkPeriodDays: number
): Promise<{ [userEmail: string]: number }> {
  const db = admin.firestore();
  const now = new Date();
  const jstNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
  );
  const jstToday = new Date(jstNow);
  jstToday.setHours(0, 0, 0, 0);

  // 未来N日間の終了日を計算
  const endDate = new Date(jstToday);
  endDate.setDate(endDate.getDate() + checkPeriodDays);
  endDate.setHours(23, 59, 59, 999);

  const todayStr = `${jstToday.getFullYear()}-${String(
    jstToday.getMonth() + 1
  ).padStart(2, '0')}-${String(jstToday.getDate()).padStart(2, '0')}`;
  const endDateStr = `${endDate.getFullYear()}-${String(
    endDate.getMonth() + 1
  ).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  console.log(
    `📅 作業時間集計期間: 今日 ～ ${endDateStr} (未来${checkPeriodDays}日間)`
  );

  // プロジェクトを取得
  const projectsRef = db.collection('projects');
  let projectsSnapshot = await projectsRef
    .where('roomDocId', '==', roomDocId)
    .get();

  if (projectsSnapshot.empty) {
    projectsSnapshot = await projectsRef.where('roomId', '==', roomId).get();
  }

  // メンバー情報を取得（メールアドレスマッピング用）
  const membersSnapshot = await db
    .collection('members')
    .where('roomId', '==', roomId)
    .get();

  const memberEmailMap = new Map<string, string>(); // memberId -> email
  const memberNameMap = new Map<string, string>(); // name -> email
  membersSnapshot.forEach((doc) => {
    const memberData = doc.data();
    if (memberData.email) {
      if (doc.id) {
        memberEmailMap.set(doc.id, memberData.email);
      }
      if (memberData.name) {
        memberNameMap.set(memberData.name, memberData.email);
      }
    }
  });

  const userWorkTimeMap: { [userEmail: string]: number } = {};

  // 各プロジェクトのタスクを取得
  for (const projectDoc of projectsSnapshot.docs) {
    const projectId = projectDoc.id;
    const tasksRef = db.collection(`projects/${projectId}/tasks`);

    // 「未着手」「作業中」のタスクを取得
    const tasksSnapshot = await tasksRef
      .where('status', 'in', ['未着手', '作業中'])
      .get();

    tasksSnapshot.forEach((taskDoc) => {
      const taskData = taskDoc.data();
      const detailSettings = taskData.detailSettings;

      // 予定時間を取得
      const estimatedHoursStr = detailSettings?.workTime?.estimatedHours;
      if (!estimatedHoursStr || typeof estimatedHoursStr !== 'string') {
        return; // 予定時間が未設定の場合はスキップ
      }

      // "HH:MM"形式を時間数に変換
      const [hours, minutes] = estimatedHoursStr.split(':').map(Number);
      const totalHours = hours + minutes / 60;

      if (totalHours <= 0) {
        return; // 0時間以下の場合はスキップ
      }

      // タスクの期間を取得
      const taskStartDate = taskData.startDate;
      const taskDueDate = taskData.dueDate || taskStartDate;

      if (!taskStartDate || !taskDueDate) {
        return; // 開始日または期日が未設定の場合はスキップ
      }

      // タスクの期間をDateオブジェクトに変換
      let taskStart: Date;
      let taskEnd: Date;

      if (typeof taskStartDate === 'string') {
        const [year, month, day] = taskStartDate
          .split('T')[0]
          .split('-')
          .map(Number);
        taskStart = new Date(year, month - 1, day);
      } else {
        taskStart = new Date(taskStartDate);
      }

      if (typeof taskDueDate === 'string') {
        const [year, month, day] = taskDueDate
          .split('T')[0]
          .split('-')
          .map(Number);
        taskEnd = new Date(year, month - 1, day);
      } else {
        taskEnd = new Date(taskDueDate);
      }

      taskStart.setHours(0, 0, 0, 0);
      taskEnd.setHours(23, 59, 59, 999);

      // タスクの期間がチェック期間と重なっているかチェック
      // タスクの開始日が終了日より前、またはタスクの終了日が開始日より後なら重なっている
      if (taskEnd < jstToday || taskStart > endDate) {
        return; // 期間が重なっていない場合はスキップ
      }

      // 担当者を特定
      const assigneeEmail = taskData.assigneeEmail;
      const assignee = taskData.assignee;
      const assignedMembers = taskData.assignedMembers || [];

      const userEmails = new Set<string>();

      // メールアドレスで一致
      if (assigneeEmail) {
        userEmails.add(assigneeEmail);
      }

      // assignedMembersに含まれるユーザー
      assignedMembers.forEach((memberId: string) => {
        const email = memberEmailMap.get(memberId);
        if (email) {
          userEmails.add(email);
        }
      });

      // assigneeが名前の場合
      if (assignee) {
        const assigneeNames = assignee
          .split(',')
          .map((n: string) => n.trim())
          .filter((n: string) => !!n);
        assigneeNames.forEach((name: string) => {
          const email = memberNameMap.get(name);
          if (email) {
            userEmails.add(email);
          }
        });
      }

      // ユーザーごとに予定時間を集計
      userEmails.forEach((email) => {
        if (!userWorkTimeMap[email]) {
          userWorkTimeMap[email] = 0;
        }
        userWorkTimeMap[email] += totalHours;
      });
    });
  }

  console.log(`📊 ユーザーごとの予定時間集計結果:`, userWorkTimeMap);
  return userWorkTimeMap;
}

/**
 * 🔹 ユーザーがメンバーに登録されている全プロジェクトの責任者を取得
 */
async function getProjectManagersForUser(
  roomId: string,
  roomDocId: string,
  userEmail: string,
  userName?: string
): Promise<string[]> {
  const db = admin.firestore();

  // メンバー情報を取得
  const membersSnapshot = await db
    .collection('members')
    .where('roomId', '==', roomId)
    .get();

  const memberEmailMap = new Map<string, string>(); // memberId -> email
  const memberNameMap = new Map<string, string>(); // name -> email
  const memberIdMap = new Map<string, string>(); // email -> memberId
  membersSnapshot.forEach((doc) => {
    const memberData = doc.data();
    if (memberData.email) {
      if (doc.id) {
        memberEmailMap.set(doc.id, memberData.email);
        memberIdMap.set(memberData.email, doc.id);
      }
      if (memberData.name) {
        memberNameMap.set(memberData.name, memberData.email);
      }
    }
  });

  // ユーザーのメンバーIDを取得
  const userMemberId = memberIdMap.get(userEmail);

  // プロジェクトを取得
  const projectsRef = db.collection('projects');
  let projectsSnapshot = await projectsRef
    .where('roomDocId', '==', roomDocId)
    .get();

  if (projectsSnapshot.empty) {
    projectsSnapshot = await projectsRef.where('roomId', '==', roomId).get();
  }

  const managerEmails = new Set<string>();

  projectsSnapshot.forEach((projectDoc) => {
    const projectData = projectDoc.data();
    const members = projectData.members;

    // ユーザーがメンバーに含まれているかチェック
    let isMember = false;

    if (typeof members === 'string') {
      const memberNames = members.split(',').map((n: string) => n.trim());
      if (userName && memberNames.includes(userName)) {
        isMember = true;
      }
      if (
        memberNames.some((name: string) => {
          const email = memberNameMap.get(name);
          return email === userEmail;
        })
      ) {
        isMember = true;
      }
    } else if (Array.isArray(members)) {
      members.forEach((member: any) => {
        if (typeof member === 'string') {
          if (userMemberId === member || userName === member) {
            isMember = true;
          }
        } else if (member && member.id) {
          if (userMemberId === member.id) {
            isMember = true;
          }
        }
      });
    }

    if (!isMember) {
      return; // メンバーに含まれていない場合はスキップ
    }

    // 責任者を取得
    const responsibleEmail = projectData.responsibleEmail;
    if (responsibleEmail) {
      managerEmails.add(responsibleEmail);
    }

    const responsibleId = projectData.responsibleId;
    if (responsibleId) {
      const email = memberEmailMap.get(responsibleId);
      if (email) {
        managerEmails.add(email);
      }
    }

    const responsibles = projectData.responsibles;
    if (Array.isArray(responsibles)) {
      responsibles.forEach((responsible: any) => {
        if (responsible?.memberEmail) {
          managerEmails.add(responsible.memberEmail);
        } else if (responsible?.memberId) {
          const email = memberEmailMap.get(responsible.memberId);
          if (email) {
            managerEmails.add(email);
          }
        }
      });
    }

    const responsible = projectData.responsible;
    if (typeof responsible === 'string') {
      const responsibleNames = responsible
        .split(',')
        .map((n: string) => n.trim());
      responsibleNames.forEach((name: string) => {
        const email = memberNameMap.get(name);
        if (email) {
          managerEmails.add(email);
        }
      });
    }
  });

  return Array.from(managerEmails);
}

/**
 * 🔹 作業時間オーバー通知をスケジュール実行（毎分チェック）
 */
export const sendWorkTimeOverflowNotifications = onSchedule(
  {
    schedule: '* * * * *', // 毎分実行
    timeZone: 'Asia/Tokyo',
    memory: '512MiB',
    timeoutSeconds: 540,
    secrets: [sendgridApiKey, sendgridFromEmail],
  },
  async () => {
    console.log('🕙 作業時間オーバー通知スケジュール実行開始');
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
    const currentDay = jstNow.getDay();

    console.log(`⏰ JST現在時刻: ${currentTime} (UTC: ${now.toISOString()})`);

    try {
      // 全通知設定を取得
      const settingsSnapshot = await db
        .collection('notificationSettings')
        .where('workTimeOverflowNotifications.enabled', '==', true)
        .get();

      console.log(
        `📋 作業時間オーバー通知有効な設定数: ${settingsSnapshot.docs.length}`
      );

      for (const settingsDoc of settingsSnapshot.docs) {
        const settings = settingsDoc.data();
        const settingUserId = settings.userId;
        const roomId = settings.roomId;
        const roomDocId = settings.roomDocId;

        if (!roomId || !roomDocId) {
          console.warn(`⚠️ ルーム情報が未設定: userId=${settingUserId}`);
          continue;
        }

        const notificationTime =
          settings.workTimeOverflowNotifications?.timeOfDay || '09:00';
        console.log(
          `🔍 ユーザー ${settingUserId}: 設定時刻=${notificationTime}, 現在時刻=${currentTime}`
        );

        if (notificationTime !== currentTime) {
          continue;
        }

        console.log(
          `✅ 通知時刻一致！ユーザー ${settingUserId} の通知を処理開始`
        );

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

        const checkPeriodDays =
          settings.workTimeOverflowNotifications?.checkPeriodDays || 7;
        const maxWorkHours =
          settings.workTimeOverflowNotifications?.maxWorkHours || 40;

        console.log(
          `📊 チェック期間: 未来${checkPeriodDays}日間, 最大予定時間: ${maxWorkHours}時間`
        );

        // ユーザーごとの予定時間を集計
        const userWorkTimeMap = await getUserWorkTimeSummary(
          roomId,
          roomDocId,
          checkPeriodDays
        );

        // 予定時間オーバーのユーザーを特定
        const overflowUsers: Array<{
          email: string;
          workHours: number;
        }> = [];

        for (const [userEmail, workHours] of Object.entries(userWorkTimeMap)) {
          if (workHours > maxWorkHours) {
            overflowUsers.push({ email: userEmail, workHours });
            console.log(
              `⚠️ 予定時間オーバー: ${userEmail} (${workHours.toFixed(
                2
              )}時間 / ${maxWorkHours}時間)`
            );
          }
        }

        if (overflowUsers.length === 0) {
          console.log(`📭 予定時間オーバーのユーザーなし`);
          continue;
        }

        // 各オーバーユーザーについて、責任者に通知
        for (const overflowUser of overflowUsers) {
          const managerEmails = await getProjectManagersForUser(
            roomId,
            roomDocId,
            overflowUser.email
          );

          if (managerEmails.length === 0) {
            console.log(`⚠️ 責任者が見つかりません: ${overflowUser.email}`);
            continue;
          }

          console.log(
            `📧 通知先責任者: ${managerEmails.join(', ')} (ユーザー: ${
              overflowUser.email
            })`
          );

          // 責任者にメール送信
          for (const managerEmail of managerEmails) {
            try {
              const msg = {
                to: managerEmail,
                from: fromEmail,
                subject: `【予定時間オーバー通知】${overflowUser.email}の予定時間が上限を超えています`,
                html: `
                  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                    <h2 style="color:#d32f2f;">⏰ 予定時間オーバー通知</h2>
                    <p>以下のユーザーの予定時間が設定された上限を超えています。</p>
                    <div style="background-color:#fff3cd;padding:15px;margin:10px 0;border-radius:8px;border-left:4px solid #ff9800;">
                      <h3 style="margin:0 0 10px;">ユーザー: ${
                        overflowUser.email
                      }</h3>
                      <p><strong>予定時間合計:</strong> ${overflowUser.workHours.toFixed(
                        2
                      )}時間</p>
                      <p><strong>設定上限:</strong> ${maxWorkHours}時間</p>
                      <p><strong>超過時間:</strong> ${(
                        overflowUser.workHours - maxWorkHours
                      ).toFixed(2)}時間</p>
                      <p><strong>集計期間:</strong> 未来${checkPeriodDays}日間</p>
                      <p><strong>対象タスク:</strong> ステータス「未着手」「作業中」で、期間が重なるタスク</p>
                    </div>
                    <p style="color:#999;font-size:12px;">
                      このメールはタスク管理アプリから自動送信されました。
                    </p>
                  </div>
                `,
              };
              await sgMail.send(msg);
              console.log(
                `✅ 作業時間オーバー通知メール送信成功: ${managerEmail}`
              );
            } catch (error: any) {
              console.error(
                `❌ SendGrid送信エラー(${managerEmail}):`,
                error.response?.body || error
              );
            }
          }
        }
      }
    } catch (error: any) {
      console.error('❌ 作業時間オーバー通知スケジュール実行エラー:', error);
    }
  }
);

/**
 * 🔹 作業時間オーバー通知を手動実行（デバッグ用）
 */
export const sendWorkTimeOverflowNotificationsManual = onCall(
  { secrets: [sendgridApiKey, sendgridFromEmail], cors: true },
  async (request) => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', '認証が必要です');

    const userId = request.data?.userId;
    const roomId = request.data?.roomId;
    const roomDocId = request.data?.roomDocId;
    const force = request.data?.force || false;

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
    const currentDay = jstNow.getDay();

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
          'workTimeOverflowNotifications.enabled',
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
        const notificationTime =
          settings.workTimeOverflowNotifications?.timeOfDay || '09:00';
        console.log(`⏰ 設定された通知時間: ${notificationTime}`);
        if (notificationTime && notificationTime !== currentTime && !force) {
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

        const checkPeriodDays =
          settings.workTimeOverflowNotifications?.checkPeriodDays || 7;
        const maxWorkHours =
          settings.workTimeOverflowNotifications?.maxWorkHours || 40;

        console.log(
          `📊 チェック期間: 未来${checkPeriodDays}日間, 最大予定時間: ${maxWorkHours}時間`
        );

        // ユーザーごとの予定時間を集計
        const userWorkTimeMap = await getUserWorkTimeSummary(
          settingRoomId,
          settingRoomDocId,
          checkPeriodDays
        );

        // 予定時間オーバーのユーザーを特定
        const overflowUsers: Array<{
          email: string;
          workHours: number;
        }> = [];

        for (const [userEmail, workHours] of Object.entries(userWorkTimeMap)) {
          if (workHours > maxWorkHours) {
            overflowUsers.push({ email: userEmail, workHours });
            console.log(
              `⚠️ 予定時間オーバー: ${userEmail} (${workHours.toFixed(
                2
              )}時間 / ${maxWorkHours}時間)`
            );
          }
        }

        if (overflowUsers.length === 0) {
          console.log(`📭 予定時間オーバーのユーザーなし`);
          results.push({
            userId: settingUserId,
            success: true,
            overflowUserCount: 0,
            message: '予定時間オーバーのユーザーなし',
          });
          continue;
        }

        // 各オーバーユーザーについて、責任者に通知
        let notificationCount = 0;
        for (const overflowUser of overflowUsers) {
          const managerEmails = await getProjectManagersForUser(
            settingRoomId,
            settingRoomDocId,
            overflowUser.email
          );

          if (managerEmails.length === 0) {
            console.log(`⚠️ 責任者が見つかりません: ${overflowUser.email}`);
            continue;
          }

          console.log(
            `📧 通知先責任者: ${managerEmails.join(', ')} (ユーザー: ${
              overflowUser.email
            })`
          );

          // 責任者にメール送信
          for (const managerEmail of managerEmails) {
            try {
              const msg = {
                to: managerEmail,
                from: fromEmail,
                subject: `【予定時間オーバー通知】${overflowUser.email}の予定時間が上限を超えています`,
                html: `
                  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                    <h2 style="color:#d32f2f;">⏰ 予定時間オーバー通知</h2>
                    <p>以下のユーザーの予定時間が設定された上限を超えています。</p>
                    <div style="background-color:#fff3cd;padding:15px;margin:10px 0;border-radius:8px;border-left:4px solid #ff9800;">
                      <h3 style="margin:0 0 10px;">ユーザー: ${
                        overflowUser.email
                      }</h3>
                      <p><strong>予定時間合計:</strong> ${overflowUser.workHours.toFixed(
                        2
                      )}時間</p>
                      <p><strong>設定上限:</strong> ${maxWorkHours}時間</p>
                      <p><strong>超過時間:</strong> ${(
                        overflowUser.workHours - maxWorkHours
                      ).toFixed(2)}時間</p>
                      <p><strong>集計期間:</strong> 未来${checkPeriodDays}日間</p>
                      <p><strong>対象タスク:</strong> ステータス「未着手」「作業中」で、期間が重なるタスク</p>
                    </div>
                    <p style="color:#999;font-size:12px;">
                      このメールはタスク管理アプリから自動送信されました。
                    </p>
                  </div>
                `,
              };
              await sgMail.send(msg);
              console.log(
                `✅ 作業時間オーバー通知メール送信成功: ${managerEmail}`
              );
              notificationCount++;
            } catch (error: any) {
              console.error(
                `❌ SendGrid送信エラー(${managerEmail}):`,
                error.response?.body || error
              );
            }
          }
        }

        results.push({
          userId: settingUserId,
          success: true,
          overflowUserCount: overflowUsers.length,
          notificationCount,
        });
      }

      return {
        success: true,
        message: '作業時間オーバー通知の手動実行が完了しました',
        currentTime,
        results,
      };
    } catch (error: any) {
      console.error('❌ 作業時間オーバー通知手動実行エラー:', error);
      throw new HttpsError('internal', `エラー: ${error.message}`);
    }
  }
);

/**
 * 🔹 日次リマインダーを手動実行（デバッグ用）
 */
export const sendDailyTaskRemindersManual = onCall(
  { secrets: [sendgridApiKey, sendgridFromEmail], cors: true },
  async (request) => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', '認証が必要です');

    const userId = request.data?.userId;
    const roomId = request.data?.roomId;
    const roomDocId = request.data?.roomDocId;
    const force = request.data?.force || false;

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
    const currentDay = jstNow.getDay();

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
          'dailyDeadlineReminder.enabled',
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
        const notificationTime =
          settings.dailyDeadlineReminder?.timeOfDay || '09:00';
        console.log(`⏰ 設定された通知時間: ${notificationTime}`);
        if (notificationTime && notificationTime !== currentTime && !force) {
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

        // ユーザーのメールアドレスを取得
        const userEmail = emailAddress;

        // メンバー情報を取得（ユーザー名を取得するため）
        const membersSnapshot = await db
          .collection('members')
          .where('roomId', '==', settingRoomId)
          .get();

        let userName: string | undefined;
        membersSnapshot.forEach((doc) => {
          const memberData = doc.data();
          if (memberData.email === userEmail && memberData.name) {
            userName = memberData.name;
          }
        });

        // すぐやるタスクを取得（上位5つ）
        const quickTasks = await getQuickTasksForUser(
          settingRoomId,
          settingRoomDocId,
          userEmail,
          userName,
          7 // 7日間
        );

        if (quickTasks.length === 0) {
          console.log(`📭 すぐやるタスクなし`);
          results.push({
            userId: settingUserId,
            success: true,
            taskCount: 0,
            message: 'すぐやるタスクなし',
          });
          continue;
        }

        console.log(`📋 すぐやるタスク数: ${quickTasks.length}件`);

        // メール送信
        try {
          const taskList = quickTasks
            .map(
              (task, index) => `
            <div style="background-color:#f8f9fa;padding:15px;margin:10px 0;border-radius:8px;border-left:4px solid #1976d2;">
              <h3 style="margin:0 0 10px;">${index + 1}. ${task.taskName}</h3>
              <p style="margin:5px 0;"><strong>期日:</strong> ${
                task.dueDate
              }</p>
              <p style="margin:5px 0;"><strong>プロジェクト:</strong> ${
                task.projectName
              }</p>
              <p style="margin:5px 0;"><strong>ステータス:</strong> ${
                task.status
              }</p>
            </div>`
            )
            .join('');

          const msg = {
            to: emailAddress,
            from: fromEmail,
            subject: `【日次リマインダー】期限が近いタスクが${quickTasks.length}件あります`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#1976d2;">📋 日次リマインダー</h2>
                <p>期限が近いタスクが${quickTasks.length}件あります。以下をご確認ください。</p>
                ${taskList}
                <p style="color:#999;font-size:12px;margin-top:20px;">
                  このメールはタスク管理アプリから自動送信されました。
                </p>
              </div>
            `,
          };
          await sgMail.send(msg);
          console.log(
            `✅ 日次リマインダーメール送信成功: ${emailAddress} (${quickTasks.length}件)`
          );
          results.push({
            userId: settingUserId,
            success: true,
            taskCount: quickTasks.length,
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
        message: '日次リマインダーの手動実行が完了しました',
        currentTime,
        results,
      };
    } catch (error: any) {
      console.error('❌ 日次リマインダー手動実行エラー:', error);
      throw new HttpsError('internal', `エラー: ${error.message}`);
    }
  }
);

export { addTaskToCalendar } from './calendarSync';
