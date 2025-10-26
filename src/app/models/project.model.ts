import { Milestone } from './task.model';

export interface IProject {
  id: string;
  projectName: string;
  overview: string; // 概要
  startDate: string; // 開始日
  endDate: string; // 終了日
  members: string; // メンバー（文字列 or カンマ区切り）
  tags: string; // タグ
  color?: string; // 任意フィールド
  milestones?: Milestone[]; // マイルストーン
}
