import { Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({
  providedIn: 'root',
})
export class TaskReminderService {
  constructor(private functions: Functions) {}

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

      const sendTaskRemindersManual = httpsCallable(
        this.functions,
        'sendTaskRemindersManual'
      );
      const result = await sendTaskRemindersManual({});

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
