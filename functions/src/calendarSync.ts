import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

if (!admin.apps.length) admin.initializeApp();

// Secrets（v2は defineSecret で宣言）
const GOOGLE_CLIENT_ID = defineSecret('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = defineSecret('GOOGLE_CLIENT_SECRET');

export const addTaskToCalendar = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
    secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET],
  },
  async (request) => {
    const { taskName, dueDate } = request.data || {};

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }
    if (!taskName || !dueDate) {
      throw new HttpsError('invalid-argument', 'taskName/dueDate は必須です。');
    }

    try {
      const userId = request.auth.uid;
      const db = admin.firestore();

      // Firestore から ユーザーの Google OAuth トークンを取得
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();

      if (!userData?.googleRefreshToken) {
        throw new HttpsError(
          'failed-precondition',
          'Google カレンダーにアクセスするための認証情報が見つかりません。Google カレンダーを連携してください。'
        );
      }

      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID.value(),
        GOOGLE_CLIENT_SECRET.value(),
        'https://kensyu10114.web.app'
      );

      // リフレッシュトークンを使ってアクセストークンを取得
      oauth2Client.setCredentials({
        refresh_token: userData.googleRefreshToken,
      });
      const { credentials } = await oauth2Client.refreshAccessToken();

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // 期日を Date オブジェクトに変換
      const dueDateObj = new Date(dueDate);
      const formattedDueDate = dueDateObj.toISOString().split('T')[0];

      await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: `${taskName}　期日`,
          description: `タスク: ${taskName}`,
          start: { date: formattedDueDate },
          end: { date: formattedDueDate },
        },
      });

      return {
        success: true,
        message: 'Googleカレンダーに予定を追加しました。',
      };
    } catch (e: any) {
      console.error('❌ Googleカレンダー登録エラー:', e);
      if (e.statusCode === 401) {
        throw new HttpsError(
          'unauthenticated',
          'Google認証が無効です。再度Google連携を行ってください。'
        );
      }
      throw new HttpsError('unknown', 'カレンダー登録に失敗しました。', e);
    }
  }
);
