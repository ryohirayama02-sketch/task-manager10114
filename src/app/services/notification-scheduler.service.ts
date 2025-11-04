import { Injectable } from '@angular/core';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';
import {
  NotificationSettings,
  TaskNotificationData,
  NotificationTemplate,
} from '../models/notification.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationSchedulerService {
  private checkInterval: any;
  private isRunning = false;

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService
  ) {}

  /** 通知スケジューラーを開始 */
  startScheduler(): void {
    if (this.isRunning) {
      console.log('通知スケジューラーは既に実行中です');
      return;
    }

    this.isRunning = true;
    console.log('通知スケジューラーを開始しました');

    // 毎分チェック（実際の運用では適切な間隔に調整）
    this.checkInterval = setInterval(() => {
      this.performNotificationChecks();
    }, 60000); // 1分間隔

    // 初回チェック
    this.performNotificationChecks();
  }

  /** 通知スケジューラーを停止 */
  stopScheduler(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('通知スケジューラーを停止しました');
  }

  /** 通知チェックを実行 */
  private async performNotificationChecks(): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        return;
      }

      const settings = await this.notificationService.getNotificationSettings(
        currentUser.uid
      );
      if (!settings) {
        return;
      }

      // 現在の時刻をチェック
      const now = new Date();
      const currentTime = this.formatTime(now);
      const currentDay = now.getDay(); // 0=日曜日, 6=土曜日

      // 通知オフ期間をチェック
      if (this.isInQuietHours(settings, currentTime, currentDay)) {
        console.log('通知オフ期間中のため、通知をスキップします');
        return;
      }

      // 各通知タイプをチェック
      await this.checkDeadlineNotifications(settings, currentTime);
      await this.checkOverdueNotifications(settings, currentTime);
      await this.checkWorkTimeOverflow(settings, currentTime);
      await this.checkDailyReminder(settings, currentTime);
    } catch (error) {
      console.error('通知チェックエラー:', error);
    }
  }

  /** 期限通知をチェック */
  private async checkDeadlineNotifications(
    settings: NotificationSettings,
    currentTime: string
  ): Promise<void> {
    if (!settings.taskDeadlineNotifications.enabled) {
      return;
    }

    // 設定された通知時間かチェック
    if (currentTime !== settings.taskDeadlineNotifications.timeOfDay) {
      return;
    }

    try {
      const upcomingTasks =
        await this.notificationService.checkUpcomingDeadlines();

      for (const task of upcomingTasks) {
        const daysUntilDeadline = this.calculateDaysUntilDeadline(task.dueDate);

        if (
          settings.taskDeadlineNotifications.daysBeforeDeadline.includes(
            daysUntilDeadline
          )
        ) {
          await this.sendTaskNotification(
            settings,
            task,
            'deadline_approaching'
          );
        }
      }
    } catch (error) {
      console.error('期限通知チェックエラー:', error);
    }
  }

  /** 期限切れ通知をチェック */
  private async checkOverdueNotifications(
    settings: NotificationSettings,
    currentTime: string
  ): Promise<void> {
    if (!settings.taskDeadlineNotifications.enabled) {
      return;
    }

    // 毎日午前9時にチェック
    if (currentTime !== '09:00') {
      return;
    }

    try {
      const overdueTasks = await this.notificationService.checkOverdueTasks();

      for (const task of overdueTasks) {
        await this.sendTaskNotification(settings, task, 'deadline_passed');
      }
    } catch (error) {
      console.error('期限切れ通知チェックエラー:', error);
    }
  }

  /** 作業時間オーバー通知をチェック */
  private async checkWorkTimeOverflow(
    settings: NotificationSettings,
    currentTime: string
  ): Promise<void> {
    if (!settings.workTimeOverflowNotifications.enabled) {
      return;
    }

    // 毎日午前9時にチェック
    if (currentTime !== '09:00') {
      return;
    }

    try {
      // 作業時間オーバーのタスクをチェック
      const overflowTasks = await this.checkWorkTimeOverflowTasks(settings);

      for (const task of overflowTasks) {
        await this.sendTaskNotification(settings, task, 'work_time_overflow');
      }
    } catch (error) {
      console.error('作業時間オーバー通知チェックエラー:', error);
    }
  }

  /** 日次リマインダーをチェック */
  private async checkDailyReminder(
    settings: NotificationSettings,
    currentTime: string
  ): Promise<void> {
    if (!settings.dailyDeadlineReminder.enabled) {
      return;
    }

    // 設定された時間かチェック
    if (currentTime !== settings.dailyDeadlineReminder.timeOfDay) {
      return;
    }

    try {
      const upcomingTasks =
        await this.notificationService.checkUpcomingDeadlines();
      const overdueTasks = await this.notificationService.checkOverdueTasks();

      if (upcomingTasks.length > 0 || overdueTasks.length > 0) {
        const reminderTask: TaskNotificationData = {
          taskId: 'daily_reminder',
          taskName: '日次リマインダー',
          projectName: 'システム',
          assignee: this.authService.getCurrentUser()?.email || '',
          dueDate: new Date().toISOString().split('T')[0],
          status: '未着手',
          priority: '中',
        };

        await this.sendTaskNotification(
          settings,
          reminderTask,
          'daily_reminder'
        );
      }
    } catch (error) {
      console.error('日次リマインダーチェックエラー:', error);
    }
  }

  /** 作業時間オーバータスクをチェック */
  private async checkWorkTimeOverflowTasks(
    settings: NotificationSettings
  ): Promise<TaskNotificationData[]> {
    // 実際の実装では、Firestoreからタスクを取得して作業時間を計算
    // ここでは仮の実装
    return [];
  }

  /** タスク通知を送信 */
  private async sendTaskNotification(
    settings: NotificationSettings,
    task: TaskNotificationData,
    type: string
  ): Promise<void> {
    try {
      const template = this.notificationService.getNotificationTemplate(
        type,
        task
      );

      // メール通知
      if (settings.notificationChannels.email.enabled) {
        const emailSuccess =
          await this.notificationService.sendEmailNotification(
            settings.notificationChannels.email.address,
            template.title,
            template.message
          );

        await this.notificationService.logNotification({
          userId: settings.userId,
          taskId: task.taskId,
          type: type,
          channel: 'email',
          status: emailSuccess ? 'sent' : 'failed',
          message: template.message,
          sentAt: emailSuccess ? new Date() : undefined,
          errorMessage: emailSuccess ? undefined : 'メール送信に失敗しました',
        });
      }
    } catch (error) {
      console.error('通知送信エラー:', error);
    }
  }

  /** 通知オフ期間かチェック */
  private isInQuietHours(
    settings: NotificationSettings,
    currentTime: string,
    currentDay: number
  ): boolean {
    if (!settings.quietHours.enabled) {
      return false;
    }

    // 週末チェック
    if (
      settings.quietHours.weekends &&
      (currentDay === 0 || currentDay === 6)
    ) {
      return true;
    }

    // 時間チェック
    const startTime = settings.quietHours.startTime;
    const endTime = settings.quietHours.endTime;

    if (startTime <= endTime) {
      // 同日内の時間範囲（例: 22:00 - 08:00）
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // 日をまたぐ時間範囲（例: 22:00 - 08:00）
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /** 期限までの日数を計算 */
  private calculateDaysUntilDeadline(dueDate: string): number {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /** 時刻をフォーマット */
  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /** 手動で通知チェックを実行 */
  async manualNotificationCheck(): Promise<void> {
    console.log('手動通知チェックを実行します');
    await this.performNotificationChecks();
  }

  /** スケジューラーの状態を取得 */
  getSchedulerStatus(): boolean {
    return this.isRunning;
  }
}
