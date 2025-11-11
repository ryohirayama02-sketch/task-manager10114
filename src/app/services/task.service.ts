import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  limit,
} from '@angular/fire/firestore';
import { Observable, of, switchMap, firstValueFrom } from 'rxjs';
import { EditLogService } from './edit-log.service';
import { AuthService } from './auth.service';
import { MemberManagementService } from './member-management.service';
import { Task, ChangeDetail } from '../models/task.model';
import {
  DEFAULT_PROJECT_THEME_COLOR,
  resolveProjectThemeColor,
} from '../constants/project-theme-colors';
import { TaskAttachmentService } from './task-attachment.service';

@Injectable({ providedIn: 'root' })
export class TaskService {
  constructor(
    private firestore: Firestore,
    private editLogService: EditLogService,
    private authService: AuthService,
    private memberManagementService: MemberManagementService,
    private taskAttachmentService: TaskAttachmentService
  ) {}

  /** 🔹 Firestoreからタスク一覧を取得 */
  getTasks(): Observable<any[]> {
    return this.authService.currentRoomId$.pipe(
      switchMap((roomId) => {
        if (!roomId) return of([]);
        const tasksRef = collection(this.firestore, 'tasks');
        const roomQuery = query(tasksRef, where('roomId', '==', roomId));
        return collectionData(roomQuery, { idField: 'id' }) as Observable<
          any[]
        >;
      })
    );
  }

  /** 🔹 すぐやるタスク（複数担当者＋デバッグログ付き） */
  getQuickTasks(
    days: number = 7,
    userEmail?: string,
    memberNames?: string | string[]
  ): Observable<Task[]> {
    const today = new Date();
    const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000); // 30日前
    const targetDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    const startDateStr = startDate.toISOString().split('T')[0];
    const targetDateStr = targetDate.toISOString().split('T')[0];

