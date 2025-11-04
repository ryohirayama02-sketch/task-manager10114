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
    const { taskName, dueDate, userAccessToken } = request.data || {};

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }
    if (!taskName || !dueDate || !userAccessToken) {
      throw new HttpsError(
        'invalid-argument',
        'taskName/dueDate/userAccessToken は必須です。'
      );
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID.value(),
        GOOGLE_CLIENT_SECRET.value(),
        'https://kensyu10114.web.app'
      );
      oauth2Client.setCredentials({ access_token: userAccessToken });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: `${taskName}（期日）`,
          start: { date: dueDate },
          end: { date: dueDate },
        },
      });

      return {
        success: true,
        message: 'Googleカレンダーに予定を追加しました。',
      };
    } catch (e: any) {
      console.error('❌ Googleカレンダー登録エラー:', e);
      throw new HttpsError('unknown', 'カレンダー登録に失敗しました。', e);
    }
  }
);
