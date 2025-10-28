import { Injectable } from '@angular/core';
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  addDoc,
  serverTimestamp,
  FieldValue,
} from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { EditLog } from '../models/task.model';

@Injectable({
  providedIn: 'root',
})
export class EditLogService {
  private readonly EDIT_LOGS_COLLECTION = 'editLogs';
  private readonly LOGS_PER_PAGE = 30;

  constructor(private firestore: Firestore, private authService: AuthService) {}

  /** 編集ログを記録 */
  async logEdit(
    projectId: string,
    projectName: string,
    action: 'create' | 'update' | 'delete',
    changeDescription: string,
    taskId?: string,
    taskName?: string,
    oldValue?: string,
    newValue?: string
  ): Promise<void> {
    try {
      console.log('🔍 EditLogService.logEdit が呼び出されました');
      console.log('パラメータ:', {
        projectId,
        projectName,
        action,
        changeDescription,
      });

      const currentUser = this.authService.getCurrentUser();
      console.log('現在のユーザー:', currentUser);

      if (!currentUser) {
        console.warn('⚠️ ユーザーがログインしていません');
        return;
      }

      const logData: any = {
        userId: currentUser.uid,
        userName:
          currentUser.displayName || currentUser.email || 'Unknown User',
        projectId,
        projectName,
        action,
        changeDescription,
        createdAt: serverTimestamp(),
      };

      // undefinedでない場合のみフィールドを追加
      if (taskId !== undefined) {
        logData.taskId = taskId;
      }
      if (taskName !== undefined) {
        logData.taskName = taskName;
      }
      if (oldValue !== undefined) {
        logData.oldValue = oldValue;
      }
      if (newValue !== undefined) {
        logData.newValue = newValue;
      }

      console.log('📝 記録するログデータ:', logData);

      const logsRef = collection(this.firestore, this.EDIT_LOGS_COLLECTION);
      const result = await addDoc(logsRef, logData);

      console.log('✅ 編集ログを記録しました:', result.id);
      console.log('記録されたデータ:', logData);
    } catch (error) {
      console.error('❌ 編集ログの記録エラー:', error);
    }
  }

  /** 編集ログを取得（直近30件） */
  async getRecentEditLogs(): Promise<EditLog[]> {
    try {
      console.log('🔍 EditLogService.getRecentEditLogs が呼び出されました');

      const logsRef = collection(this.firestore, this.EDIT_LOGS_COLLECTION);
      const q = query(
        logsRef,
        orderBy('createdAt', 'desc'),
        limit(this.LOGS_PER_PAGE)
      );

      console.log('📊 Firestoreクエリを実行中...');
      const querySnapshot = await getDocs(q);
      console.log(
        '📊 クエリ結果:',
        querySnapshot.size,
        '件のドキュメントが見つかりました'
      );

      const logs: EditLog[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('📄 ドキュメントデータ:', doc.id, data);
        logs.push({
          id: doc.id,
          userId: data['userId'],
          userName: data['userName'],
          projectId: data['projectId'],
          projectName: data['projectName'],
          taskId: data['taskId'] || undefined,
          taskName: data['taskName'] || undefined,
          action: data['action'],
          changeDescription: data['changeDescription'],
          oldValue: data['oldValue'] || undefined,
          newValue: data['newValue'] || undefined,
          createdAt: data['createdAt']?.toDate() || new Date(),
        } as EditLog);
      });

      console.log('✅ 編集ログを取得しました:', logs.length, '件');
      console.log('取得したログ:', logs);
      return logs;
    } catch (error) {
      console.error('❌ 編集ログの取得エラー:', error);
      return [];
    }
  }

  /** 編集ログを追加取得（ページネーション） */
  async getMoreEditLogs(lastDoc: DocumentSnapshot): Promise<{
    logs: EditLog[];
    lastDocument: DocumentSnapshot | null;
  }> {
    try {
      const logsRef = collection(this.firestore, this.EDIT_LOGS_COLLECTION);
      const q = query(
        logsRef,
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(this.LOGS_PER_PAGE)
      );

      const querySnapshot = await getDocs(q);
      const logs: EditLog[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          userId: data['userId'],
          userName: data['userName'],
          projectId: data['projectId'],
          projectName: data['projectName'],
          taskId: data['taskId'] || undefined,
          taskName: data['taskName'] || undefined,
          action: data['action'],
          changeDescription: data['changeDescription'],
          oldValue: data['oldValue'] || undefined,
          newValue: data['newValue'] || undefined,
          createdAt: data['createdAt']?.toDate() || new Date(),
        } as EditLog);
      });

      const lastDocument =
        querySnapshot.docs[querySnapshot.docs.length - 1] || null;

      return { logs, lastDocument };
    } catch (error) {
      console.error('編集ログの追加取得エラー:', error);
      return { logs: [], lastDocument: null };
    }
  }

  /** アクション名を日本語に変換 */
  getActionLabel(action: string): string {
    const actionLabels: { [key: string]: string } = {
      create: '新規作成',
      update: '更新',
      delete: '削除',
    };
    return actionLabels[action] || action;
  }

  /** 編集ログをCSV形式で出力 */
  exportToCSV(logs: EditLog[]): void {
    try {
      const headers = [
        '日時',
        'ユーザー名',
        'プロジェクト名',
        'タスク名',
        'アクション',
        '変更内容',
        '変更前',
        '変更後',
      ];

      const csvData = logs.map((log) => [
        this.formatDate(log.createdAt),
        log.userName,
        log.projectName,
        log.taskName || '',
        this.getActionLabel(log.action),
        log.changeDescription,
        log.oldValue || '',
        log.newValue || '',
      ]);

      const csvContent = [headers, ...csvData]
        .map((row) => row.map((field) => `"${field}"`).join(','))
        .join('\n');

      // BOMを追加してUTF-8でエンコード
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `edit_logs_${this.formatDateForFilename(new Date())}.csv`
      );
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('CSVファイルを出力しました');
    } catch (error) {
      console.error('CSV出力エラー:', error);
    }
  }

  /** 日付をフォーマット */
  private formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /** ファイル名用の日付フォーマット */
  private formatDateForFilename(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }
}
