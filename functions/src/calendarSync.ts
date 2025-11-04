import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { google } from 'googleapis';

export const addTaskToCalendar = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    try {
      const { taskName, dueDate, userAccessToken } = request.data || {};

      console.log('📨 受け取ったパラメータ:', {
        taskName,
        dueDate,
        hasUserAccessToken: !!userAccessToken,
      });

      // バリデーション: 必須パラメータの確認
      if (!taskName || !dueDate || !userAccessToken) {
        console.error('❌ 必須パラメータが不足しています:', {
          taskName: !taskName ? '不足' : '✓',
          dueDate: !dueDate ? '不足' : '✓',
          userAccessToken: !userAccessToken ? '不足' : '✓',
        });
        throw new HttpsError(
          'invalid-argument',
          'taskName/dueDate/userAccessToken は必須です。'
        );
      }

      console.log('✅ バリデーション成功');

      // OAuth2 クライアントを初期化
      const oauth2Client = new google.auth.OAuth2();

      // ユーザーのアクセストークンを設定
      oauth2Client.setCredentials({ access_token: userAccessToken });

      console.log('🔑 OAuth2クライアントにアクセストークンを設定しました');

      // Google Calendar API クライアントを作成
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // 期日を Date オブジェクトに変換
      const dueDateObj = new Date(dueDate);
      const startDate = dueDateObj.toISOString();
      const endDate = new Date(
        dueDateObj.getTime() + 24 * 60 * 60 * 1000
      ).toISOString();

      console.log('📅 日時変換結果:', {
        inputDate: dueDate,
        startDate,
        endDate,
      });

      // イベントリソースを構築
      const event = {
        summary: `${taskName}（期日：${dueDate}）`,
        description: `タスク: ${taskName}\n期日: ${dueDate}`,
        start: {
          dateTime: startDate,
          timeZone: 'Asia/Tokyo',
        },
        end: {
          dateTime: endDate,
          timeZone: 'Asia/Tokyo',
        },
      };

      console.log('📝 イベントリソース:', JSON.stringify(event, null, 2));

      // Google Calendar にイベントを追加
      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });

      console.log('✅ Google Calendar API レスポンス:', {
        eventId: response.data.id,
        status: response.status,
        statusText: response.statusText,
        created: response.data.created,
      });

      return {
        success: true,
        message: 'イベントをGoogleカレンダーに追加しました',
        eventId: response.data.id,
        eventUrl: response.data.htmlLink,
      };
    } catch (error: any) {
      console.error('❌ エラーが発生しました:', {
        message: error?.message,
        code: error?.code,
        statusCode: error?.statusCode,
        errors: error?.errors,
      });

      // エラーの詳細ログを出力
      if (error?.errors && Array.isArray(error.errors)) {
        console.error('❌ Google API エラー詳細:', error.errors);
      }

      // Google Calendar API の認証エラー
      if (error?.statusCode === 401 || error?.code === 'UNAUTHENTICATED') {
        console.error('🔐 認証エラー: アクセストークンが無効または期限切れです');
        throw new HttpsError(
          'unauthenticated',
          'Google認証が無効です。アクセストークンが期限切れの可能性があります。'
        );
      }

      // Google Calendar API の権限エラー
      if (error?.statusCode === 403 || error?.code === 'PERMISSION_DENIED') {
        console.error('🚫 権限エラー: Google Calendar へのアクセス権限がありません');
        throw new HttpsError(
          'permission-denied',
          'Google Calendarへのアクセス権限がありません。'
        );
      }

      // Google Calendar API のリクエストエラー
      if (error?.statusCode === 400 || error?.code === 'INVALID_ARGUMENT') {
        console.error('📋 リクエストエラー:', error.message);
        throw new HttpsError(
          'invalid-argument',
          `リクエストが不正です: ${error.message}`
        );
      }

      // その他の Google Calendar API エラー
      if (error instanceof HttpsError) {
        throw error;
      }

      // 予期しないエラー
      console.error('⚠️ 予期しないエラーが発生しました:', {
        errorType: error?.constructor?.name,
        stack: error?.stack,
      });

      throw new HttpsError(
        'unknown',
        'カレンダー登録に失敗しました。',
        {
          originalMessage: error?.message,
          originalCode: error?.code,
        }
      );
    }
  }
);
