import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

// Firebase Admin SDK を初期化
admin.initializeApp();

// シークレットの定義
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');
const sendgridFromEmail = defineSecret('SENDGRID_FROM_EMAIL');

// テスト通知を送信するCloud Function
export const sendTestEmail = onCall(
  { secrets: [sendgridApiKey, sendgridFromEmail] },
  async (request) => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '認証が必要です');
    }

    // SendGridの設定（改行文字を確実に除去）
    const rawApiKey = sendgridApiKey.value();
    const apiKey = rawApiKey
      .trim()
      .replace(/[\r\n\t\s]+/g, '')
      .replace(/\0/g, '');
    console.log('Raw API Key length:', rawApiKey.length);
    console.log(
      'Raw API Key chars:',
      rawApiKey
        .split('')
        .map((c) => c.charCodeAt(0))
        .slice(-10)
    );
    console.log('Cleaned API Key length:', apiKey.length);
    console.log('API Key starts with SG:', apiKey.startsWith('SG.'));
    console.log('API Key ends with:', apiKey.slice(-5));

    // APIキーの検証
    if (!apiKey || !apiKey.startsWith('SG.')) {
      console.error('Invalid SendGrid API key');
      throw new HttpsError('internal', 'SendGrid APIキーが無効です');
    }

    sgMail.setApiKey(apiKey);

    const { email } = request.data;

    if (!email) {
      throw new HttpsError('invalid-argument', 'メールアドレスが必要です');
    }

    try {
      const rawFromEmail =
        sendgridFromEmail.value() || 'noreply@taskmanager.com';
      const fromEmail = rawFromEmail
        .trim()
        .replace(/[\r\n\t\s]+/g, '')
        .replace(/\0/g, '');
      console.log('Sending email to:', email);
      console.log('From email:', fromEmail);

      // 送信者と受信者が同じ場合はエラー
      if (fromEmail === email) {
        throw new HttpsError(
          'invalid-argument',
          '送信者と受信者のメールアドレスが同じです'
        );
      }

      const msg = {
        to: email,
        from: fromEmail,
        subject: '【テスト通知】タスク管理アプリ',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; 
             margin: 0 auto;">
          <h2 style="color: #1976d2;">タスク管理アプリ</h2>
          <div style="background-color: #f5f5f5; padding: 20px; 
               border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">テスト通知</h3>
            <p style="color: #666; line-height: 1.6;">
              このメールは通知設定のテスト送信です。<br>
              メールが正常に受信できていることを確認してください。
            </p>
            <div style="background-color: #e8f5e8; padding: 15px; 
                 border-radius: 5px; margin: 15px 0;">
              <p style="color: #2e7d32; margin: 0;">
                ✅ 通知設定が正常に動作しています！
              </p>
            </div>
          </div>
          <p style="color: #999; font-size: 12px;">
            このメールはタスク管理アプリから自動送信されました。
          </p>
        </div>
      `,
      };

      console.log('Attempting to send email...');
      console.log('Message details:', JSON.stringify(msg, null, 2));
      console.log(
        'SendGrid API Key (first 10 chars):',
        apiKey.substring(0, 10)
      );
      console.log(
        'SendGrid API Key (last 10 chars):',
        apiKey.substring(apiKey.length - 10)
      );

      // SendGridの設定を確認
      console.log('SendGrid client configured:', !!sgMail);

      const [response] = await sgMail.send(msg);

      if (response && response.statusCode === 202) {
        console.log('✅ SendGrid送信成功: statusCode 202');
      } else {
        console.warn('⚠️ SendGrid送信応答:', response?.statusCode);
      }

      // テスト通知ログを記録（失敗しても関数全体を落とさない）
      await admin
        .firestore()
        .collection('notificationLogs')
        .add({
          userId: request.auth?.uid || 'anonymous',
          type: 'test_email_notification',
          channel: 'email',
          status: 'sent',
          message: 'テスト通知送信',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch((e) => {
          console.warn(
            '⚠️ Firestore sent-log failed (non fatal):',
            e?.message || e
          );
        });

      return { success: true, message: 'テスト通知を送信しました' };
    } catch (error) {
      console.error('テストメール送信エラー:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });

      // SendGridのエラー詳細を表示
      if (error && typeof error === 'object' && 'response' in error) {
        const sendgridError = error as {
          response?: { body?: unknown; headers?: unknown };
        };
        console.error('SendGrid Error Response:', sendgridError.response?.body);
        console.error(
          'SendGrid Error Headers:',
          sendgridError.response?.headers
        );
      }

      await admin
        .firestore()
        .collection('notificationLogs')
        .add({
          userId: request.auth?.uid || 'anonymous',
          type: 'test_email_notification',
          channel: 'email',
          status: 'failed',
          message: 'テスト通知送信',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch((e) => {
          console.warn(
            '⚠️ Firestore error-log failed (non fatal):',
            e?.message || e
          );
        });

      throw new HttpsError('internal', 'テスト通知の送信に失敗しました');
    }
  }
);

/**
 * 期限が近いタスクを取得する関数
 * @return {Promise<any[]>} 期限が近いタスクの配列
 */
async function getUpcomingTasks(): Promise<any[]> {
  try {
    const db = admin.firestore();
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // 今日から明日までの期限のタスクを取得
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log('期限チェック範囲:', todayStr, '〜', tomorrowStr);

    // 全プロジェクトのタスクを取得
    const projectsSnapshot = await db.collection('projects').get();
    const allTasks: any[] = [];

    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id;
      const projectData = projectDoc.data();

      const tasksSnapshot = await db
        .collection(`projects/${projectId}/tasks`)
        .where('dueDate', '>=', todayStr)
        .where('dueDate', '<=', tomorrowStr)
        .get();

      tasksSnapshot.docs.forEach((taskDoc) => {
        const taskData = taskDoc.data();
        // ステータスでフィルタリング（クライアント側）
        if (taskData.status === '未着手' || taskData.status === '作業中') {
          allTasks.push({
            id: taskDoc.id,
            projectId: projectId,
            projectName: projectData.projectName || 'プロジェクト',
            ...taskData,
          });
        }
      });
    }

    // 期限でソートして上位3件に制限
    allTasks.sort((a, b) => {
      if (a.dueDate < b.dueDate) return -1;
      if (a.dueDate > b.dueDate) return 1;
      return 0;
    });

    console.log('期限が近いタスク数:', allTasks.length);
    return allTasks.slice(0, 3);
  } catch (error) {
    console.error('期限が近いタスクの取得エラー:', error);
    return [];
  }
}

/**
 * ユーザーごとにタスクをグループ化する関数
 * @param {any[]} tasks タスクの配列
 * @return {Object<string, any[]>} ユーザーごとにグループ化されたタスク
 */
function groupTasksByUser(tasks: any[]): { [email: string]: any[] } {
  const grouped: { [email: string]: any[] } = {};

  tasks.forEach((task) => {
    if (task.assignee) {
      if (!grouped[task.assignee]) {
        grouped[task.assignee] = [];
      }
      grouped[task.assignee].push(task);
    }
  });

  // 各ユーザーのタスクを上位3件に制限
  Object.keys(grouped).forEach((email) => {
    grouped[email] = grouped[email].slice(0, 3);
  });

  return grouped;
}

/**
 * タスクリマインダーメールのHTMLを生成する関数
 * @param {any[]} tasks タスクの配列
 * @return {string} HTML文字列
 */
function generateTaskReminderHTML(tasks: any[]): string {
  const taskList = tasks
    .map(
      (task, index) => `
    <div style="background-color: #f8f9fa; padding: 15px; margin: 10px 0; 
                border-radius: 8px; border-left: 4px solid #007bff;">
      <h3 style="color: #333; margin: 0 0 10px 0; font-size: 16px;">
        ${index + 1}. ${task.taskName || 'タスク名なし'}
      </h3>
      <p style="color: #666; margin: 5px 0; font-size: 14px;">
        <strong>プロジェクト:</strong> ${
          task.projectName || 'プロジェクト名なし'
        }
      </p>
      <p style="color: #666; margin: 5px 0; font-size: 14px;">
        <strong>期限:</strong> ${task.dueDate || '期限なし'}
      </p>
      <p style="color: #666; margin: 5px 0; font-size: 14px;">
        <strong>ステータス:</strong> ${task.status || '未設定'}
      </p>
      <p style="color: #666; margin: 5px 0; font-size: 14px;">
        <strong>優先度:</strong> ${task.priority || '未設定'}
      </p>
    </div>
  `
    )
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; 
                margin: 0 auto; background-color: #ffffff;">
      <div style="background-color: #1976d2; color: white; padding: 20px; 
                  text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">📋 タスク管理アプリ</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px;">期限が近いタスクのお知らせ</p>
      </div>
      
      <div style="padding: 20px; background-color: #ffffff;">
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          こんにちは！<br>
          以下のタスクの期限が近づいています。確認をお願いします。
        </p>
        
        ${taskList}
        
        <div style="background-color: #e8f5e8; padding: 15px; 
                    border-radius: 8px; margin: 20px 0;">
          <p style="color: #2e7d32; margin: 0; font-weight: bold;">
            💡 ヒント: アプリでタスクの詳細を確認し、進捗を更新しましょう！
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://your-app-domain.com" 
             style="background-color: #1976d2; color: white; 
                    padding: 12px 24px; text-decoration: none; 
                    border-radius: 5px; font-weight: bold; 
                    display: inline-block;">
            アプリを開く
          </a>
        </div>
      </div>
      
      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; 
                  border-radius: 0 0 8px 8px;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          このメールはタスク管理アプリから自動送信されました。<br>
          通知設定はアプリ内の設定画面で変更できます。
        </p>
      </div>
    </div>
  `;
}

// 毎朝10時に期限が近いタスクのメール通知を送信
export const sendDailyTaskReminders = onSchedule(
  {
    schedule: '0 10 * * *', // 毎日10:00
    timeZone: 'Asia/Tokyo',
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async () => {
    console.log('🕙 期限が近いタスクのメール通知を開始');

    try {
      // SendGridの設定
      const rawApiKey = sendgridApiKey.value();
      const apiKey = rawApiKey
        .trim()
        .replace(/[\r\n\t\s]+/g, '')
        .replace(/\0/g, '');

      if (!apiKey || !apiKey.startsWith('SG.')) {
        console.error('Invalid SendGrid API key');
        return;
      }

      sgMail.setApiKey(apiKey);

      // 期限が近いタスクを取得
      const upcomingTasks = await getUpcomingTasks();

      if (upcomingTasks.length === 0) {
        console.log('期限が近いタスクはありません');
        return;
      }

      // ユーザーごとにタスクをグループ化
      const tasksByUser = groupTasksByUser(upcomingTasks);

      console.log('通知対象ユーザー数:', Object.keys(tasksByUser).length);

      // 各ユーザーにメール送信
      const fromEmail = sendgridFromEmail.value() || 'noreply@taskmanager.com';
      const sendPromises = Object.entries(tasksByUser).map(
        async ([email, userTasks]) => {
          try {
            const msg = {
              to: email,
              from: fromEmail,
              subject: `【期限間近】${userTasks.length}件のタスクが期限間近です`,
              html: generateTaskReminderHTML(userTasks),
            };

            await sgMail.send(msg);
            console.log(
              `✅ メール送信成功: ${email} (${userTasks.length}件のタスク)`
            );

            // 送信ログを記録
            await admin
              .firestore()
              .collection('notificationLogs')
              .add({
                userId: 'system',
                type: 'daily_task_reminder',
                channel: 'email',
                status: 'sent',
                message: `期限間近タスク通知を送信 (${userTasks.length}件)`,
                recipientEmail: email,
                taskCount: userTasks.length,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
          } catch (error) {
            console.error(`❌ メール送信失敗: ${email}`, error);

            // エラーログを記録
            await admin
              .firestore()
              .collection('notificationLogs')
              .add({
                userId: 'system',
                type: 'daily_task_reminder',
                channel: 'email',
                status: 'failed',
                message: '期限間近タスク通知送信失敗',
                recipientEmail: email,
                errorMessage:
                  error instanceof Error ? error.message : 'Unknown error',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
          }
        }
      );

      // すべてのメール送信を並列実行
      await Promise.all(sendPromises);

      console.log('✅ 期限が近いタスクのメール通知完了');
    } catch (error) {
      console.error('❌ 期限が近いタスクのメール通知エラー:', error);
    }
  }
);

// 手動で期限が近いタスクのメール通知を送信（テスト用）
export const sendTaskRemindersManual = onCall(
  { secrets: [sendgridApiKey, sendgridFromEmail] },
  async (request) => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '認証が必要です');
    }

    console.log('🕙 手動で期限が近いタスクのメール通知を開始');

    try {
      // SendGridの設定
      const rawApiKey = sendgridApiKey.value();
      const apiKey = rawApiKey
        .trim()
        .replace(/[\r\n\t\s]+/g, '')
        .replace(/\0/g, '');

      if (!apiKey || !apiKey.startsWith('SG.')) {
        console.error('Invalid SendGrid API key');
        throw new HttpsError('internal', 'SendGrid APIキーが無効です');
      }

      sgMail.setApiKey(apiKey);

      // 期限が近いタスクを取得
      const upcomingTasks = await getUpcomingTasks();

      if (upcomingTasks.length === 0) {
        return {
          success: true,
          message: '期限が近いタスクはありません',
          taskCount: 0,
        };
      }

      // ユーザーごとにタスクをグループ化
      const tasksByUser = groupTasksByUser(upcomingTasks);

      console.log('通知対象ユーザー数:', Object.keys(tasksByUser).length);

      // 各ユーザーにメール送信
      const fromEmail = sendgridFromEmail.value() || 'noreply@taskmanager.com';
      const sendPromises = Object.entries(tasksByUser).map(
        async ([email, userTasks]) => {
          try {
            const msg = {
              to: email,
              from: fromEmail,
              subject: `【期限間近】${userTasks.length}件のタスクが期限間近です`,
              html: generateTaskReminderHTML(userTasks),
            };

            await sgMail.send(msg);
            console.log(
              `✅ メール送信成功: ${email} (${userTasks.length}件のタスク)`
            );

            // 送信ログを記録
            await admin
              .firestore()
              .collection('notificationLogs')
              .add({
                userId: request.auth?.uid || 'manual',
                type: 'manual_task_reminder',
                channel: 'email',
                status: 'sent',
                message: `期限間近タスク通知を手動送信 (${userTasks.length}件)`,
                recipientEmail: email,
                taskCount: userTasks.length,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
          } catch (error) {
            console.error(`❌ メール送信失敗: ${email}`, error);

            // エラーログを記録
            await admin
              .firestore()
              .collection('notificationLogs')
              .add({
                userId: request.auth?.uid || 'manual',
                type: 'manual_task_reminder',
                channel: 'email',
                status: 'failed',
                message: '期限間近タスク通知手動送信失敗',
                recipientEmail: email,
                errorMessage:
                  error instanceof Error ? error.message : 'Unknown error',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
          }
        }
      );

      // すべてのメール送信を並列実行
      await Promise.all(sendPromises);

      console.log('✅ 手動での期限が近いタスクのメール通知完了');

      return {
        success: true,
        message: '期限が近いタスクのメール通知を送信しました',
        taskCount: upcomingTasks.length,
        userCount: Object.keys(tasksByUser).length,
      };
    } catch (error) {
      console.error('❌ 手動での期限が近いタスクのメール通知エラー:', error);
      throw new HttpsError(
        'internal',
        '期限が近いタスクのメール通知送信に失敗しました'
      );
    }
  }
);
