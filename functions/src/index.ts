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

    for (const daysBefore of daysBeforeList) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysBefore);
      const targetDateStr = targetDate.toISOString().split('T')[0];

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
 * ユーザーごとにタスクをグループ化
 */
function groupTasksByUser(tasks: any[]): { [email: string]: any[] } {
  const grouped: { [email: string]: any[] } = {};
  tasks.forEach((task) => {
    const email = task.assigneeEmail || task.assignee;
    if (!email) return;
    if (!grouped[email]) grouped[email] = [];
    grouped[email].push(task);
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

    const tasksByUser = groupTasksByUser(upcomingTasks);
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

export const sendUserTaskNotificationsManual = onCall(
  { secrets: [sendgridApiKey, sendgridFromEmail], cors: true },
  async () => {
    console.log('🕙 ユーザー個別通知手動送信');
  }
);

export { addTaskToCalendar } from './calendarSync';
