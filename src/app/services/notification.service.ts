import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
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

// Cloud Functions のレスポンス型
interface CloudFunctionResponse {
  success: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly NOTIFICATION_SETTINGS_COLLECTION = 'notificationSettings';
  private readonly NOTIFICATION_LOGS_COLLECTION = 'notificationLogs';

  constructor(
    private firestore: Firestore,
    private functions: Functions,
    private authService: AuthService
  ) {}

  /** 🔹 通知設定を取得 */
  async getNotificationSettings(
    userId: string
  ): Promise<NotificationSettings | null> {
    try {
      const currentUser = this.authService.getCurrentUser();
      const roomId = this.authService.getCurrentRoomId();
      const roomDocId = this.authService.getCurrentRoomDocId();

      if (!roomId || !roomDocId) {
        console.warn('ルーム情報が不足しているため通知設定を取得できません');
        return null;
      }

      const settingsRef = collection(
        this.firestore,
        this.NOTIFICATION_SETTINGS_COLLECTION
      );
      const scopedQuery = query(
        settingsRef,
        where('userId', '==', userId),
        where('roomDocId', '==', roomDocId)
      );
      const snapshot = await getDocs(scopedQuery);

      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as NotificationSettings;
      }

      return null;
    } catch (error) {
      console.error('通知設定の取得エラー:', error);
      return null;
    }
  }

  /** 🔹 通知設定を保存（新規・更新共通） */
  async saveNotificationSettings(
    settings: NotificationSettings
  ): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) throw new Error('ユーザーが未ログインです');

      const roomId = this.authService.getCurrentRoomId();
      const roomDocId = this.authService.getCurrentRoomDocId();
      if (!roomId || !roomDocId)
        throw new Error('ルーム情報が設定されていません');

      // timeOfDay を "HH:mm" に正規化
      const timeOfDay =
        settings.taskDeadlineNotifications?.timeOfDay || '09:00';
      const normalizedTime = timeOfDay.padStart(5, '0');

      const settingsData: any = {
        ...settings,
        userId: currentUser.uid,
        roomId,
        roomDocId,
        'taskDeadlineNotifications.timeOfDay': normalizedTime,
        updatedAt: serverTimestamp(),
      };

      const settingsRef = collection(
        this.firestore,
        this.NOTIFICATION_SETTINGS_COLLECTION
      );

      if (settings.id) {
        const docRef = doc(
          this.firestore,
          this.NOTIFICATION_SETTINGS_COLLECTION,
          settings.id
        );
        await updateDoc(docRef, settingsData);
        console.log('✅ 通知設定を更新しました:', settingsData);
      } else {
        settingsData.createdAt = serverTimestamp();
        await addDoc(settingsRef, settingsData);
        console.log('✅ 通知設定を新規作成しました:', settingsData);
      }
    } catch (error) {
      console.error('❌ 通知設定の保存エラー:', error);
      throw error;
    }
  }

  /** 🔹 デフォルト通知設定を作成 */
  createDefaultNotificationSettings(): NotificationSettings {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) throw new Error('ユーザーがログインしていません');

    const roomId = this.authService.getCurrentRoomId();
    const roomDocId = this.authService.getCurrentRoomDocId();
    if (!roomId || !roomDocId)
      throw new Error('ルーム情報が設定されていません');

    return {
      userId: currentUser.uid,
      roomId,
      roomDocId,
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
        enabled: false,
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

  /** 🔹 メール通知を送信（Cloud Functions経由） */
  async sendEmailNotification(
    to: string,
    subject: string,
    message: string
  ): Promise<boolean> {
    try {
      const { getFunctions, httpsCallable } = await import(
        'firebase/functions'
      );
      const { getApp } = await import('firebase/app');
      const functions = getFunctions(getApp(), 'us-central1');

      const sendEmail = httpsCallable<
        { to: string; subject: string; message: string },
        CloudFunctionResponse
      >(functions, 'sendEmailNotification');
      const result = await sendEmail({ to, subject, message });
      return result.data?.success || false;
    } catch (error) {
      console.error('❌ メール通知エラー:', error);
      return false;
    }
  }

  /** 🔹 テスト通知を送信 */
  async sendTestNotification(email: string): Promise<boolean> {
    try {
      const { getFunctions, httpsCallable } = await import(
        'firebase/functions'
      );
      const { getApp } = await import('firebase/app');
      const functions = getFunctions(getApp(), 'us-central1');

      const callable = httpsCallable<
        { email: string },
        { success?: boolean; message?: string }
      >(functions, 'sendTestEmail');

      const result = await callable({ email });
      const data = (result as any)?.data ?? result;
      console.log('✅ テスト通知送信結果:', data);
      return !!data?.success;
    } catch (error: any) {
      console.error('❌ テスト通知送信エラー:', error);
      return false;
    }
  }

  /** 🔹 通知ログを記録 */
  async logNotification(
    log: Omit<NotificationLog, 'id' | 'createdAt'>
  ): Promise<void> {
    try {
      const docRef = collection(
        this.firestore,
        this.NOTIFICATION_LOGS_COLLECTION
      );
      await addDoc(docRef, { ...log, createdAt: serverTimestamp() });
    } catch (error) {
      console.error('通知ログ記録エラー:', error);
    }
  }

  /** 🔹 通知ログを取得 */
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
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .slice(0, limit)
        .map((d) => ({ id: d.id, ...d.data() } as NotificationLog));
    } catch (error) {
      console.error('通知ログ取得エラー:', error);
      return [];
    }
  }

  /** 🔹 通知テンプレート */
  getNotificationTemplate(
    type: string,
    taskData: TaskNotificationData
  ): NotificationTemplate {
    const templates: Record<string, NotificationTemplate> = {
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

  /** 🔹 期限が近いタスクをチェック */
  async checkUpcomingDeadlines(): Promise<TaskNotificationData[]> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) return [];
      const roomId = this.authService.getCurrentRoomId();
      const roomDocId = this.authService.getCurrentRoomDocId();
      if (!roomId || !roomDocId) {
        console.warn('ルーム情報が未設定のため期限チェックを実行できません');
        return [];
      }

      const settings = await this.getNotificationSettings(currentUser.uid);
      if (!settings?.taskDeadlineNotifications.enabled) return [];

      const today = new Date();
      const upcomingTasks: TaskNotificationData[] = [];

      const projectsRef = collection(this.firestore, 'projects');
      let projectsSnapshot = await getDocs(
        query(projectsRef, where('roomDocId', '==', roomDocId))
      );
      if (projectsSnapshot.empty) {
        projectsSnapshot = await getDocs(
          query(projectsRef, where('roomId', '==', roomId))
        );
      }

      for (const daysBefore of settings.taskDeadlineNotifications
        .daysBeforeDeadline) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysBefore);
        const targetDateStr = targetDate.toISOString().split('T')[0];

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

  /** 🔹 期限切れタスクをチェック */
  async checkOverdueTasks(): Promise<TaskNotificationData[]> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) return [];
      const roomId = this.authService.getCurrentRoomId();
      const roomDocId = this.authService.getCurrentRoomDocId();
      if (!roomId || !roomDocId) {
        console.warn(
          'ルーム情報が未設定のため期限切れチェックを実行できません'
        );
        return [];
      }

      const today = new Date().toISOString().split('T')[0];
      const overdueTasks: TaskNotificationData[] = [];

      const projectsRef = collection(this.firestore, 'projects');
      let projectsSnapshot = await getDocs(
        query(projectsRef, where('roomDocId', '==', roomDocId))
      );
      if (projectsSnapshot.empty) {
        projectsSnapshot = await getDocs(
          query(projectsRef, where('roomId', '==', roomId))
        );
      }

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
}
