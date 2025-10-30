export interface Task {
  id?: string;
  projectId: string;
  projectName: string;
  taskName: string;
  description?: string;
  status: '未着手' | '作業中' | '完了';
  priority: '高' | '中' | '低';
  assignee: string;
  assigneeEmail?: string;
  projectThemeColor?: string;
  startDate: string;
  dueDate: string;
  endDate?: string;
  tags?: string[];
  relatedFiles?: string[];
  chatMessages?: ChatMessage[];
  createdAt?: Date | string; // Firestoreとの互換性のため
  updatedAt?: Date | string; // Firestoreとの互換性のため
}

export interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date | string; // Firestoreとの互換性のため
  sender: string;
}

export interface Project {
  id?: string;
  projectName: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  responsible?: string;
  responsibleId?: string;
  responsibleEmail?: string;
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

export interface EditLog {
  id?: string;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  taskId?: string;
  taskName?: string;
  action: 'create' | 'update' | 'delete';
  changeDescription: string;
  oldValue?: string;
  newValue?: string;
  createdAt: Date | string;
}
