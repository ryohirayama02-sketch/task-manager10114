import { Injectable } from '@angular/core';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { environment } from '../../environments/environment';

import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class TaskReminderService {
  private app = getApps().length
    ? getApp()
    : initializeApp(environment.firebase);
  private functions = getFunctions(this.app, 'us-central1'); // ← ★ここが重要！

  constructor(private authService: AuthService) {}

  /**
   * 手動で期限が近いタスクのメール通知を送信
   */
  async sendTaskReminders(): Promise<{
    success: boolean;
    message: string;
    taskCount: number;
    userCount: number;
  }> {
    try {
      console.log('🔔 期限が近いタスクのメール通知を手動送信開始');
      const roomId = this.authService.getCurrentRoomId();
      const roomDocId = this.authService.getCurrentRoomDocId();
      if (!roomId || !roomDocId) {
        throw new Error('ルーム情報が設定されていません');
      }

      // ✅ us-central1 の関数を明示的に指定
      const sendTaskRemindersManual = httpsCallable(
        this.functions,
        'sendTaskRemindersManual'
      );

      const result = await sendTaskRemindersManual({ roomId, roomDocId });
      console.log('✅ 期限が近いタスクのメール通知送信完了:', result);
      return result.data as {
        success: boolean;
        message: string;
        taskCount: number;
        userCount: number;
      };
    } catch (error) {
      console.error('❌ 期限が近いタスクのメール通知送信エラー:', error);
      throw error;
    }
  }
}
