import { Injectable, inject } from '@angular/core';
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
  getDoc,
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
import { LanguageService } from './language.service';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly languageService = inject(LanguageService);

  constructor(
    private firestore: Firestore,
    private editLogService: EditLogService,
    private authService: AuthService,
    private memberManagementService: MemberManagementService,
    private taskAttachmentService: TaskAttachmentService
  ) {}

  /** タスクフィールド名を多言語対応で取得 */
  private getTaskFieldName(fieldKey: string): string {
    const fieldKeyMap: { [key: string]: string } = {
      status: 'logs.field.status',
      priority: 'logs.field.priority',
      assignee: 'logs.field.assignee',
      assignedMembers: 'logs.field.assignee',
      dueDate: 'logs.field.dueDate',
      taskName: 'logs.field.taskName',
      description: 'logs.field.description',
      tags: 'logs.field.tags',
      attachments: 'logs.field.attachments',
      calendarSyncEnabled: 'logs.field.calendarSync',
      notificationSettings: 'logs.field.notificationSettings',
      taskOrderManagement: 'logs.field.taskOrderManagement',
      estimatedWorkTime: 'logs.field.estimatedWorkTime',
    };
    const translationKey = fieldKeyMap[fieldKey];
    return translationKey
      ? this.languageService.translate(translationKey)
      : fieldKey;
  }

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
                    const taskPromise = getDocs(tasksRef).then(
                      (tasksSnapshot) => {
                        tasksSnapshot.docs.forEach((taskDoc) => {
                          const taskData = taskDoc.data();
                          const projectThemeColor = resolveProjectThemeColor(
                            projectData as any
                          );
                          // assignedMembersが正しく含まれているか確認
                          const assignedMembers = taskData['assignedMembers'];
                          if (assignedMembers) {
                            console.log(
                              '🔍 [TaskService.getQuickTasks] タスク:',
                              taskData['taskName']
                            );
                            console.log(
                              '   - assignedMembers:',
                              assignedMembers
                            );
                          }
                          allTasks.push({
                            id: taskDoc.id,
                            projectId,
                            projectName:
                              projectData['projectName'] || 'プロジェクト',
                            ...taskData,
                            assignedMembers: assignedMembers || undefined, // assignedMembersを明示的に設定
                            projectThemeColor,
                          } as Task);
                        });
                      }
                    );
                    promises.push(taskPromise);
                  });

                  const standalonePromise = getDocs(standaloneTasksQuery).then(
                    (tasksSnapshot) => {
                      tasksSnapshot.docs.forEach((taskDoc) => {
                        const taskData = taskDoc.data();
                        // assignedMembersが正しく含まれているか確認
                        const assignedMembers = taskData['assignedMembers'];
                        if (assignedMembers) {
                          console.log(
                            '🔍 [TaskService.getQuickTasks] スタンドアロンタスク:',
                            taskData['taskName']
                          );
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
                          (task.status === '未着手' ||
                            task.status === '作業中');

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
                          (task as any).assignedMembers.forEach(
                            (memberId: any) => {
                              if (typeof memberId === 'string') {
                                // メンバーIDからメンバー名を取得
                                const member = allMembers.find(
                                  (m) => m.id === memberId
                                );
                                const memberName = member
                                  ? member.name
                                  : memberId;

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
                                  assignees.push(
                                    memberId.name.trim().toLowerCase()
                                  );
                                if (memberId.memberEmail)
                                  assignees.push(
                                    memberId.memberEmail.trim().toLowerCase()
                                  );
                                if (memberId.email)
                                  assignees.push(
                                    memberId.email.trim().toLowerCase()
                                  );
                              }
                            }
                          );
                        }

                        // ③ assigneeEmail
                        if (task.assigneeEmail) {
                          assignees.push(
                            task.assigneeEmail.trim().toLowerCase()
                          );
                        }

                        assignees = [...new Set(assignees)];

                        const match =
                          members.length > 0
                            ? assignees.some((a) => members.includes(a))
                            : assignees.includes(
                                userEmail?.toLowerCase() || ''
                              );

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
      if (
        !parentTaskId ||
        parentTaskId === '' ||
        parentTaskId === null ||
        parentTaskId === undefined
      ) {
        parentTaskCount++;
      }
    });

    return parentTaskCount;
  }

  /** 🔹 親タスク内の子タスク数を取得 */
  async getChildTaskCount(
    projectId: string,
    parentTaskId: string
  ): Promise<number> {
    const tasksRef = collection(this.firestore, `projects/${projectId}/tasks`);
    const childTasksQuery = query(
      tasksRef,
      where('parentTaskId', '==', parentTaskId)
    );
    const snapshot = await getDocs(childTasksQuery);
    return snapshot.size;
  }

  /** 🔹 タスク名の重複チェック（ルーム全体の親タスク・子タスク両方） */
  async taskNameExists(
    projectId: string,
    taskName: string,
    excludeTaskId?: string
  ): Promise<boolean> {
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
      const tasksRef = collection(
        this.firestore,
        `projects/${projectIdToCheck}/tasks`
      );
      const tasksSnapshot = await getDocs(tasksRef);

      // すべてのタスク（親タスク・子タスク問わず）で、名前が一致するものを検索
      for (const taskDoc of tasksSnapshot.docs) {
        const data = taskDoc.data();

        if (data['taskName'] === trimmedTaskName) {
          // 編集時は自分自身を除外
          if (
            excludeTaskId &&
            taskDoc.id === excludeTaskId &&
            projectIdToCheck === projectId
          ) {
            continue;
          }
          return true;
        }
      }
    }

    return false;
  }

  /** 🔹 子タスク名の重複チェック（ルーム全体の親タスク・子タスク両方） */
  async childTaskNameExists(
    projectId: string,
    parentTaskId: string,
    taskName: string,
    excludeTaskId?: string
  ): Promise<boolean> {
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
      const tasksRef = collection(
        this.firestore,
        `projects/${projectIdToCheck}/tasks`
      );
      const tasksSnapshot = await getDocs(tasksRef);

      // すべてのタスク（親タスク・子タスク問わず）で、名前が一致するものを検索
      for (const taskDoc of tasksSnapshot.docs) {
        const data = taskDoc.data();

        if (data['taskName'] === trimmedTaskName) {
          // 編集時は自分自身を除外
          if (
            excludeTaskId &&
            taskDoc.id === excludeTaskId &&
            projectIdToCheck === projectId
          ) {
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
    projectId?: string,
    skipLogging: boolean = false
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

    // undefinedの値を削除（Firestoreはundefinedを許可しない）
    const cleanedTaskData: any = {};
    for (const [key, value] of Object.entries(taskData)) {
      if (value !== undefined) {
        cleanedTaskData[key] = value;
      }
    }

    console.log('[TaskService.updateTask] 更新するタスクデータ:', {
      taskId,
      projectId,
      tags: cleanedTaskData.tags,
      tagsLength: cleanedTaskData.tags?.length || 0,
      taskDataKeys: Object.keys(cleanedTaskData),
      removedUndefinedKeys: Object.keys(taskData).filter(
        (key) => taskData[key] === undefined
      ),
    });

    await updateDoc(taskRef, cleanedTaskData);

    const changeDetails: ChangeDetail[] = [];
    const unknownText = this.languageService.translate('logs.status.unknown');
    const notSetText = this.languageService.translate('logs.status.notSet');

    // ステータスの変更
    if (taskData.status && oldTaskData?.status !== taskData.status) {
      changeDetails.push({
        field: this.getTaskFieldName('status'),
        oldValue: oldTaskData?.status || unknownText,
        newValue: taskData.status,
      });
    }

    // 優先度の変更
    if (taskData.priority && oldTaskData?.priority !== taskData.priority) {
      changeDetails.push({
        field: this.getTaskFieldName('priority'),
        oldValue: oldTaskData?.priority || unknownText,
        newValue: taskData.priority,
      });
    }

    // 担当者の変更（assignedMembersを優先）
    const oldAssignedMembers = oldTaskData?.assignedMembers || [];
    const newAssignedMembers = taskData.assignedMembers || [];
    const oldAssignedMembersStr = JSON.stringify(
      Array.isArray(oldAssignedMembers) ? oldAssignedMembers.sort() : []
    );
    const newAssignedMembersStr = JSON.stringify(
      Array.isArray(newAssignedMembers) ? newAssignedMembers.sort() : []
    );

    if (oldAssignedMembersStr !== newAssignedMembersStr) {
      // assignedMembersの変更を記録
      // メンバー名を取得するために、メンバー管理サービスを使用
      const allMembers = await firstValueFrom(
        this.memberManagementService.getMembers()
      );

      const getMemberNames = (memberIds: string[]): string => {
        if (!Array.isArray(memberIds) || memberIds.length === 0) {
          return '';
        }
        const names = memberIds
          .map((id) => {
            const member = allMembers.find((m) => m.id === id);
            return member ? member.name : id;
          })
          .filter((name) => name.length > 0);
        return names.join('、');
      };

      const oldMemberNames = getMemberNames(
        Array.isArray(oldAssignedMembers) ? oldAssignedMembers : []
      );
      const newMemberNames = getMemberNames(
        Array.isArray(newAssignedMembers) ? newAssignedMembers : []
      );

      if (oldMemberNames && newMemberNames) {
        // 担当者が変更された場合
        changeDetails.push({
          field: this.getTaskFieldName('assignedMembers'),
          oldValue: oldMemberNames,
          newValue: newMemberNames,
        });
      } else if (newMemberNames) {
        // 担当者が追加された場合
        changeDetails.push({
          field: this.getTaskFieldName('assignedMembers'),
          newValue: newMemberNames,
        });
      } else if (oldMemberNames) {
        // 担当者が削除された場合
        changeDetails.push({
          field: this.getTaskFieldName('assignedMembers'),
          oldValue: oldMemberNames,
        });
      }
    } else if (
      taskData.assignee &&
      oldTaskData?.assignee !== taskData.assignee
    ) {
      // assignedMembersがない場合はassigneeを使用（後方互換性）
      const oldAssignee = oldTaskData?.assignee?.trim();
      const isNewAssignee =
        !oldAssignee || oldAssignee === '' || oldAssignee === unknownText;

      if (isNewAssignee) {
        // 担当者が追加された場合
        changeDetails.push({
          field: this.getTaskFieldName('assignee'),
          newValue: taskData.assignee,
        });
      } else {
        // 担当者が変更された場合
        changeDetails.push({
          field: this.getTaskFieldName('assignee'),
          oldValue: oldAssignee,
          newValue: taskData.assignee,
        });
      }
    }

    // 期限の変更
    if (taskData.dueDate && oldTaskData?.dueDate !== taskData.dueDate) {
      changeDetails.push({
        field: this.getTaskFieldName('dueDate'),
        oldValue: oldTaskData?.dueDate || unknownText,
        newValue: taskData.dueDate,
      });
    }

    // タスク名の変更
    if (taskData.taskName && oldTaskData?.taskName !== taskData.taskName) {
      changeDetails.push({
        field: this.getTaskFieldName('taskName'),
        oldValue: oldTaskData?.taskName || unknownText,
        newValue: taskData.taskName,
      });
    }

    // 概要（説明）の変更
    if (
      taskData.description &&
      oldTaskData?.description !== taskData.description
    ) {
      changeDetails.push({
        field: this.getTaskFieldName('description'),
        oldValue: oldTaskData?.description || notSetText,
        newValue: taskData.description,
      });
    }

    // タグの変更（追加・削除）
    const oldTags = oldTaskData?.tags || [];
    const newTags = taskData.tags || [];
    const oldTagsStr = JSON.stringify(oldTags.sort());
    const newTagsStr = JSON.stringify(newTags.sort());

    console.log('[TaskService.updateTask] タグ比較デバッグ:', {
      oldTags,
      newTags,
      oldTagsStr,
      newTagsStr,
      oldTagsType: typeof oldTaskData?.tags,
      newTagsType: typeof taskData.tags,
      oldTaskDataKeys: oldTaskData ? Object.keys(oldTaskData) : [],
      taskDataKeys: Object.keys(taskData),
    });

    if (oldTagsStr !== newTagsStr) {
      console.log('[TaskService.updateTask] タグの変更を検出しました');
      // 追加されたタグ
      const addedTags = newTags.filter((tag: string) => !oldTags.includes(tag));
      addedTags.forEach((tag: string) => {
        changeDetails.push({
          field: this.getTaskFieldName('tags'),
          newValue: tag,
        });
      });

      // 削除されたタグ
      const removedTags = oldTags.filter(
        (tag: string) => !newTags.includes(tag)
      );
      removedTags.forEach((tag: string) => {
        changeDetails.push({
          field: this.getTaskFieldName('tags'),
          oldValue: tag,
        });
      });
    }

    // 資料（添付ファイル）
    if (taskData.attachments !== undefined) {
      const oldAttachments = Array.isArray(oldTaskData?.attachments)
        ? oldTaskData.attachments
        : [];
      const newAttachments = Array.isArray(taskData.attachments)
        ? taskData.attachments
        : [];

      // 追加されたファイル
      const addedAttachments = newAttachments.filter(
        (newAtt: any) =>
          !oldAttachments.some((oldAtt: any) => oldAtt.id === newAtt.id)
      );
      addedAttachments.forEach((attachment: any) => {
        const fileName = attachment.name || 'ファイル';
        changeDetails.push({
          field: this.getTaskFieldName('attachments'),
          newValue: fileName,
        });
      });

      // 削除されたファイル
      const removedAttachments = oldAttachments.filter(
        (oldAtt: any) =>
          !newAttachments.some((newAtt: any) => newAtt.id === oldAtt.id)
      );
      removedAttachments.forEach((attachment: any) => {
        const fileName = attachment.name || 'ファイル';
        changeDetails.push({
          field: this.getTaskFieldName('attachments'),
          oldValue: fileName,
        });
      });
    }

    // 変更がない場合、またはskipLoggingがtrueの場合は編集ログを記録しない
    if (changeDetails.length > 0 && !skipLogging) {
      // タスク名を取得（taskDataに含まれていない場合はFirestoreから取得）
      let taskName = taskData.taskName;
      if (!taskName) {
        const taskDoc = await getDoc(taskRef);
        if (taskDoc.exists()) {
          taskName = taskDoc.data()?.['taskName'];
        }
      }
      // それでも取得できない場合はフォールバック値を使用
      if (!taskName) {
        taskName = this.languageService.translate('logs.field.taskName');
      }

      const taskUpdatedText =
        this.languageService.translate('logs.taskUpdated');
      const projectName =
        taskData.projectName ||
        this.languageService.translate('logs.projectFallback');

      await this.editLogService.logEdit(
        projectId,
        projectName,
        'update',
        taskUpdatedText,
        taskId,
        taskName,
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
    const unknownText = this.languageService.translate('logs.status.unknown');
    const changeDetails: ChangeDetail[] = [
      {
        field: this.getTaskFieldName('status'),
        oldValue: oldStatus || unknownText,
        newValue: newStatus,
      },
    ];

    // タスク名を取得（編集ログの表示用）
    const taskRef = doc(
      this.firestore,
      `projects/${projectId}/tasks/${taskId}`
    );
    const taskDoc = await getDoc(taskRef);
    const taskName = taskDoc.exists()
      ? taskDoc.data()?.['taskName']
      : undefined;

    // 編集ログを記録（changeDetailsを使用）
    const taskUpdatedText = this.languageService.translate('logs.taskUpdated');
    await this.editLogService.logEdit(
      projectId,
      projectName || this.languageService.translate('logs.projectFallback'),
      'update',
      taskUpdatedText,
      taskId,
      taskName,
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

    const projectName =
      task.projectName ||
      this.languageService.translate('logs.projectFallback');
    const taskName =
      task.taskName || this.languageService.translate('logs.field.taskName');
    const taskCreatedText = this.languageService.translateWithParams(
      'logs.message.taskCreatedWithName',
      { taskName }
    );
    await this.editLogService.logEdit(
      task.projectId || 'unknown',
      projectName,
      'create',
      taskCreatedText,
      result.id,
      taskName
    );
    return result;
  }

  /** ❌ タスク削除（親タスク削除時は子タスクも再帰的に削除） */
  async deleteTask(taskId: string, taskData: any, projectId?: string) {
    if (!projectId) throw new Error('プロジェクトIDが必要です');

    // 子タスクを再帰的に削除
    await this.deleteChildTasksRecursively(
      taskId,
      projectId,
      taskData.projectName || 'プロジェクト'
    );

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
    const projectName =
      taskData.projectName ||
      this.languageService.translate('logs.projectFallback');
    const taskName =
      taskData.taskName ||
      this.languageService.translate('logs.field.taskName');
    const taskDeletedText = this.languageService.translateWithParams(
      'logs.message.taskDeletedWithName',
      { taskName }
    );
    await this.editLogService.logEdit(
      projectId,
      projectName,
      'delete',
      taskDeletedText,
      taskId,
      taskName
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

      console.log(
        `子タスクを削除中: ${childTaskData['taskName']} (ID: ${childTaskId})`
      );

      // 子タスクの子タスクも再帰的に削除
      await this.deleteChildTasksRecursively(
        childTaskId,
        projectId,
        projectName
      );

      // 子タスクの添付ファイルを削除
      if (
        childTaskData['attachments'] &&
        Array.isArray(childTaskData['attachments'])
      ) {
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
