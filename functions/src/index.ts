import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import axios from 'axios';

// Firebase Admin SDK を初期化
admin.initializeApp();

// メール送信用のトランスポーター（実際の設定は環境変数で管理）
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().email?.user,
    pass: functions.config().email?.password,
  },
});

// メール通知を送信するCloud Function
export const sendEmailNotification = functions.https.onCall(
  async (data: any, context: any) => {
    // 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }

    const { to, subject, message } = data;

    if (!to || !subject || !message) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '必要なパラメータが不足しています'
      );
    }

    try {
      const mailOptions = {
        from: functions.config().email?.user,
        to: to,
        subject: subject,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; 
             margin: 0 auto;">
          <h2 style="color: #1976d2;">タスク管理アプリ</h2>
          <div style="background-color: #f5f5f5; padding: 20px; 
               border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">${subject}</h3>
            <p style="color: #666; line-height: 1.6;">${message}</p>
          </div>
          <p style="color: #999; font-size: 12px;">
            このメールはタスク管理アプリから自動送信されました。
          </p>
        </div>
      `,
      };

      await transporter.sendMail(mailOptions);

      // 通知ログを記録
      await admin.firestore().collection('notificationLogs').add({
        userId: context.auth.uid,
        type: 'email_notification',
        channel: 'email',
        status: 'sent',
        message: message,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error('メール送信エラー:', error);

      // エラーログを記録
      await admin
        .firestore()
        .collection('notificationLogs')
        .add({
          userId: context.auth.uid,
          type: 'email_notification',
          channel: 'email',
          status: 'failed',
          message: message,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      throw new functions.https.HttpsError(
        'internal',
        'メール送信に失敗しました'
      );
    }
  }
);

// Slack通知を送信するCloud Function
export const sendSlackNotification = functions.https.onCall(
  async (data: any, context: any) => {
    // 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }

    const { webhookUrl, message, channel } = data;

    if (!webhookUrl || !message) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '必要なパラメータが不足しています'
      );
    }

    try {
      const payload = {
        text: message,
        channel: channel || '#general',
        username: 'Task Manager Bot',
        icon_emoji: ':robot_face:',
      };

      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 200) {
        // 通知ログを記録
        await admin.firestore().collection('notificationLogs').add({
          userId: context.auth.uid,
          type: 'slack_notification',
          channel: 'slack',
          status: 'sent',
          message: message,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true };
      } else {
        throw new Error(`Slack API returned status: ${response.status}`);
      }
    } catch (error) {
      console.error('Slack通知エラー:', error);

      // エラーログを記録
      await admin
        .firestore()
        .collection('notificationLogs')
        .add({
          userId: context.auth.uid,
          type: 'slack_notification',
          channel: 'slack',
          status: 'failed',
          message: message,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      throw new functions.https.HttpsError(
        'internal',
        'Slack通知に失敗しました'
      );
    }
  }
);

// 定期実行でタスク期限をチェックするCloud Function
export const checkTaskDeadlines = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('Asia/Tokyo')
  .onRun(async (context: any) => {
    console.log('タスク期限チェックを開始します');

    try {
      const db = admin.firestore();
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // 期限切れタスクを取得
      const overdueTasks = await db
        .collection('tasks')
        .where('dueDate', '<', todayStr)
        .where('status', 'in', ['未着手', '作業中'])
        .get();

      // 期限が近いタスクを取得（1日後、3日後、7日後）
      const upcomingDates = [1, 3, 7].map((days) => {
        const date = new Date(today);
        date.setDate(today.getDate() + days);
        return date.toISOString().split('T')[0];
      });

      const upcomingTasks = await db
        .collection('tasks')
        .where('dueDate', 'in', upcomingDates)
        .where('status', 'in', ['未着手', '作業中'])
        .get();

      console.log(`期限切れタスク: ${overdueTasks.size}件`);
      console.log(`期限が近いタスク: ${upcomingTasks.size}件`);

      // 各ユーザーの通知設定を取得して通知を送信
      const allTasks = [...overdueTasks.docs, ...upcomingTasks.docs];
      const userIds = new Set<string>();

      allTasks.forEach((doc) => {
        const taskData = doc.data();
        if (taskData.assignee) {
          userIds.add(taskData.assignee);
        }
      });

      for (const userId of userIds) {
        try {
          const settingsDoc = await db
            .collection('notificationSettings')
            .where('userId', '==', userId)
            .limit(1)
            .get();

          if (settingsDoc.empty) continue;

          const settings = settingsDoc.docs[0].data();

          // 期限切れタスクの通知
          const userOverdueTasks = overdueTasks.docs.filter(
            (doc) => doc.data().assignee === userId
          );

          for (const taskDoc of userOverdueTasks) {
            const taskData = taskDoc.data();
            await sendTaskNotification(settings, taskData, 'deadline_passed');
          }

          // 期限が近いタスクの通知
          const userUpcomingTasks = upcomingTasks.docs.filter(
            (doc) => doc.data().assignee === userId
          );

          for (const taskDoc of userUpcomingTasks) {
            const taskData = taskDoc.data();
            const daysUntilDeadline = calculateDaysUntilDeadline(
              taskData.dueDate
            );

            if (
              settings.taskDeadlineNotifications?.daysBeforeDeadline?.includes(
                daysUntilDeadline
              )
            ) {
              await sendTaskNotification(
                settings,
                taskData,
                'deadline_approaching'
              );
            }
          }
        } catch (error) {
          console.error(`ユーザー ${userId} の通知処理エラー:`, error);
        }
      }

      console.log('タスク期限チェックが完了しました');
    } catch (error) {
      console.error('タスク期限チェックエラー:', error);
    }
  });

/**
 * タスク通知を送信するヘルパー関数
 * @param {any} settings - 通知設定
 * @param {any} taskData - タスクデータ
 * @param {string} type - 通知タイプ
 */
async function sendTaskNotification(
  settings: any,
  taskData: any,
  type: string
) {
  const template = getNotificationTemplate(type, taskData);

  // メール通知
  if (settings.notificationChannels?.email?.enabled) {
    try {
      await transporter.sendMail({
        from: functions.config().email?.user,
        to: settings.notificationChannels.email.address,
        subject: template.title,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; 
             margin: 0 auto;">
          <h2 style="color: #1976d2;">タスク管理アプリ</h2>
          <div style="background-color: #f5f5f5; padding: 20px; 
               border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">${template.title}</h3>
            <p style="color: #666; line-height: 1.6;">${template.message}</p>
          </div>
          <p style="color: #999; font-size: 12px;">
            このメールはタスク管理アプリから自動送信されました。
          </p>
        </div>
        `,
      });
    } catch (error) {
      console.error('メール通知エラー:', error);
    }
  }

  // Slack通知
  if (settings.notificationChannels?.slack?.enabled) {
    try {
      const payload = {
        text: `*${template.title}*\n${template.message}`,
        channel: settings.notificationChannels.slack.channel || '#general',
        username: 'Task Manager Bot',
        icon_emoji: ':robot_face:',
      };

      await axios.post(
        settings.notificationChannels.slack.webhookUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Slack通知エラー:', error);
    }
  }
}

/**
 * 通知テンプレートを取得するヘルパー関数
 * @param {string} type - 通知タイプ
 * @param {any} taskData - タスクデータ
 * @return {any} 通知テンプレート
 */
function getNotificationTemplate(type: string, taskData: any) {
  const templates: { [key: string]: any } = {
    deadline_approaching: {
      title: 'タスク期限が近づいています',
      message:
        `【${taskData.projectName}】${taskData.taskName} の期限が近づいています。` +
        `期限: ${taskData.dueDate}`,
    },
    deadline_passed: {
      title: 'タスク期限が過ぎています',
      message:
        `【${taskData.projectName}】${taskData.taskName} の期限が過ぎています。` +
        `期限: ${taskData.dueDate}`,
    },
  };

  return templates[type] || templates.deadline_approaching;
}

/**
 * 期限までの日数を計算するヘルパー関数
 * @param {string} dueDate - 期限日
 * @return {number} 期限までの日数
 */
function calculateDaysUntilDeadline(dueDate: string): number {
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
