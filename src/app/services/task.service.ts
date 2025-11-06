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
  orderBy,
} from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import { EditLogService } from './edit-log.service';
import { AuthService } from './auth.service';
import { Task } from '../models/task.model';
import {
  DEFAULT_PROJECT_THEME_COLOR,
  resolveProjectThemeColor,
} from '../constants/project-theme-colors';

@Injectable({ providedIn: 'root' })
export class TaskService {
  constructor(
    private firestore: Firestore,
    private editLogService: EditLogService,
    private authService: AuthService
  ) {}

  /** Firestoreからタスク一覧を取得 */
  getTasks(): Observable<any[]> {
    return this.authService.currentRoomId$.pipe(
      switchMap((roomId) => {
        if (!roomId) {
          return of([]);
        }
        const tasksRef = collection(this.firestore, 'tasks');
        const roomQuery = query(tasksRef, where('roomId', '==', roomId));
        return collectionData(roomQuery, { idField: 'id' }) as Observable<
          any[]
        >;
      })
    );
  }

  /** デバッグ用：すべてのタスクを取得 */
  getAllTasksForDebug(): Observable<any[]> {
    console.log('🔍 デバッグ用：すべてのタスクを取得中...');
    return this.authService.currentRoomId$.pipe(
      switchMap((roomId) => {
        if (!roomId) {
          return of([]);
        }
        const projectsRef = collection(this.firestore, 'projects');
        const projectsQuery = query(projectsRef, where('roomId', '==', roomId));

        return new Observable<any[]>((observer) => {
          getDocs(projectsQuery)
            .then((projectsSnapshot) => {
              console.log(
                `📁 全プロジェクト数: ${projectsSnapshot.docs.length}`
              );
              const allTasks: any[] = [];
              const taskPromises: Promise<void>[] = [];

              projectsSnapshot.docs.forEach((projectDoc) => {
                const projectId = projectDoc.id;
                const projectData = projectDoc.data();
                console.log(
                  `📁 プロジェクト: ${projectData['projectName']} (${projectId})`
                );

                const tasksRef = collection(
                  this.firestore,
                  `projects/${projectId}/tasks`
                );
                const tasksQuery = query(tasksRef);

                const taskPromise = getDocs(tasksQuery).then(
                  (tasksSnapshot) => {
                    console.log(
                      `  📋 プロジェクト ${projectData['projectName']} の全タスク数: ${tasksSnapshot.docs.length}`
                    );
                    tasksSnapshot.docs.forEach((taskDoc) => {
                      const taskData = taskDoc.data();
                      console.log(
                        `    📋 タスク: ${taskData['taskName']}, 期日: ${taskData['dueDate']}, ステータス: ${taskData['status']}, 担当者: ${taskData['assignee']}`
                      );
                      const projectThemeColor = resolveProjectThemeColor(
                        projectData as any
                      );
                      allTasks.push({
                        id: taskDoc.id,
                        projectId: projectId,
                        projectName:
                          projectData['projectName'] || 'プロジェクト',
                        ...taskData,
                        projectThemeColor,
                      });
                    });
                  }
                );

                taskPromises.push(taskPromise);
              });

              Promise.all(taskPromises)
                .then(() => {
                  console.log(`📊 全タスク数: ${allTasks.length}`);
                  observer.next(allTasks);
                  observer.complete();
                })
                .catch((error) => {
                  console.error('❌ 全タスク取得エラー:', error);
                  observer.error(error);
                });
            })
            .catch((error) => {
              console.error('❌ プロジェクト取得エラー:', error);
              observer.error(error);
            });
        });
      })
    );
  }

