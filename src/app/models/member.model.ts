export interface IMember {
  id: string;
  name: string;
  email: string;
  role: string; // 役職
  done: number; // 完了タスク数
  working: number; // 作業中タスク数
  todo: number; // 未着手タスク数
}
