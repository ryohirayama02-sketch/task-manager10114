import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  constructor(private auth: Auth, private functions: Functions) {}

  /**
   * Google OAuth認証フローを開始し、アクセストークンを取得します
   */
  async getGoogleAccessToken(): Promise<string> {
    try {
      const provider = new GoogleAuthProvider();
      // Google Calendar スコープを追加
      provider.addScope('https://www.googleapis.com/auth/calendar');

      const result = await signInWithPopup(this.auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (!credential?.accessToken) {
        throw new Error('アクセストークンの取得に失敗しました');
      }

      console.log('✅ アクセストークン取得成功');
      return credential.accessToken;
    } catch (error) {
      console.error('❌ Google OAuth 認証エラー:', error);
      throw new Error('Google 認証に失敗しました');
    }
  }

  /**
   * Googleカレンダーにタスクを追加します
   * @param taskName タスクの名前
   * @param dueDate タスクの期日 (YYYY-MM-DD 形式)
   */
  async addTaskToCalendar(taskName: string, dueDate: string): Promise<any> {
    try {
      // Google OAuth アクセストークンを取得
      console.log('🔄 Google認証フローを開始します...');
      const userAccessToken = await this.getGoogleAccessToken();

      console.log('📊 送信パラメータ:', {
        taskName,
        dueDate,
        userAccessToken: userAccessToken ? '***' : 'null',
      });

      // Firebase Cloud Functions を呼び出す
      // Functions側は taskName / dueDate / userAccessToken を期待
      const addTaskToCalendarFn = httpsCallable(
        this.functions,
        'addTaskToCalendar'
      );

      console.log('📡 Firebase Cloud Functions を呼び出します...');
      const result = await addTaskToCalendarFn({
        taskName,
        dueDate,
        userAccessToken,
      });

      console.log('✅ Cloud Functions レスポンス:', result.data);
      return result.data;
    } catch (error: any) {
      const errorMessage = this.formatErrorMessage(error);
      console.error('❌ カレンダー連携エラー:', {
        originalError: error,
        formattedMessage: errorMessage,
      });
      throw new Error(errorMessage);
    }
  }

  /**
   * エラーメッセージを人間が読める形式に整形します
   */
  private formatErrorMessage(error: any): string {
    // Firebase Functions エラー
    if (error?.code) {
      switch (error.code) {
        case 'unauthenticated':
          return 'Google認証が無効です。アクセストークンが期限切れの可能性があります。再度Google連携を行ってください。';
        case 'permission-denied':
          return 'Google Calendarへのアクセス権限がありません。';
        case 'invalid-argument':
          return `リクエストが不正です: ${error.message}`;
        case 'unknown':
          return 'カレンダー登録に失敗しました。';
        default:
          return `エラーが発生しました: ${error.message}`;
      }
    }

    // Error オブジェクトの場合
    if (error instanceof Error) {
      return error.message;
    }

    // デフォルトのエラーメッセージ
    if (typeof error === 'string') {
      return error;
    }

    return 'Googleカレンダー連携中にエラーが発生しました。';
  }
}