  /** 指定した日数以内の未完了タスクを取得 */
  getQuickTasks(
    days: number = 7,
    userEmail?: string,
    userName?: string
  ): Observable<Task[]> {
    const today = new Date();
    const targetDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().split('T')[0];
    const targetDateStr = targetDate.toISOString().split('T')[0];

    console.log('🔍 すぐやるタスク取得開始');
    console.log(`📅 今日: ${todayStr}`);
    console.log(`📅 対象日: ${targetDateStr} (${days}日後)`);
    console.log(`📅 検索範囲: ${todayStr} から ${targetDateStr} まで`);
    if (userEmail) {
      console.log(`👤 ユーザーフィルタ: ${userEmail}`);
    }
    if (userName) {
      console.log(`👤 ユーザー名フィルタ: ${userName}`);
    }

    const normalizedEmail = userEmail?.trim().toLowerCase() || null;
    const normalizedName = userName?.trim() || null;

    return this.authService.currentRoomId$.pipe(
      switchMap((roomId) => {
        if (!roomId) {
          return of([]);
        }
        const projectsRef = collection(this.firestore, 'projects');
        const projectsQuery = query(
          projectsRef,
          where('roomId', '==', roomId)
        );
        const standaloneTasksRef = collection(this.firestore, 'tasks');
        const standaloneTasksQuery = query(
          standaloneTasksRef,
          where('roomId', '==', roomId)
        );

        return new Observable<Task[]>((observer) => {
          getDocs(projectsQuery)
            .then((projectsSnapshot) => {
              console.log(`📁 プロジェクト数: ${projectsSnapshot.docs.length}`);
              const allTasks: Task[] = [];
              const taskPromises: Promise<void>[] = [];

              projectsSnapshot.docs.forEach((projectDoc) => {
                const projectId = projectDoc.id;
                const projectData = projectDoc.data();
                console.log(
                  `📁 プロジェクト: ${projectData['projectName']} (${projectId})`
                );

                const tasksRef = collection(
                  this.firestore,
                  `projects/${projectId}/tasks`
                );
                const tasksQuery = query(tasksRef);

                const taskPromise = getDocs(tasksQuery).then(
                  (tasksSnapshot) => {
                    console.log(
                      `  📋 プロジェクト ${projectData['projectName']} のタスク数: ${tasksSnapshot.docs.length}`
                    );
                    tasksSnapshot.docs.forEach((taskDoc) => {
                      const taskData = taskDoc.data();
                      console.log(
                        `    📋 タスク: ${taskData['taskName']}, 期日: ${taskData['dueDate']}, ステータス: ${taskData['status']}, 担当者: ${taskData['assignee']}`
                      );
                      const projectThemeColor = resolveProjectThemeColor(
                        projectData as any
                      );
                      allTasks.push({
                        id: taskDoc.id,
                        projectId: projectId,
                        projectName:
                          projectData['projectName'] || 'プロジェクト',
                        ...taskData,
                        projectThemeColor,
                      } as Task);
                    });
                  }
                );

                taskPromises.push(taskPromise);
              });

              const standaloneTaskPromise = getDocs(standaloneTasksQuery).then(
                (tasksSnapshot) => {
                  console.log(
                    `📋 ルーム直下タスク数: ${tasksSnapshot.docs.length}`
                  );
                  tasksSnapshot.docs.forEach((taskDoc) => {
                    const taskData = taskDoc.data();
                    const standaloneColor =
                      typeof taskData['projectThemeColor'] === 'string'
                        ? taskData['projectThemeColor']
                        : DEFAULT_PROJECT_THEME_COLOR;
                    allTasks.push({
                      id: taskDoc.id,
                      projectId: taskData['projectId'] || '',
                      projectName: taskData['projectName'] || 'タスク',
                      ...taskData,
                      projectThemeColor: standaloneColor,
                    } as Task);
                  });
                }
              );
              taskPromises.push(standaloneTaskPromise);

              Promise.all(taskPromises)
                .then(() => {
                  console.log(
                    `📊 全タスク数（フィルタリング前）: ${allTasks.length}`
                  );

                  const sortedTasks = allTasks.sort((a, b) => {
                    if (a.dueDate < b.dueDate) return -1;
                    if (a.dueDate > b.dueDate) return 1;

                    const priorityOrder = { 高: 3, 中: 2, 低: 1 };
                    const aPriority = priorityOrder[a.priority] || 0;
                    const bPriority = priorityOrder[b.priority] || 0;

                    return bPriority - aPriority;
                  });

                  const filteredTasks = sortedTasks.filter((task) => {
                    const taskDueDate = task.dueDate;
                    const isWithinDateRange =
                      taskDueDate >= todayStr && taskDueDate <= targetDateStr;

                    const isIncomplete =
                      task.status === '未着手' || task.status === '作業中';

                    let isAssignedToUser = true;
                    if (normalizedEmail || normalizedName) {
                      const assigneeName =
                        typeof task.assignee === 'string'
                          ? task.assignee.trim()
                          : '';
                      const assigneeEmail =
                        typeof task.assigneeEmail === 'string'
                          ? task.assigneeEmail.trim().toLowerCase()
                          : '';
                      const assigneeNameLower =
                        typeof task.assignee === 'string'
                          ? task.assignee.trim().toLowerCase()
                          : '';

                      const emailMatches = normalizedEmail
                        ? assigneeEmail === normalizedEmail ||
                          assigneeNameLower === normalizedEmail
                        : false;

                      const nameMatches = normalizedName
                        ? assigneeName === normalizedName
                        : false;

                      let assignedMemberMatch = false;
                      const assignedMembers = Array.isArray(
                        (task as any).assignedMembers
                      )
                        ? ((task as any).assignedMembers as any[])
                        : [];

                      assignedMemberMatch = assignedMembers.some((member) => {
                        if (!member) {
                          return false;
                        }
                        if (typeof member === 'string') {
                          const value = member.trim();
                          return (
                            (normalizedName && value === normalizedName) ||
                            (normalizedEmail &&
                              value.toLowerCase() === normalizedEmail)
                          );
                        }
                        if (typeof member === 'object') {
                          const memberName =
                            typeof member.memberName === 'string'
                              ? member.memberName.trim()
                              : typeof member.name === 'string'
                              ? member.name.trim()
                              : '';
                          const memberEmail =
                            typeof member.memberEmail === 'string'
                              ? member.memberEmail.trim().toLowerCase()
                              : typeof member.email === 'string'
                              ? member.email.trim().toLowerCase()
                              : '';
                          const matchByName =
                            normalizedName && memberName === normalizedName;
                          const matchByEmail =
                            normalizedEmail &&
                            memberEmail &&
                            memberEmail === normalizedEmail;
                          return Boolean(matchByName || matchByEmail);
                        }
                        return false;
                      });

                      isAssignedToUser = Boolean(
                        emailMatches || nameMatches || assignedMemberMatch
                      );
                    }

                    const shouldInclude =
                      isWithinDateRange && isIncomplete && isAssignedToUser;

                    if (!shouldInclude) {
                      console.log(
                        `❌ タスク「${task.taskName}」が条件に合致しない:`,
                        {
                          isWithinDateRange,
                          isIncomplete,
                          isAssignedToUser,
                          dueDate: taskDueDate,
                          status: task.status,
                          assignee: task.assignee,
                        }
                      );
                    }

                    return shouldInclude;
                  });

                  console.log(`📊 フィルタリング後: ${filteredTasks.length}件`);

                  if (filteredTasks.length > 0) {
                    console.log('📋 取得されたタスク一覧:');
                    filteredTasks.forEach((task, index) => {
                      console.log(
                        `  ${index + 1}. ${task.taskName} (${task.projectName}) - 期日: ${task.dueDate}, ステータス: ${task.status}, 担当者: ${task.assignee}`
                      );
                    });
                  } else {
                    console.log('⚠️ 該当するタスクが見つかりませんでした');
                  }
                  observer.next(filteredTasks);
                  observer.complete();
                })
                .catch((error) => {
                  console.error('❌ すぐやるタスク取得エラー:', error);
                  observer.error(error);
                });
            })
            .catch((error) => {
              console.error('❌ プロジェクト取得エラー:', error);
              observer.error(error);
            });
        });
      })
    );
  }

  /** Firestoreに新しいタスクを追加 */
  async addTask(task: any) {
    console.log('🔍 TaskService.addTask が呼び出されました');
    console.log('タスクデータ:', task);

    const roomId = this.authService.getCurrentRoomId();
    if (!roomId) {
      throw new Error('ルームIDが設定されていません');
    }

    const tasksRef = collection(this.firestore, 'tasks');
    const result = await addDoc(tasksRef, { ...task, roomId });

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
