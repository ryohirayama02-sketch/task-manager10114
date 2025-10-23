export interface Task {
  id?: string;
  projectId: string;
  projectName: string;
  taskName: string;
  description?: string;
  status: '未着手' | '作業中' | '完了';
  priority: '高' | '中' | '低';
  assignee: string;
  startDate: string;
  dueDate: string;
  endDate?: string;
  tags?: string[];
  relatedFiles?: string[];
  chatMessages?: ChatMessage[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  sender: string;
}

export interface Project {
  id?: string;
  projectName: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  milestones?: Milestone[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Milestone {
  id: string;
  name: string;
  date: string;
  description?: string;
}
