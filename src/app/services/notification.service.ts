import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { AuthService } from './auth.service';
import {
  NotificationSettings,
  NotificationLog,
  TaskNotificationData,
  NotificationTemplate,
} from '../models/notification.model';

// Cloud Functions のレスポンス型定義
interface CloudFunctionResponse {
  success: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly NOTIFICATION_SETTINGS_COLLECTION = 'notificationSettings';
  private readonly NOTIFICATION_LOGS_COLLECTION = 'notificationLogs';
  private readonly TASKS_COLLECTION = 'tasks';

  constructor(
    private firestore: Firestore,
    private functions: Functions,
    private authService: AuthService
  ) {}

  /** 通知設定を取得 */
  async getNotificationSettings(
    userId: string
  ): Promise<NotificationSettings | null> {
    try {
      // 認証状態を確認
      const currentUser = this.authService.getCurrentUser();
      console.log('現在のユーザー:', currentUser);
      console.log('取得しようとしているuserId:', userId);

      const settingsRef = collection(
        this.firestore,
        this.NOTIFICATION_SETTINGS_COLLECTION
      );
      const q = query(settingsRef, where('userId', '==', userId));
      console.log('Firestoreクエリを実行中...');
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as NotificationSettings;
    } catch (error) {
      console.error('通知設定の取得エラー:', error);
      throw error;
    }
  }

