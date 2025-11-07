import { Milestone } from './task.model';

export interface ProjectAttachment {
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

export interface IProject {
  id: string;
  roomDocId?: string;
  projectName: string;
  overview: string; // 概要
  startDate: string; // 開始日
  endDate: string; // 終了日
  members: string; // メンバー（文字列 or カンマ区切り）
  responsible?: string;
  responsibleId?: string;
  responsibleEmail?: string;
  responsibles?: Array<{
    memberId: string;
    memberName: string;
    memberEmail?: string;
  }>;
  tags: string; // タグ
  color?: string; // 任意フィールド
  themeColor?: string; // プロジェクトのテーマカラー
  milestones?: Milestone[]; // マイルストーン
  attachments?: ProjectAttachment[];
}
