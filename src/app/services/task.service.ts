import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { EditLogService } from './edit-log.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class TaskService {
  constructor(
    private firestore: Firestore,
    private editLogService: EditLogService,
    private authService: AuthService
  ) {}

  /** Firestoreからタスク一覧を取得 */
  getTasks(): Observable<any[]> {
    const tasksRef = collection(this.firestore, 'tasks');
    return collectionData(tasksRef, { idField: 'id' }) as Observable<any[]>;
  }

  /** Firestoreに新しいタスクを追加 */
  async addTask(task: any) {
    console.log('🔍 TaskService.addTask が呼び出されました');
    console.log('タスクデータ:', task);

    const tasksRef = collection(this.firestore, 'tasks');
    const result = await addDoc(tasksRef, task);

    console.log('✅ タスクを作成しました:', result.id);

    // 編集ログを記録
    console.log('📝 編集ログを記録します...');
    await this.editLogService.logEdit(
      task.projectId || 'unknown',
      task.projectName || 'プロジェクト',
      'create',
      `タスク「${task.taskName || 'タスク'}」を作成しました`,
      result.id,
      task.taskName || 'タスク',
      undefined,
      task.taskName || 'タスク'
    );

    console.log('✅ タスク作成とログ記録が完了しました');
    return result;
  }

  /** タスクのステータスを更新 */
  async updateTaskStatus(
    taskId: string,
    newStatus: string,
    oldStatus?: string,
    projectId?: string,
    projectName?: string
  ) {
    console.log('🔍 TaskService.updateTaskStatus が呼び出されました');
    console.log(
      'タスクID:',
      taskId,
      '新しいステータス:',
      newStatus,
      'プロジェクトID:',
      projectId
    );

    if (!projectId) {
      console.error('❌ プロジェクトIDが指定されていません');
      throw new Error('プロジェクトIDが必要です');
    }

    // 正しいFirestoreパスを使用（プロジェクトのサブコレクション）
    const taskRef = doc(
      this.firestore,
      `projects/${projectId}/tasks/${taskId}`
    );
    const result = await updateDoc(taskRef, { status: newStatus });

    console.log('✅ タスクステータスを更新しました');

    // 編集ログを記録
    console.log('📝 編集ログを記録します...');
    await this.editLogService.logEdit(
      projectId || 'unknown',
      projectName || 'プロジェクト',
      'update',
      `タスクのステータスを「${
        oldStatus || '不明'
      }」から「${newStatus}」に変更しました`,
      taskId,
      'タスク',
      oldStatus || '不明',
      newStatus
    );

    console.log('✅ タスクステータス更新とログ記録が完了しました');
    return result;
  }

  /** タスクの詳細情報を更新 */
  async updateTask(
    taskId: string,
    taskData: any,
    oldTaskData?: any,
    projectId?: string
  ) {
    console.log('🔍 TaskService.updateTask が呼び出されました');
    console.log(
      'タスクID:',
      taskId,
      '更新データ:',
      taskData,
      'プロジェクトID:',
      projectId
    );

    if (!projectId) {
      console.error('❌ プロジェクトIDが指定されていません');
      throw new Error('プロジェクトIDが必要です');
    }

    // 正しいFirestoreパスを使用（プロジェクトのサブコレクション）
    const taskRef = doc(
      this.firestore,
      `projects/${projectId}/tasks/${taskId}`
    );
    const result = await updateDoc(taskRef, taskData);

    console.log('✅ タスクを更新しました');

    // 変更内容を特定
    const changes: string[] = [];
    if (taskData.taskName && oldTaskData?.taskName !== taskData.taskName) {
      changes.push(
        `タスク名: ${oldTaskData?.taskName || '不明'} → ${taskData.taskName}`
      );
    }
    if (taskData.status && oldTaskData?.status !== taskData.status) {
      changes.push(
        `ステータス: ${oldTaskData?.status || '不明'} → ${taskData.status}`
      );
    }
    if (taskData.priority && oldTaskData?.priority !== taskData.priority) {
      changes.push(
        `優先度: ${oldTaskData?.priority || '不明'} → ${taskData.priority}`
      );
    }
    if (taskData.assignee && oldTaskData?.assignee !== taskData.assignee) {
      changes.push(
        `担当者: ${oldTaskData?.assignee || '不明'} → ${taskData.assignee}`
      );
    }
    if (taskData.dueDate && oldTaskData?.dueDate !== taskData.dueDate) {
      changes.push(
        `期限: ${oldTaskData?.dueDate || '不明'} → ${taskData.dueDate}`
      );
    }
    if (
      taskData.description &&
      oldTaskData?.description !== taskData.description
    ) {
      changes.push(`説明: 変更されました`);
    }

    // 編集ログを記録
    if (changes.length > 0) {
      console.log('📝 編集ログを記録します...');
      await this.editLogService.logEdit(
        taskData.projectId || 'unknown',
        taskData.projectName || 'プロジェクト',
        'update',
        `タスク「${
          taskData.taskName || 'タスク'
        }」を更新しました (${changes.join(', ')})`,
        taskId,
        taskData.taskName || 'タスク',
        oldTaskData ? JSON.stringify(oldTaskData) : undefined,
        changes.join(', ')
      );
    }

    console.log('✅ タスク更新とログ記録が完了しました');
    return result;
  }

  /** タスクを削除 */
  async deleteTask(taskId: string, taskData: any, projectId?: string) {
    console.log('🔍 TaskService.deleteTask が呼び出されました');
    console.log(
      'タスクID:',
      taskId,
      'タスクデータ:',
      taskData,
      'プロジェクトID:',
      projectId
    );

    if (!projectId) {
      console.error('❌ プロジェクトIDが指定されていません');
      throw new Error('プロジェクトIDが必要です');
    }

    // 正しいFirestoreパスを使用（プロジェクトのサブコレクション）
    const taskRef = doc(
      this.firestore,
      `projects/${projectId}/tasks/${taskId}`
    );
    const result = await deleteDoc(taskRef);

    console.log('✅ タスクを削除しました');

    // 編集ログを記録
    console.log('📝 編集ログを記録します...');
    await this.editLogService.logEdit(
      taskData.projectId || 'unknown',
      taskData.projectName || 'プロジェクト',
      'delete',
      `タスク「${taskData.taskName || 'タスク'}」を削除しました`,
      taskId,
      taskData.taskName || 'タスク',
      taskData.taskName || 'タスク',
      undefined
    );

    console.log('✅ タスク削除とログ記録が完了しました');
    return result;
  }
}