  /** 通知設定を保存 */
  async saveNotificationSettings(
    settings: NotificationSettings
  ): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('ユーザーがログインしていません');
      }

      const settingsData: any = {
        ...settings,
        userId: currentUser.uid,
        updatedAt: serverTimestamp(),
      };

      if (settings.id) {
        // 更新
        const docRef = doc(
          this.firestore,
          this.NOTIFICATION_SETTINGS_COLLECTION,
          settings.id
        );
        await updateDoc(docRef, settingsData);
      } else {
        // 新規作成
        settingsData.createdAt = serverTimestamp();
        const docRef = collection(
          this.firestore,
          this.NOTIFICATION_SETTINGS_COLLECTION
        );
        await addDoc(docRef, settingsData);
      }
    } catch (error) {
      console.error('通知設定の保存エラー:', error);
      throw error;
    }
  }

  /** デフォルト通知設定を作成 */
  createDefaultNotificationSettings(): NotificationSettings {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('ユーザーがログインしていません');
    }

    return {
      userId: currentUser.uid,
      notificationChannels: {
        email: {
          enabled: true,
          address: currentUser.email || '',
        },
      },
      taskDeadlineNotifications: {
        enabled: true,
        daysBeforeDeadline: [1, 3, 7],
        timeOfDay: '09:00',
      },
      quietHours: {
        enabled: true,
        startTime: '22:00',
        endTime: '08:00',
        weekends: true,
      },
      workTimeOverflowNotifications: {
        enabled: true,
        checkPeriodDays: 7,
        maxWorkHours: 40,
        notifyManager: true,
        notifyAssignee: true,
      },
      dailyDeadlineReminder: {
        enabled: true,
        timeOfDay: '09:00',
      },
    };
  }

  /** 期限が近いタスクをチェック */
  async checkUpcomingDeadlines(): Promise<TaskNotificationData[]> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) return [];

      const settings = await this.getNotificationSettings(currentUser.uid);
      if (!settings?.taskDeadlineNotifications.enabled) return [];

      const today = new Date();
      const upcomingTasks: TaskNotificationData[] = [];

      // 全プロジェクトからタスクを取得
      const projectsRef = collection(this.firestore, 'projects');
      const projectsSnapshot = await getDocs(projectsRef);

      // 各通知日数でタスクをチェック
      for (const daysBefore of settings.taskDeadlineNotifications
        .daysBeforeDeadline) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysBefore);
        const targetDateStr = targetDate.toISOString().split('T')[0];

        // 各プロジェクトのタスクをチェック
        for (const projectDoc of projectsSnapshot.docs) {
          const projectId = projectDoc.id;
          const projectData = projectDoc.data();

          const tasksRef = collection(
            this.firestore,
            `projects/${projectId}/tasks`
          );
          const q = query(
            tasksRef,
            where('dueDate', '==', targetDateStr),
            where('status', 'in', ['未着手', '作業中'])
          );

          const querySnapshot = await getDocs(q);
          querySnapshot.forEach((doc) => {
            const taskData = doc.data();

            // 担当者が現在のユーザーかチェック（メールアドレスまたは名前）
            const isAssignedToUser =
              taskData['assigneeEmail'] === currentUser.email ||
              taskData['assignee'] === currentUser.displayName ||
              taskData['assignee'] === currentUser.email;

            if (isAssignedToUser) {
              upcomingTasks.push({
                taskId: doc.id,
                taskName: taskData['taskName'],
                projectName: projectData['projectName'] || 'プロジェクト',
                assignee: taskData['assignee'],
                dueDate: taskData['dueDate'],
                status: taskData['status'],
                priority: taskData['priority'],
                estimatedHours: taskData['estimatedHours'],
              });
            }
          });
        }
      }

      return upcomingTasks;
    } catch (error) {
      console.error('期限チェックエラー:', error);
      return [];
    }
  }

  /** 期限切れタスクをチェック */
  async checkOverdueTasks(): Promise<TaskNotificationData[]> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) return [];

      const today = new Date().toISOString().split('T')[0];
      const overdueTasks: TaskNotificationData[] = [];

      // 全プロジェクトからタスクを取得
      const projectsRef = collection(this.firestore, 'projects');
      const projectsSnapshot = await getDocs(projectsRef);

      // 各プロジェクトのタスクをチェック
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        const projectData = projectDoc.data();

        const tasksRef = collection(
          this.firestore,
          `projects/${projectId}/tasks`
        );
        const q = query(
          tasksRef,
          where('dueDate', '<', today),
          where('status', 'in', ['未着手', '作業中'])
        );

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          const taskData = doc.data();

          // 担当者が現在のユーザーかチェック（メールアドレスまたは名前）
          const isAssignedToUser =
            taskData['assigneeEmail'] === currentUser.email ||
            taskData['assignee'] === currentUser.displayName ||
            taskData['assignee'] === currentUser.email;

          if (isAssignedToUser) {
            overdueTasks.push({
              taskId: doc.id,
              taskName: taskData['taskName'],
              projectName: projectData['projectName'] || 'プロジェクト',
              assignee: taskData['assignee'],
              dueDate: taskData['dueDate'],
              status: taskData['status'],
              priority: taskData['priority'],
              estimatedHours: taskData['estimatedHours'],
            });
          }
        });
      }

      return overdueTasks;
    } catch (error) {
      console.error('期限切れチェックエラー:', error);
      return [];
    }
  }

  /** メール通知を送信（Firebase Cloud Functions経由） */
  async sendEmailNotification(
    to: string,
    subject: string,
    message: string
  ): Promise<boolean> {
    try {
      const sendEmail = httpsCallable(this.functions, 'sendEmailNotification');
      const result = await sendEmail({ to, subject, message });

      // 型安全なレスポンス処理
      const response = result.data as CloudFunctionResponse;
      return response?.success || false;
    } catch (error) {
      console.error('メール通知エラー:', error);
      return false;
    }
  }

  /** テスト通知を送信（Firebase Cloud Functions経由） */
  async sendTestNotification(email: string): Promise<boolean> {
    try {
      // ✅ リージョンを明示的に指定（あなたの関数は us-central1 にデプロイされている）
      const { getFunctions, httpsCallable } = await import(
        'firebase/functions'
      );
      const { getApp } = await import('firebase/app');
      const functions = getFunctions(getApp(), 'us-central1');

      // ✅ sendTestEmail 関数呼び出し
      const callable = httpsCallable<
        { email: string },
        { success?: boolean; message?: string }
      >(functions, 'sendTestEmail');

      const result = await callable({ email });

      // ✅ result.data が undefined の場合にも対応（SDK差異対応）
      const data = (result as any)?.data ?? result;
      console.log('[sendTestNotification] 結果:', data);

      // ✅ success が true なら OK
      return !!data?.success;
    } catch (error: any) {
      console.error('[sendTestNotification] エラー:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
      });
      return false;
    }
  }

  /** 通知ログを記録 */
  async logNotification(
    log: Omit<NotificationLog, 'id' | 'createdAt'>
  ): Promise<void> {
    try {
      const logData: any = {
        ...log,
        createdAt: serverTimestamp(),
      };

      const docRef = collection(
        this.firestore,
        this.NOTIFICATION_LOGS_COLLECTION
      );
      await addDoc(docRef, logData);
    } catch (error) {
      console.error('通知ログ記録エラー:', error);
    }
  }

  /** 通知ログを取得 */
  async getNotificationLogs(
    userId: string,
    limit: number = 50
  ): Promise<NotificationLog[]> {
    try {
      const logsRef = collection(
        this.firestore,
        this.NOTIFICATION_LOGS_COLLECTION
      );
      const q = query(
        logsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
        // limit(limit) // Firestoreの制限でコメントアウト
      );

      const querySnapshot = await getDocs(q);
      const logs: NotificationLog[] = [];

      querySnapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() } as NotificationLog);
      });

      return logs.slice(0, limit);
    } catch (error) {
      console.error('通知ログ取得エラー:', error);
      return [];
    }
  }

  /** 通知テンプレートを取得 */
  getNotificationTemplate(
    type: string,
    taskData: TaskNotificationData
  ): NotificationTemplate {
    const templates: { [key: string]: NotificationTemplate } = {
      deadline_approaching: {
        id: 'deadline_approaching',
        type: 'deadline_approaching',
        title: 'タスク期限が近づいています',
        message: `【${taskData.projectName}】${taskData.taskName} の期限が近づいています。期限: ${taskData.dueDate}`,
        priority: 'medium',
      },
      deadline_passed: {
        id: 'deadline_passed',
        type: 'deadline_passed',
        title: 'タスク期限が過ぎています',
        message: `【${taskData.projectName}】${taskData.taskName} の期限が過ぎています。期限: ${taskData.dueDate}`,
        priority: 'high',
      },
      work_time_overflow: {
        id: 'work_time_overflow',
        type: 'work_time_overflow',
        title: '作業時間が上限を超えています',
        message: `【${taskData.projectName}】${taskData.taskName} の作業時間が上限を超えています。`,
        priority: 'high',
      },
      daily_reminder: {
        id: 'daily_reminder',
        type: 'daily_reminder',
        title: '今日のタスク確認',
        message: `今日期限のタスクがあります。詳細はアプリで確認してください。`,
        priority: 'low',
      },
    };

    return templates[type] || templates['daily_reminder'];
  }
}
