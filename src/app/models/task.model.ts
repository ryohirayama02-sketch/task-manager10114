export interface Task {
  id?: string;
  projectId: string;
  roomDocId?: string;
  projectName: string;
  taskName: string;
  description?: string;
  status: '未着手' | '作業中' | '完了';
  priority: '高' | '中' | '低';
  assignee: string;
  assigneeEmail?: string;
  assignedMembers?: string[]; // 複数メンバーの割り当て用（uid配列）
  projectThemeColor?: string;
  calendarSyncEnabled?: boolean;
  parentTaskId?: string;
  startDate: string;
  dueDate: string;
  endDate?: string;
  tags?: string[];
  relatedFiles?: string[];
  urls?: string[];
  attachments?: TaskAttachment[];
  chatMessages?: ChatMessage[];
  detailSettings?: any;
  createdAt?: Date | string; // Firestoreとの互換性のため
  updatedAt?: Date | string; // Firestoreとの互換性のため
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  type: 'file' | 'link';
  size?: number;
  contentType?: string;
  storagePath?: string;
  uploadedAt?: string;
  description?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  timestamp?: Date | string; // Firestoreとの互換性のため
  sender: string;
  senderId?: string;
  mentions?: string[]; // メンションされたユーザーのUID配列
  createdAt?: Date | string; // Firestore保存時のフィールド
  updatedAt?: Date | string; // 更新時刻
}

export interface Project {
  id?: string;
  roomDocId?: string;
  projectName: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  responsible?: string;
  responsibleId?: string;
  responsibleEmail?: string;
  members?: string;
  milestones?: Milestone[];
  themeColor?: string;
  createdAt?: Date | string; // Firestoreとの互換性のため
  updatedAt?: Date | string; // Firestoreとの互換性のため
}

export interface Milestone {
  id: string;
  name: string;
  date: string;
  description?: string;
}

export interface ChangeDetail {
  field: string; // 変更フィールド名（概要、担当者、タグなど）
  oldValue?: string;
  newValue?: string;
}

export interface EditLog {
  id?: string;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  taskId?: string;
  taskName?: string;
  action: 'create' | 'update' | 'delete';
  changeDescription: string; // 統合表示用（後方互換性のため保持）
  oldValue?: string;
  newValue?: string;
  changes?: ChangeDetail[]; // 個別の変更内容配列（新規フィールド）
  createdAt: Date | string;
}
