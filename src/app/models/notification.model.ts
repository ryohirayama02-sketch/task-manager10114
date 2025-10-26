export interface NotificationSettings {
  id?: string;
  userId: string;

  // 通知先設定
  notificationChannels: {
    email: {
      enabled: boolean;
      address: string;
    };
    slack: {
      enabled: boolean;
      webhookUrl: string;
      channel: string;
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
  channel: 'email' | 'slack' | 'push';
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
  dueDate: string;
  status: string;
  priority: string;
  estimatedHours?: number;
  actualHours?: number;
}
