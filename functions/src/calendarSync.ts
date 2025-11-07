import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { google } from 'googleapis';

/**
 * Googleカレンダーにタスクを追加するCloud Function
 */
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

      // 🔸 必須パラメータのバリデーション
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

      // 🔸 OAuth2 クライアントを初期化
      const oauth2Client = new google.auth.OAuth2();

      // アクセストークンを設定
      oauth2Client.setCredentials({ access_token: userAccessToken });
      console.log('🔑 OAuth2クライアントにアクセストークンを設定しました');

      // Google Calendar API クライアントを作成
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // 🔸 期日を終日イベントとして設定（1日だけのイベント）
      // Googleカレンダーの終日イベントでは、end.dateは「含まれない」日付を指定する
      // 例：期日が11/1の場合 → start.date: 2024-11-01, end.date: 2024-11-02
      // これにより、Googleカレンダーには「11/1終日」として表示される

      // dueDateから時刻部分を除去し、YYYY-MM-DD形式のみを抽出
      // 例: "2024-11-07T00:00:00.000Z" → "2024-11-07"
      // 例: "2024-11-07" → "2024-11-07"
      // 例: "2024-11-07 09:00:00" → "2024-11-07"
      let dateOnly = String(dueDate).trim();
      // 時刻やタイムゾーンを除去（T、スペース、時刻部分を削除）
      if (dateOnly.includes('T')) {
        dateOnly = dateOnly.split('T')[0];
      } else if (dateOnly.includes(' ')) {
        dateOnly = dateOnly.split(' ')[0];
      }
      // YYYY-MM-DD形式であることを確認（10文字である必要がある）
      if (dateOnly.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
        throw new HttpsError(
          'invalid-argument',
          `期日の形式が不正です: ${dueDate}。YYYY-MM-DD形式である必要があります。`
        );
      }
      const startDate = dateOnly; // YYYY-MM-DD形式（例：2024-11-01）

      // 終了日は開始日の翌日（終日イベントの場合、終了日は含まれないため、これで1日だけの終日イベントになる）
      // タイムゾーンの問題を避けるため、文字列操作で日付を計算
      const [year, month, day] = dateOnly.split('-').map(Number);

      // 日付を1日進める（月の境界や年の境界も考慮）
      // うるう年も考慮して月の日数を取得
      const isLeapYear =
        (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      const daysInMonth = [
        31,
        isLeapYear ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
      ][month - 1];

      let endYear = year;
      let endMonth = month;
      let endDay = day + 1;

      if (endDay > daysInMonth) {
        endDay = 1;
        endMonth += 1;
        if (endMonth > 12) {
          endMonth = 1;
          endYear += 1;
        }
      }

      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(
        endDay
      ).padStart(2, '0')}`; // YYYY-MM-DD形式

      console.log('📅 日時変換結果:', {
        inputDate: dueDate,
        dateOnly,
        startDate,
        endDate,
      });

      // 🔸 イベント情報を構築（終日イベントとして設定）
      // 終日イベントの場合、dateTimeやtimeZoneは使用しない（dateのみを使用）
      // 明示的に終日イベントとして作成するため、startとendオブジェクトにはdateのみを含める
      const event: {
        summary: string;
        description: string;
        start: { date: string };
        end: { date: string };
      } = {
        summary: `${taskName}（期日：${dateOnly}）`,
        description: `タスク: ${taskName}\n期日: ${dateOnly}`,
        start: {
          date: startDate, // 終日イベントの場合は date のみを使用（dateTimeやtimeZoneは含めない）
        },
        end: {
          date: endDate, // 開始日の翌日を指定（1日だけの終日イベント、dateTimeやtimeZoneは含めない）
        },
      };

      // イベントオブジェクトにdateTimeやtimeZoneが含まれていないことを確認
      if (
        'dateTime' in event.start ||
        'dateTime' in event.end ||
        'timeZone' in event.start ||
        'timeZone' in event.end
      ) {
        throw new Error(
          'イベントオブジェクトにdateTimeやtimeZoneが含まれています。終日イベントにはdateのみを使用してください。'
        );
      }

      console.log('📝 イベントリソース:', JSON.stringify(event, null, 2));
      console.log('🔍 イベント検証:', {
        startHasDate: 'date' in event.start,
        startHasDateTime: 'dateTime' in event.start,
        startHasTimeZone: 'timeZone' in event.start,
        endHasDate: 'date' in event.end,
        endHasDateTime: 'dateTime' in event.end,
        endHasTimeZone: 'timeZone' in event.end,
      });

      // 🔹 Google Calendar にイベントを追加
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event, // ✅ resource → requestBody に変更
      });

      // レスポンスからイベントの詳細を確認（デバッグ用）
      const createdEvent = response.data;
      console.log('✅ Google Calendar API レスポンス:', {
        eventId: createdEvent.id,
        status: response.status,
        statusText: response.statusText,
        created: createdEvent.created,
        start: createdEvent.start,
        end: createdEvent.end,
        allDay: !createdEvent.start.dateTime && !createdEvent.end.dateTime, // 終日イベントかどうか
      });

      // 終日イベントとして作成されたか確認
      if (createdEvent.start?.dateTime || createdEvent.end?.dateTime) {
        console.warn('⚠️ 警告: イベントが時刻付きとして作成されました。', {
          start: createdEvent.start,
          end: createdEvent.end,
        });
      }

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

      // 🔸 詳細エラー出力
      if (error?.errors && Array.isArray(error.errors)) {
        console.error('❌ Google API エラー詳細:', error.errors);
      }

      // 認証エラー
      if (error?.statusCode === 401 || error?.code === 'UNAUTHENTICATED') {
        console.error(
          '🔐 認証エラー: アクセストークンが無効または期限切れです'
        );
        throw new HttpsError(
          'unauthenticated',
          'Google認証が無効です。アクセストークンが期限切れの可能性があります。'
        );
      }

      // 権限エラー
      if (error?.statusCode === 403 || error?.code === 'PERMISSION_DENIED') {
        console.error(
          '🚫 権限エラー: Google Calendar へのアクセス権限がありません'
        );
        throw new HttpsError(
          'permission-denied',
          'Google Calendarへのアクセス権限がありません。'
        );
      }

      // 不正リクエスト
      if (error?.statusCode === 400 || error?.code === 'INVALID_ARGUMENT') {
        console.error('📋 リクエストエラー:', error.message);
        throw new HttpsError(
          'invalid-argument',
          `リクエストが不正です: ${error.message}`
        );
      }

      // 予期しないエラー
      if (error instanceof HttpsError) throw error;

      console.error('⚠️ 予期しないエラーが発生しました:', {
        errorType: error?.constructor?.name,
        stack: error?.stack,
      });

      throw new HttpsError('unknown', 'カレンダー登録に失敗しました。', {
        originalMessage: error?.message,
        originalCode: error?.code,
      });
    }
  }
);
