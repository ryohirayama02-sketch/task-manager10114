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
  where,
  doc,
  deleteDoc,
} from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { EditLog, ChangeDetail } from '../models/task.model';

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
    newValue?: string,
    changes?: ChangeDetail[]
  ): Promise<void> {
    try {
      console.log('🔍 EditLogService.logEdit が呼び出されました');

      const currentUser = this.authService.getCurrentUser();
      const roomId = this.authService.getCurrentRoomId();

      console.log('📋 ログデータ確認:', {
        projectId,
        projectName,
        action,
        changeDescription,
        taskId,
        currentUserUid: currentUser?.uid,
        currentUserEmail: currentUser?.email,
        roomId,
      });

      if (!currentUser) {
        console.warn('⚠️ ユーザーがログインしていません');
        return;
      }
      if (!roomId) {
        console.warn(
          '⚠️ ルームIDが設定されていません - localStorage:',
          localStorage.getItem('roomId')
        );
        return;
      }

      const logData: any = {
        userId: currentUser.uid,
        userName:
          currentUser.displayName || currentUser.email || 'Unknown User',
        userEmail: currentUser.email || undefined, // メールアドレスを保存
        projectId,
        projectName,
        action,
        changeDescription,
        createdAt: serverTimestamp(),
        roomId,
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
      if (changes !== undefined && changes.length > 0) {
        logData.changes = changes;
      }

      console.log('📝 Firestoreに記録中...', logData);

      const logsRef = collection(this.firestore, this.EDIT_LOGS_COLLECTION);
      const result = await addDoc(logsRef, logData);

      console.log('✅ 編集ログを記録しました:', result.id);
      console.log('📊 記録確認 - roomId:', roomId, 'userId:', currentUser.uid);
    } catch (error) {
      console.error('❌ 編集ログの記録エラー:', error);
      console.error('エラー詳細:', {
        projectId,
        action,
        roomId: this.authService.getCurrentRoomId(),
      });
    }
  }

  /** 編集ログを取得（直近30件） */
  async getRecentEditLogs(): Promise<{
    logs: EditLog[];
    lastDocument: DocumentSnapshot | null;
  }> {
    try {
      console.log('🔍 EditLogService.getRecentEditLogs が呼び出されました');

      const roomId = this.authService.getCurrentRoomId();
      console.log('📊 クエリ準備 - roomId:', roomId);

      if (!roomId) {
        console.warn('⚠️ ルームIDが設定されていません');
        return { logs: [], lastDocument: null };
      }

      const logsRef = collection(this.firestore, this.EDIT_LOGS_COLLECTION);
      // ⚠️ 注: roomId のみでフィルタリング（orderBy が複合インデックスを必要とするため）
      // Firebase Console で「roomId」「createdAt」の複合インデックスを作成後は orderBy を追加可能
      const q = query(logsRef, where('roomId', '==', roomId));

      console.log('📊 Firestoreクエリを実行中... (roomId:', roomId, ')');
      const querySnapshot = await getDocs(q);
      console.log(
        '📊 クエリ結果:',
        querySnapshot.size,
        '件のドキュメントが見つかりました'
      );

      const logs: EditLog[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          userId: data['userId'],
          userName: data['userName'],
          userEmail: data['userEmail'] || undefined,
          projectId: data['projectId'],
          projectName: data['projectName'],
          taskId: data['taskId'] || undefined,
          taskName: data['taskName'] || undefined,
          action: data['action'],
          changeDescription: data['changeDescription'],
          oldValue: data['oldValue'] || undefined,
          newValue: data['newValue'] || undefined,
          changes: data['changes'] || undefined,
          createdAt: data['createdAt']?.toDate() || new Date(),
        } as EditLog);
      });

      // クライアント側でソート（降順）して最新の N 件を取得
      logs.sort((a, b) => {
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return timeB - timeA;
      });

      const paginatedLogs = logs.slice(0, this.LOGS_PER_PAGE);
      const lastDocument =
        querySnapshot.docs[querySnapshot.docs.length - 1] || null;

      console.log('✅ 編集ログを取得しました:', paginatedLogs.length, '件');
      return { logs: paginatedLogs, lastDocument };
    } catch (error) {
      console.error('❌ 編集ログの取得エラー:', error);
      const roomId = this.authService.getCurrentRoomId();
      console.error('📊 エラー時の状態 - roomId:', roomId);
      return { logs: [], lastDocument: null };
    }
  }

  /** 編集ログを追加取得（ページネーション） */
  async getMoreEditLogs(lastDoc: DocumentSnapshot): Promise<{
    logs: EditLog[];
    lastDocument: DocumentSnapshot | null;
  }> {
    try {
      const logsRef = collection(this.firestore, this.EDIT_LOGS_COLLECTION);
      const roomId = this.authService.getCurrentRoomId();
      if (!roomId) {
        return { logs: [], lastDocument: null };
      }
      // ⚠️ 注: 複合インデックスなしで実行可能なクエリに変更
      const q = query(logsRef, where('roomId', '==', roomId));

      const querySnapshot = await getDocs(q);
      const logs: EditLog[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          userId: data['userId'],
          userName: data['userName'],
          userEmail: data['userEmail'] || undefined,
          projectId: data['projectId'],
          projectName: data['projectName'],
          taskId: data['taskId'] || undefined,
          taskName: data['taskName'] || undefined,
          action: data['action'],
          changeDescription: data['changeDescription'],
          oldValue: data['oldValue'] || undefined,
          newValue: data['newValue'] || undefined,
          changes: data['changes'] || undefined,
          createdAt: data['createdAt']?.toDate() || new Date(),
        } as EditLog);
      });

      // クライアント側でソート・ページネーション
      logs.sort((a, b) => {
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return timeB - timeA;
      });

      const lastDocIndex = logs.findIndex((log) => log.id === lastDoc.id);
      const startIndex = lastDocIndex >= 0 ? lastDocIndex + 1 : 0;
      const paginatedLogs = logs.slice(
        startIndex,
        startIndex + this.LOGS_PER_PAGE
      );

      const lastDocument =
        paginatedLogs.length > 0
          ? querySnapshot.docs.find(
              (doc) => doc.id === paginatedLogs[paginatedLogs.length - 1].id
            ) || null
          : null;

      return { logs: paginatedLogs, lastDocument };
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
  exportToCSV(logs: EditLog[], getUserNameDisplay?: (log: EditLog) => string): void {
    try {
      const headers = [
        '日時',
        'ユーザー名',
        'プロジェクト名',
        'タスク名',
        'アクション',
        '変更内容',
      ];

      const csvData = logs.map((log) => [
        this.formatDate(log.createdAt),
        getUserNameDisplay ? getUserNameDisplay(log) : log.userName,
        log.projectName,
        log.taskName || '',
        this.getActionLabel(log.action),
        log.changeDescription,
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

  /**
   * ルーム内のすべての編集ログを削除
   */
  async deleteAllEditLogsInRoom(roomId: string): Promise<void> {
    console.log('🔍 EditLogService.deleteAllEditLogsInRoom が呼び出されました');
    console.log('ルームID:', roomId);

    if (!roomId || roomId.trim() === '') {
      throw new Error('ルームIDが指定されていません');
    }

    const logsRef = collection(this.firestore, this.EDIT_LOGS_COLLECTION);
    const roomQuery = query(logsRef, where('roomId', '==', roomId));
    const snapshot = await getDocs(roomQuery);

    console.log(`削除対象の編集ログ数: ${snapshot.size}件`);

    const deletePromises = snapshot.docs.map(async (logDoc) => {
      const logRef = doc(this.firestore, `${this.EDIT_LOGS_COLLECTION}/${logDoc.id}`);
      await deleteDoc(logRef);
      console.log(`✅ 編集ログを削除しました: ${logDoc.id}`);
    });

    await Promise.all(deletePromises);
    console.log(`✅ ルーム内のすべての編集ログを削除しました: ${snapshot.size}件`);
  }
}
