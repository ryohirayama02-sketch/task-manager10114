export interface NotificationSettings {
  id?: string;
  userId: string;
  roomId?: string;
  roomDocId?: string;

  // 通知先設定
  notificationChannels: {
    email: {
      enabled: boolean;
      address: string;
    };
  };

  // タスク期限通知設定
  taskDeadlineNotifications: {
    enabled: boolean;
    daysBeforeDeadline: number[]; // [1, 3, 7] など、何日前に通知するか
    timeOfDay: string; // "09:00" 形式
  };

  // 通知オフ期間設定
  quietHours: {
    enabled: boolean;
    startTime: string; // "22:00"
    endTime: string; // "08:00"
    weekends: boolean; // 週末もオフにするか
  };

  // 作業時間オーバー通知設定
  workTimeOverflowNotifications: {
    enabled: boolean;
    checkPeriodDays: number; // 何日間の作業時間をチェックするか
    maxWorkHours: number; // 最大作業時間（時間）
    timeOfDay: string; // "09:00" 形式
    notifyManager: boolean;
    notifyAssignee: boolean;
  };

  // 期限近いタスクのプッシュ通知設定
  dailyDeadlineReminder: {
    enabled: boolean;
    timeOfDay: string; // "09:00" 形式
  };

  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface NotificationTemplate {
  id: string;
  type:
    | 'deadline_approaching'
    | 'deadline_passed'
    | 'work_time_overflow'
    | 'daily_reminder';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface NotificationLog {
  id: string;
  userId: string;
  taskId?: string;
  type: string;
  channel: 'email' | 'push';
  status: 'pending' | 'sent' | 'failed';
  message: string;
  sentAt?: Date | string;
  errorMessage?: string;
  createdAt: Date | string;
}

export interface TaskNotificationData {
  taskId: string;
  taskName: string;
  projectName: string;
  assignee: string;
  assigneeEmails?: string[]; // 担当者のメールアドレス配列
  dueDate: string;
  status: string;
  priority: string;
  estimatedHours?: number;
  actualHours?: number;
}

/** 通知キュー（オフ期間中に送信予定だった通知を保存） */
export interface NotificationQueue {
  id?: string;
  userId: string;
  roomId: string;
  taskId: string;
  taskName: string;
  projectName: string;
  assignee: string;
  assigneeEmails: string[];
  dueDate: string;
  status: string;
  priority: string;
  notificationType: 'deadline_approaching' | 'deadline_passed' | 'work_time_overflow' | 'daily_reminder';
  scheduledTime: Date | string; // 本来送信予定だった時刻
  createdAt: Date | string;
  sent?: boolean; // 送信済みフラグ
  sentAt?: Date | string; // 実際に送信した時刻
}
