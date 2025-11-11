import { Injectable } from '@angular/core';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';
import {
  NotificationSettings,
  TaskNotificationData,
  NotificationTemplate,
  NotificationQueue,
} from '../models/notification.model';
import { Firestore, collection, addDoc, getDocs, query, where, updateDoc, doc, serverTimestamp, deleteDoc, FieldValue } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class NotificationSchedulerService {
  private checkInterval: any;
  private isRunning = false;
  private readonly NOTIFICATION_QUEUE_COLLECTION = 'notificationQueue';
  // 通知オフ期間機能を無効化（コードは残す）
  // private lastQuietHoursState: boolean | null = null; // 前回のオフ期間状態

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
    private firestore: Firestore
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
      // 通知オフ期間機能を無効化（コードは残す）
      // const currentDay = now.getDay(); // 0=日曜日, 6=土曜日

      // 通知オフ期間機能を無効化（コードは残す）
      // // オフ期間状態をチェック
      // const isCurrentlyInQuietHours = this.isInQuietHours(settings, currentTime, currentDay);
      // 
      // // オフ期間終了を検知（前回オフ期間中 → 今回オフ期間外）
      // if (this.lastQuietHoursState === true && !isCurrentlyInQuietHours) {
      //   console.log('🔔 オフ期間が終了しました。キューに保存された通知を送信します');
      //   await this.processNotificationQueue(currentUser.uid, settings);
      // }
      // 
      // // 前回の状態を更新
      // this.lastQuietHoursState = isCurrentlyInQuietHours;
      // 
      // // 通知オフ期間をチェック
      // if (isCurrentlyInQuietHours) {
      //   console.log('通知オフ期間中のため、通知をキューに保存します');
      //   // オフ期間中は通知をキューに保存
      //   await this.checkAndQueueNotifications(settings, currentTime, currentUser.uid);
      //   return;
      // }

      // 各通知タイプをチェック
      // Cloud Functionのみを使用するため、フロントエンドのスケジューラーを無効化（コードは残す）
      // await this.checkDeadlineNotifications(settings, currentTime);
      // await this.checkOverdueNotifications(settings, currentTime);
      // await this.checkWorkTimeOverflow(settings, currentTime);
      // await this.checkDailyReminder(settings, currentTime);
    } catch (error) {
      console.error('通知チェックエラー:', error);
    }
  }

  /** 期限通知をチェック */
  // Cloud Functionのみを使用するため、フロントエンドのスケジューラーを無効化（コードは残す）
  /*
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
  */

  /** 期限切れ通知をチェック */
  // Cloud Functionのみを使用するため、フロントエンドのスケジューラーを無効化（コードは残す）
  /*
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
  */

  /** 作業時間オーバー通知をチェック */
  // Cloud Functionのみを使用するため、フロントエンドのスケジューラーを無効化（コードは残す）
  /*
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
  */

  /** 今日のタスク通知をチェック */
  // Cloud Functionのみを使用するため、フロントエンドのスケジューラーを無効化（コードは残す）
  /*
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

      // 各タスクの担当者に通知を送信（通知先フィールドは削除されたため）
      const allTasks = [...upcomingTasks, ...overdueTasks];
      for (const task of allTasks) {
        // 各タスクの担当者に通知を送信
        await this.sendTaskNotification(
          settings,
          task,
          'daily_reminder'
        );
      }
    } catch (error) {
      console.error('今日のタスク通知チェックエラー:', error);
    }
  }
  */

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

      // メール通知 - 担当者に送信（通知先フィールドは削除されたため）
      if (settings.notificationChannels.email.enabled) {
        // 担当者のメールアドレスを取得
        const assigneeEmails = task.assigneeEmails || [];
        
        // 担当者がいない場合はスキップ
        if (assigneeEmails.length === 0) {
          console.log('担当者が設定されていないため、通知をスキップします:', task.taskId);
          return;
        }

        // 各担当者にメールを送信
        for (const email of assigneeEmails) {
          try {
            const emailSuccess =
              await this.notificationService.sendEmailNotification(
                email,
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
          } catch (error) {
            console.error(`担当者 ${email} への通知送信エラー:`, error);
          }
        }
      }
    } catch (error) {
      console.error('通知送信エラー:', error);
    }
  }

  /** オフ期間中に通知をキューに保存 */
  // 通知オフ期間機能を無効化（コードは残す）
  /*
  private async checkAndQueueNotifications(
    settings: NotificationSettings,
    currentTime: string,
    userId: string
  ): Promise<void> {
    const roomId = this.authService.getCurrentRoomId();
    if (!roomId) {
      console.log('⚠️ ルームIDが取得できません。キュー保存をスキップします');
      return;
    }

    console.log(`🔍 オフ期間中の通知チェック開始: 現在時刻=${currentTime}`);

    try {
      let queuedCount = 0;
      let notificationTimeMatched = false; // 通知が発生する時間だったか

      // 期限通知をチェックしてキューに保存
      if (settings.taskDeadlineNotifications.enabled) {
        if (currentTime === settings.taskDeadlineNotifications.timeOfDay) {
          notificationTimeMatched = true;
          console.log(`📅 期限通知の時間です: ${currentTime}`);
          const upcomingTasks = await this.notificationService.checkUpcomingDeadlines();
          console.log(`📋 期限間近タスク数: ${upcomingTasks.length}件`);
          for (const task of upcomingTasks) {
            const daysUntilDeadline = this.calculateDaysUntilDeadline(task.dueDate);
            if (settings.taskDeadlineNotifications.daysBeforeDeadline.includes(daysUntilDeadline)) {
              await this.addToQueue(userId, roomId, task, 'deadline_approaching');
              queuedCount++;
            }
          }
        } else {
          console.log(`⏰ 期限通知の時間ではありません（設定: ${settings.taskDeadlineNotifications.timeOfDay}, 現在: ${currentTime}）`);
        }
      }

      // 期限切れ通知をチェックしてキューに保存
      if (settings.taskDeadlineNotifications.enabled && currentTime === '09:00') {
        notificationTimeMatched = true;
        console.log('📅 期限切れ通知の時間です: 09:00');
        const overdueTasks = await this.notificationService.checkOverdueTasks();
        console.log(`📋 期限切れタスク数: ${overdueTasks.length}件`);
        for (const task of overdueTasks) {
          await this.addToQueue(userId, roomId, task, 'deadline_passed');
          queuedCount++;
        }
      }

      // 作業時間オーバー通知をチェックしてキューに保存
      if (settings.workTimeOverflowNotifications.enabled) {
        if (currentTime === settings.workTimeOverflowNotifications.timeOfDay) {
          notificationTimeMatched = true;
          console.log(`⏱️ 作業時間オーバー通知の時間です: ${currentTime}`);
          const overflowTasks = await this.checkWorkTimeOverflowTasks(settings);
          console.log(`📋 作業時間オーバータスク数: ${overflowTasks.length}件`);
          for (const task of overflowTasks) {
            await this.addToQueue(userId, roomId, task, 'work_time_overflow');
            queuedCount++;
          }
        } else {
          console.log(`⏰ 作業時間オーバー通知の時間ではありません（設定: ${settings.workTimeOverflowNotifications.timeOfDay}, 現在: ${currentTime}）`);
        }
      }

      // 今日のタスク通知をチェックしてキューに保存
      if (settings.dailyDeadlineReminder.enabled) {
        if (currentTime === settings.dailyDeadlineReminder.timeOfDay) {
          notificationTimeMatched = true;
          console.log(`📅 今日のタスク通知の時間です: ${currentTime}`);
          console.log(`🔍 期限間近タスクを取得中...`);
          const upcomingTasks = await this.notificationService.checkUpcomingDeadlines();
          console.log(`📋 期限間近タスク数: ${upcomingTasks.length}件`);
          console.log(`🔍 期限切れタスクを取得中...`);
          const overdueTasks = await this.notificationService.checkOverdueTasks();
          console.log(`📋 期限切れタスク数: ${overdueTasks.length}件`);
          const allTasks = [...upcomingTasks, ...overdueTasks];
          console.log(`📋 今日のタスク数（合計）: ${allTasks.length}件`);
          if (allTasks.length === 0) {
            console.log(`⚠️ 対象タスクが0件です。理由を確認してください:`);
            console.log(`  - タスクが存在しない可能性`);
            console.log(`  - タスクに担当者が設定されていない可能性`);
            console.log(`  - タスクのステータスが「未着手」または「作業中」でない可能性`);
          }
          for (const task of allTasks) {
            await this.addToQueue(userId, roomId, task, 'daily_reminder');
            queuedCount++;
          }
        } else {
          console.log(`⏰ 今日のタスク通知の時間ではありません（設定: ${settings.dailyDeadlineReminder.timeOfDay}, 現在: ${currentTime}）`);
        }
      }

      if (queuedCount === 0) {
        if (notificationTimeMatched) {
          console.log('ℹ️ オフ期間中で通知が発生する時間でしたが、対象タスクが0件のため、キューに保存する通知はありませんでした');
        } else {
          console.log('ℹ️ オフ期間中ですが、通知が発生する時間ではないため、キューに保存する通知はありませんでした');
        }
      } else {
        console.log(`✅ 合計 ${queuedCount} 件の通知をキューに保存しました`);
      }
    } catch (error) {
      console.error('❌ 通知キュー保存エラー:', error);
    }
  }
  */

  /** 通知をキューに追加 */
  // 通知オフ期間機能を無効化（コードは残す）
  /*
  private async addToQueue(
    userId: string,
    roomId: string,
    task: TaskNotificationData,
    notificationType: NotificationQueue['notificationType']
  ): Promise<void> {
    try {
      console.log(`📝 キューに追加を試みます: ${task.taskName} (${notificationType})`);
      
      // 重複チェック（同じタスクの同じタイプの通知が24時間以内に既にキューにあるか）
      const queueRef = collection(this.firestore, this.NOTIFICATION_QUEUE_COLLECTION);
      const duplicateQuery = query(
        queueRef,
        where('userId', '==', userId),
        where('taskId', '==', task.taskId),
        where('notificationType', '==', notificationType),
        where('sent', '==', false)
      );
      const duplicateSnapshot = await getDocs(duplicateQuery);
      
      if (!duplicateSnapshot.empty) {
        console.log(`⚠️ 通知キューに既に存在するため、スキップします: ${task.taskId} (${notificationType})`);
        return;
      }

      const queueItem: Omit<NotificationQueue, 'id' | 'scheduledTime' | 'createdAt'> & {
        scheduledTime: FieldValue;
        createdAt: FieldValue;
      } = {
        userId,
        roomId,
        taskId: task.taskId,
        taskName: task.taskName,
        projectName: task.projectName,
        assignee: task.assignee,
        assigneeEmails: task.assigneeEmails || [],
        dueDate: task.dueDate,
        status: task.status,
        priority: task.priority,
        notificationType,
        scheduledTime: serverTimestamp(),
        createdAt: serverTimestamp(),
        sent: false,
      };

      const docRef = await addDoc(queueRef, queueItem);
      console.log(`✅ 通知をキューに保存しました: ${task.taskName} (${notificationType}), キューID: ${docRef.id}`);
    } catch (error) {
      console.error('❌ キュー追加エラー:', error);
      console.error('エラー詳細:', {
        userId,
        roomId,
        taskId: task.taskId,
        taskName: task.taskName,
        notificationType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  */

  /** キューに保存された通知を処理して送信 */
  // 通知オフ期間機能を無効化（コードは残す）
  /*
  private async processNotificationQueue(
    userId: string,
    settings: NotificationSettings
  ): Promise<void> {
    try {
      console.log(`🔍 キュー処理開始: userId=${userId}`);
      const queueRef = collection(this.firestore, this.NOTIFICATION_QUEUE_COLLECTION);
      const queueQuery = query(
        queueRef,
        where('userId', '==', userId),
        where('sent', '==', false)
      );
      const snapshot = await getDocs(queueQuery);

      console.log(`📊 キュー検索結果: ${snapshot.size}件の未送信通知が見つかりました`);

      if (snapshot.empty) {
        console.log('ℹ️ 送信待ちの通知キューはありません');
        // デバッグ用: すべてのキューアイテムを確認
        const allQueueQuery = query(queueRef, where('userId', '==', userId));
        const allSnapshot = await getDocs(allQueueQuery);
        console.log(`📋 ユーザーの全キューアイテム数: ${allSnapshot.size}件`);
        if (allSnapshot.size > 0) {
          console.log('📋 キューアイテム詳細:');
          allSnapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            console.log(`  ${index + 1}. ${data['taskName']} (${data['notificationType']}) - sent: ${data['sent']}, createdAt: ${data['createdAt']}`);
          });
        }
        return;
      }

      console.log(`✅ キューに保存された通知 ${snapshot.size} 件を処理します`);

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24時間前

      for (const docSnapshot of snapshot.docs) {
        const queueItem = docSnapshot.data() as NotificationQueue;
        
        // 24時間以上前の通知は削除（古すぎる通知は送信しない）
        const scheduledTime = queueItem.scheduledTime instanceof Date 
          ? queueItem.scheduledTime 
          : new Date(queueItem.scheduledTime);
        
        if (scheduledTime < oneDayAgo) {
          console.log(`24時間以上前の通知のため削除します: ${queueItem.taskName}`);
          await deleteDoc(doc(this.firestore, `${this.NOTIFICATION_QUEUE_COLLECTION}/${docSnapshot.id}`));
          continue;
        }

        // タスク通知データに変換
        const taskData: TaskNotificationData = {
          taskId: queueItem.taskId,
          taskName: queueItem.taskName,
          projectName: queueItem.projectName,
          assignee: queueItem.assignee,
          assigneeEmails: queueItem.assigneeEmails,
          dueDate: queueItem.dueDate,
          status: queueItem.status,
          priority: queueItem.priority,
        };

        // 通知を送信
        await this.sendTaskNotification(settings, taskData, queueItem.notificationType);

        // キューアイテムを送信済みにマーク
        await updateDoc(doc(this.firestore, `${this.NOTIFICATION_QUEUE_COLLECTION}/${docSnapshot.id}`), {
          sent: true,
          sentAt: serverTimestamp(),
        });

        console.log(`キューから通知を送信しました: ${queueItem.taskName} (${queueItem.notificationType})`);
      }
    } catch (error) {
      console.error('キュー処理エラー:', error);
    }
  }
  */

  /** 通知オフ期間かチェック */
  // 通知オフ期間機能を無効化（コードは残す）
  /*
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
  */

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