    return this.authService.currentRoomId$.pipe(
      switchMap((roomId) => {
        if (!roomId) return of([]);

        const projectsRef = collection(this.firestore, 'projects');
        const projectsQuery = query(projectsRef, where('roomId', '==', roomId));
        const standaloneTasksRef = collection(this.firestore, 'tasks');
        const standaloneTasksQuery = query(
          standaloneTasksRef,
          where('roomId', '==', roomId)
        );

        return new Observable<Task[]>((observer) => {
          // メンバー一覧を取得
          firstValueFrom(this.memberManagementService.getMembers())
            .then((allMembers) => {
              getDocs(projectsQuery)
                .then((projectsSnapshot) => {
                  const allTasks: Task[] = [];
                  const promises: Promise<void>[] = [];

                  projectsSnapshot.docs.forEach((projectDoc) => {
                    const projectId = projectDoc.id;
                    const projectData = projectDoc.data();
                    const tasksRef = collection(
                      this.firestore,
                      `projects/${projectId}/tasks`
                    );
                    const taskPromise = getDocs(tasksRef).then((tasksSnapshot) => {
                      tasksSnapshot.docs.forEach((taskDoc) => {
                        const taskData = taskDoc.data();
                        const projectThemeColor = resolveProjectThemeColor(
                          projectData as any
                        );
                        // assignedMembersが正しく含まれているか確認
                        const assignedMembers = taskData['assignedMembers'];
                        if (assignedMembers) {
                          console.log('🔍 [TaskService.getQuickTasks] タスク:', taskData['taskName']);
                          console.log('   - assignedMembers:', assignedMembers);
                        }
                        allTasks.push({
                          id: taskDoc.id,
                          projectId,
                          projectName: projectData['projectName'] || 'プロジェクト',
                          ...taskData,
                          assignedMembers: assignedMembers || undefined, // assignedMembersを明示的に設定
                          projectThemeColor,
                        } as Task);
                      });
                    });
                    promises.push(taskPromise);
                  });

                  const standalonePromise = getDocs(standaloneTasksQuery).then(
                    (tasksSnapshot) => {
                      tasksSnapshot.docs.forEach((taskDoc) => {
                        const taskData = taskDoc.data();
                        // assignedMembersが正しく含まれているか確認
                        const assignedMembers = taskData['assignedMembers'];
                        if (assignedMembers) {
                          console.log('🔍 [TaskService.getQuickTasks] スタンドアロンタスク:', taskData['taskName']);
                          console.log('   - assignedMembers:', assignedMembers);
                        }
                        allTasks.push({
                          id: taskDoc.id,
                          projectId: taskData['projectId'] || '',
                          projectName: taskData['projectName'] || 'タスク',
                          ...taskData,
                          assignedMembers: assignedMembers || undefined, // assignedMembersを明示的に設定
                          projectThemeColor: DEFAULT_PROJECT_THEME_COLOR,
                        } as Task);
                      });
                    }
                  );
                  promises.push(standalonePromise);

                  Promise.all(promises)
                    .then(() => {
                      const members = Array.isArray(memberNames)
                        ? memberNames.map((m) => m.trim().toLowerCase())
                        : memberNames
                        ? [memberNames.trim().toLowerCase()]
                        : [];

                      // 🔍 デバッグ情報
                      console.log('🔍 デバッグ情報:');
                      console.log('  userEmail:', userEmail);
                      console.log('  memberNames:', memberNames);
                      console.log('  members (小文字化):', members);
                      console.log('  全タスク数:', allTasks.length);

                      const filtered = allTasks.filter((task) => {
                        const due = task.dueDate;
                        const isWithin =
                          due >= startDateStr &&
                          due <= targetDateStr &&
                          (task.status === '未着手' || task.status === '作業中');

                        let assignees: string[] = [];

                        // ① assignee（カンマ区切り）
                        if (task.assignee) {
                          assignees.push(
                            ...task.assignee
                              .split(',')
                              .map((n) => n.trim().toLowerCase())
                              .filter((n) => n.length > 0)
                          );
                        }

                        // ② assignedMembers（メンバーIDからメンバー名に変換）
                        if (Array.isArray((task as any).assignedMembers)) {
                          (task as any).assignedMembers.forEach((memberId: any) => {
                            if (typeof memberId === 'string') {
                              // メンバーIDからメンバー名を取得
                              const member = allMembers.find((m) => m.id === memberId);
                              const memberName = member ? member.name : memberId;
                              
                              // メンバー名がカンマ区切りの場合も分割
                              const names = memberName
                                .split(',')
                                .map((n) => n.trim().toLowerCase())
                                .filter((n) => n.length > 0);
                              
                              assignees.push(...names);
                            } else if (typeof memberId === 'object') {
                              if (memberId.memberName)
                                assignees.push(
                                  memberId.memberName.trim().toLowerCase()
                                );
                              if (memberId.name)
                                assignees.push(memberId.name.trim().toLowerCase());
                              if (memberId.memberEmail)
                                assignees.push(
                                  memberId.memberEmail.trim().toLowerCase()
                                );
                              if (memberId.email)
                                assignees.push(memberId.email.trim().toLowerCase());
                            }
                          });
                        }

                        // ③ assigneeEmail
                        if (task.assigneeEmail) {
                          assignees.push(task.assigneeEmail.trim().toLowerCase());
                        }

                        assignees = [...new Set(assignees)];

                        const match =
                          members.length > 0
                            ? assignees.some((a) => members.includes(a))
                            : assignees.includes(userEmail?.toLowerCase() || '');

                        // ✅ デバッグ: マッチしたタスクをログ出力
                        if (match && isWithin) {
                          console.log('✅ マッチしたタスク:', {
                            taskName: task.taskName,
                            assignee: task.assignee,
                            assignedMembers: (task as any).assignedMembers,
                            計算されたassignees: assignees,
                            期日: task.dueDate,
                          });
                        }

                        return isWithin && match;
                      });

                      console.log('フィルター後のタスク数:', filtered.length);

                      observer.next(filtered);
                      observer.complete();
                    })
                    .catch((error) => observer.error(error));
                })
                .catch((error) => observer.error(error));
            })
            .catch((error) => {
              console.error('メンバー一覧の取得エラー:', error);
              observer.error(error);
            });
        });
      })
    );
  }

  /** 🔹 プロジェクト内の親タスク数を取得 */
  async getParentTaskCount(projectId: string): Promise<number> {
    const tasksRef = collection(this.firestore, `projects/${projectId}/tasks`);
    const snapshot = await getDocs(tasksRef);
    
    // parentTaskIdが空文字列、undefined、nullのタスクを親タスクとしてカウント
    let parentTaskCount = 0;
    snapshot.forEach((doc) => {
      const data = doc.data();
      const parentTaskId = data['parentTaskId'];
      if (!parentTaskId || parentTaskId === '' || parentTaskId === null || parentTaskId === undefined) {
        parentTaskCount++;
      }
    });
    
    return parentTaskCount;
  }

  /** 🔹 親タスク内の子タスク数を取得 */
  async getChildTaskCount(projectId: string, parentTaskId: string): Promise<number> {
    const tasksRef = collection(this.firestore, `projects/${projectId}/tasks`);
    const childTasksQuery = query(
      tasksRef,
      where('parentTaskId', '==', parentTaskId)
    );
    const snapshot = await getDocs(childTasksQuery);
    return snapshot.size;
  }

  /** 🔹 タスク名の重複チェック（ルーム全体の親タスク・子タスク両方） */
  async taskNameExists(projectId: string, taskName: string, excludeTaskId?: string): Promise<boolean> {
    if (!taskName || taskName.trim() === '') {
      return false;
    }
    const roomId = this.authService.getCurrentRoomId();
    if (!roomId) {
      return false;
    }
    
    // ルーム内のすべてのプロジェクトを取得
    const projectsRef = collection(this.firestore, 'projects');
    const roomProjectsQuery = query(projectsRef, where('roomId', '==', roomId));
    const projectsSnapshot = await getDocs(roomProjectsQuery);
    
    const trimmedTaskName = taskName.trim();
    
    // 各プロジェクトのタスクをチェック（親タスク・子タスク両方）
    for (const projectDoc of projectsSnapshot.docs) {
      const projectIdToCheck = projectDoc.id;
      const tasksRef = collection(this.firestore, `projects/${projectIdToCheck}/tasks`);
      const tasksSnapshot = await getDocs(tasksRef);
      
      // すべてのタスク（親タスク・子タスク問わず）で、名前が一致するものを検索
      for (const taskDoc of tasksSnapshot.docs) {
        const data = taskDoc.data();
        
        if (data['taskName'] === trimmedTaskName) {
          // 編集時は自分自身を除外
          if (excludeTaskId && taskDoc.id === excludeTaskId && projectIdToCheck === projectId) {
            continue;
          }
          return true;
        }
      }
    }
    
    return false;
  }

  /** 🔹 子タスク名の重複チェック（ルーム全体の親タスク・子タスク両方） */
  async childTaskNameExists(projectId: string, parentTaskId: string, taskName: string, excludeTaskId?: string): Promise<boolean> {
    if (!taskName || taskName.trim() === '') {
      return false;
    }
    const roomId = this.authService.getCurrentRoomId();
    if (!roomId) {
      return false;
    }
    
    // ルーム内のすべてのプロジェクトを取得
    const projectsRef = collection(this.firestore, 'projects');
    const roomProjectsQuery = query(projectsRef, where('roomId', '==', roomId));
    const projectsSnapshot = await getDocs(roomProjectsQuery);
    
    const trimmedTaskName = taskName.trim();
    
    // 各プロジェクトのタスクをチェック（親タスク・子タスク両方）
    for (const projectDoc of projectsSnapshot.docs) {
      const projectIdToCheck = projectDoc.id;
      const tasksRef = collection(this.firestore, `projects/${projectIdToCheck}/tasks`);
      const tasksSnapshot = await getDocs(tasksRef);
      
      // すべてのタスク（親タスク・子タスク問わず）で、名前が一致するものを検索
      for (const taskDoc of tasksSnapshot.docs) {
        const data = taskDoc.data();
        
        if (data['taskName'] === trimmedTaskName) {
          // 編集時は自分自身を除外
          if (excludeTaskId && taskDoc.id === excludeTaskId && projectIdToCheck === projectId) {
            continue;
          }
          return true;
        }
      }
    }
    
    return false;
  }

  /** 🔁 タスク更新 */
  async updateTask(
    taskId: string,
    taskData: any,
    oldTaskData?: any,
    projectId?: string
  ) {
    if (!projectId) throw new Error('プロジェクトIDが必要です');
    const taskRef = doc(
      this.firestore,
      `projects/${projectId}/tasks/${taskId}`
    );
    
    // roomIdが未設定の場合は自動的に設定
    const roomId = this.authService.getCurrentRoomId();
    if (roomId && (!oldTaskData?.roomId || !taskData.roomId)) {
      taskData.roomId = roomId;
    }
    
    // tagsが未設定の場合は空配列に設定（Firestoreに確実に保存されるように）
    if (!taskData.tags) {
      taskData.tags = [];
    }
    
    console.log('[TaskService.updateTask] 更新するタスクデータ:', {
      taskId,
      projectId,
      tags: taskData.tags,
      tagsLength: taskData.tags?.length || 0,
      taskDataKeys: Object.keys(taskData)
    });
    
    await updateDoc(taskRef, taskData);

    const changeDetails: ChangeDetail[] = [];
    const changeStrings: string[] = [];

    // ステータスの変更
    if (taskData.status && oldTaskData?.status !== taskData.status) {
      changeDetails.push({
        field: 'ステータス',
        oldValue: oldTaskData?.status || '不明',
        newValue: taskData.status,
      });
      changeStrings.push(
        `ステータス: ${oldTaskData?.status || '不明'} → ${taskData.status}`
      );
    }

    // 優先度の変更
    if (taskData.priority && oldTaskData?.priority !== taskData.priority) {
      changeDetails.push({
        field: '優先度',
        oldValue: oldTaskData?.priority || '不明',
        newValue: taskData.priority,
      });
      changeStrings.push(
        `優先度: ${oldTaskData?.priority || '不明'} → ${taskData.priority}`
      );
    }

    // 担当者の変更
    if (taskData.assignee && oldTaskData?.assignee !== taskData.assignee) {
      const oldAssignee = oldTaskData?.assignee?.trim();
      const isNewAssignee =
        !oldAssignee || oldAssignee === '' || oldAssignee === '不明';

      if (isNewAssignee) {
        // 担当者が追加された場合
        changeDetails.push({
          field: '担当者',
          newValue: taskData.assignee,
        });
        changeStrings.push(`担当者: ${taskData.assignee}が追加されました`);
      } else {
        // 担当者が変更された場合
        changeDetails.push({
          field: '担当者',
          oldValue: oldAssignee,
          newValue: taskData.assignee,
        });
        changeStrings.push(`担当者: ${oldAssignee} → ${taskData.assignee}`);
      }
    }

    // 期限の変更
    if (taskData.dueDate && oldTaskData?.dueDate !== taskData.dueDate) {
      changeDetails.push({
        field: '期限',
        oldValue: oldTaskData?.dueDate || '不明',
        newValue: taskData.dueDate,
      });
      changeStrings.push(
        `期限: ${oldTaskData?.dueDate || '不明'} → ${taskData.dueDate}`
      );
    }

    // タスク名の変更
    if (taskData.taskName && oldTaskData?.taskName !== taskData.taskName) {
      changeDetails.push({
        field: 'タスク名',
        oldValue: oldTaskData?.taskName || '不明',
        newValue: taskData.taskName,
      });
      changeStrings.push(
        `タスク名: ${oldTaskData?.taskName || '不明'} → ${taskData.taskName}`
      );
    }

    // 概要（説明）の変更
    if (
      taskData.description &&
      oldTaskData?.description !== taskData.description
    ) {
      changeDetails.push({
        field: '概要',
        oldValue: oldTaskData?.description || '変更なし',
        newValue: taskData.description,
      });
      changeStrings.push(
        `概要: ${oldTaskData?.description || '変更なし'}→${
          taskData.description
        }に変更しました`
      );
    }

    // タグの変更（追加・削除）
    const oldTags = oldTaskData?.tags || [];
    const newTags = taskData.tags || [];
    const oldTagsStr = JSON.stringify(oldTags.sort());
    const newTagsStr = JSON.stringify(newTags.sort());
    
    if (oldTagsStr !== newTagsStr) {
      // 追加されたタグ
      const addedTags = newTags.filter((tag: string) => !oldTags.includes(tag));
      addedTags.forEach((tag: string) => {
        changeDetails.push({
          field: 'タグ',
          newValue: tag,
        });
        changeStrings.push(`タグ: ${tag}が追加されました`);
      });

      // 削除されたタグ
      const removedTags = oldTags.filter(
        (tag: string) => !newTags.includes(tag)
      );
      removedTags.forEach((tag: string) => {
        changeDetails.push({
          field: 'タグ',
          oldValue: tag,
        });
        changeStrings.push(`タグ: ${tag}が削除されました`);
      });
    }

    if (changeStrings.length > 0) {
      await this.editLogService.logEdit(
        projectId,
        taskData.projectName || 'プロジェクト',
        'update',
        `タスク「${
          taskData.taskName || 'タスク'
        }」を更新しました (${changeStrings.join(', ')})`,
        taskId,
        taskData.taskName || 'タスク',
        undefined,
        undefined,
        changeDetails
      );
    }
  }

  /** 🔁 ステータス変更 */
  async updateTaskStatus(
    taskId: string,
    newStatus: string,
    oldStatus?: string,
    projectId?: string,
    projectName?: string
  ) {
    if (!projectId) throw new Error('プロジェクトIDが必要です');
    const ref = doc(this.firestore, `projects/${projectId}/tasks/${taskId}`);
    await updateDoc(ref, { status: newStatus });

    // ChangeDetail配列を生成
    const changeDetails: ChangeDetail[] = [
      {
        field: 'ステータス',
        oldValue: oldStatus || '不明',
        newValue: newStatus,
      },
    ];

    await this.editLogService.logEdit(
      projectId,
      projectName || 'プロジェクト',
      'update',
      `タスクのステータスを「${
        oldStatus || '不明'
      }」→「${newStatus}」に変更しました`,
      taskId,
      undefined,
      oldStatus,
      newStatus,
      changeDetails
    );

    console.log('✅ updateTaskStatus 完了');
  }

  /** ➕ タスク追加 */
  async addTask(task: any) {
    const roomId = this.authService.getCurrentRoomId();
    if (!roomId) throw new Error('ルームIDが設定されていません');
    const ref = collection(this.firestore, 'tasks');
    const result = await addDoc(ref, { ...task, roomId });

    await this.editLogService.logEdit(
      task.projectId || 'unknown',
      task.projectName || 'プロジェクト',
      'create',
      `タスク「${task.taskName || 'タスク'}」を作成しました`,
      result.id
    );
    return result;
  }

  /** ❌ タスク削除（親タスク削除時は子タスクも再帰的に削除） */
  async deleteTask(taskId: string, taskData: any, projectId?: string) {
    if (!projectId) throw new Error('プロジェクトIDが必要です');

    // 子タスクを再帰的に削除
    await this.deleteChildTasksRecursively(taskId, projectId, taskData.projectName || 'プロジェクト');

    // 添付ファイルを削除
    if (taskData.attachments && Array.isArray(taskData.attachments)) {
      for (const attachment of taskData.attachments) {
        if (attachment.type === 'file' && attachment.storagePath) {
          try {
            await this.taskAttachmentService.deleteAttachment(attachment);
          } catch (error) {
            console.error('添付ファイルの削除エラー:', error);
            // エラーが発生してもタスク削除は続行
          }
        }
      }
    }

    // タスク自体を削除
    const ref = doc(this.firestore, `projects/${projectId}/tasks/${taskId}`);
    await deleteDoc(ref);

    // 削除ログを記録
    await this.editLogService.logEdit(
      projectId,
      taskData.projectName || 'プロジェクト',
      'delete',
      `タスク「${taskData.taskName}」を削除しました`,
      taskId,
      taskData.taskName
    );
  }

  /**
   * 子タスクを再帰的に削除
   * @param parentTaskId 親タスクID
   * @param projectId プロジェクトID
   * @param projectName プロジェクト名
   */
  private async deleteChildTasksRecursively(
    parentTaskId: string,
    projectId: string,
    projectName: string
  ): Promise<void> {
    // 子タスクを取得
    const tasksRef = collection(this.firestore, `projects/${projectId}/tasks`);
    const childTasksQuery = query(
      tasksRef,
      where('parentTaskId', '==', parentTaskId)
    );
    const childTasksSnapshot = await getDocs(childTasksQuery);

    // 各子タスクを再帰的に削除
    const deletePromises = childTasksSnapshot.docs.map(async (childTaskDoc) => {
      const childTaskData = childTaskDoc.data();
      const childTaskId = childTaskDoc.id;

      console.log(`子タスクを削除中: ${childTaskData['taskName']} (ID: ${childTaskId})`);

      // 子タスクの子タスクも再帰的に削除
      await this.deleteChildTasksRecursively(childTaskId, projectId, projectName);

      // 子タスクの添付ファイルを削除
      if (childTaskData['attachments'] && Array.isArray(childTaskData['attachments'])) {
        for (const attachment of childTaskData['attachments']) {
          if (attachment.type === 'file' && attachment.storagePath) {
            try {
              await this.taskAttachmentService.deleteAttachment(attachment);
            } catch (error) {
              console.error('子タスクの添付ファイル削除エラー:', error);
              // エラーが発生してもタスク削除は続行
            }
          }
        }
      }

      // 子タスクを削除
      const childTaskRef = doc(
        this.firestore,
        `projects/${projectId}/tasks/${childTaskId}`
      );
      await deleteDoc(childTaskRef);

      // 子タスクの削除ログを記録
      await this.editLogService.logEdit(
        projectId,
        projectName,
        'delete',
        `子タスク「${childTaskData['taskName']}」を削除しました（親タスク削除に伴う）`,
        childTaskId,
        childTaskData['taskName']
      );
    });

    await Promise.all(deletePromises);
  }
}
