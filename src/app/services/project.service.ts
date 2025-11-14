import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  docData,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  limit,
} from '@angular/fire/firestore';
import {
  Observable,
  combineLatest,
  map,
  of,
  switchMap,
  firstValueFrom,
} from 'rxjs';
import { IProject } from '../models/project.model'; // 上の方に追加
import { Task, ChangeDetail } from '../models/task.model';
import { EditLogService } from './edit-log.service';
import { resolveProjectThemeColor } from '../constants/project-theme-colors';
import { AuthService } from './auth.service';
import { TaskService } from './task.service';
import { TaskAttachmentService } from './task-attachment.service';
import { ProjectAttachmentService } from './project-attachment.service';
import { LanguageService } from './language.service';

type ProjectWithRoom = IProject & { roomId?: string };
type TaskWithRoom = Task & { roomId?: string };

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly languageService = inject(LanguageService);

  constructor(
    private firestore: Firestore,
    private editLogService: EditLogService,
    private authService: AuthService,
    private taskService: TaskService,
    private taskAttachmentService: TaskAttachmentService,
    private projectAttachmentService: ProjectAttachmentService
  ) {}

  /** プロジェクトフィールド名を多言語対応で取得 */
  private getProjectFieldName(fieldKey: string): string {
    const fieldKeyMap: { [key: string]: string } = {
      projectName: 'logs.field.projectName',
      overview: 'logs.field.overview',
      startDate: 'logs.field.startDate',
      endDate: 'logs.field.endDate',
      themeColor: 'logs.field.themeColor',
      attachments: 'logs.field.attachments',
      responsible: 'logs.field.responsible',
      members: 'logs.field.members',
      milestone: 'logs.field.milestone',
    };
    const translationKey = fieldKeyMap[fieldKey];
    return translationKey
      ? this.languageService.translate(translationKey)
      : fieldKey;
  }

  /** 🔹 全プロジェクト一覧を取得 */
  getProjects(): Observable<IProject[]> {
    return this.authService.currentRoomId$.pipe(
      switchMap((roomId) => {
        if (!roomId) {
          return of([]);
        }
        const projectsRef = collection(this.firestore, 'projects');
        const roomQuery = query(projectsRef, where('roomId', '==', roomId));
        return collectionData(roomQuery, { idField: 'id' }) as Observable<
          IProject[]
        >;
      })
    );
  }

  /** 🔹 ルーム内のプロジェクト数を取得 */
  async getProjectCount(): Promise<number> {
    const roomId = this.authService.getCurrentRoomId();
    if (!roomId) {
      return 0;
    }
    const projectsRef = collection(this.firestore, 'projects');
    const roomQuery = query(projectsRef, where('roomId', '==', roomId));
    const snapshot = await getDocs(roomQuery);
    return snapshot.size;
  }

  /** 🔹 プロジェクト名の重複チェック（同じルーム内） */
  async projectNameExists(
    projectName: string,
    excludeProjectId?: string
  ): Promise<boolean> {
    if (!projectName || projectName.trim() === '') {
      return false;
    }
    const roomId = this.authService.getCurrentRoomId();
    if (!roomId) {
      return false;
    }
    const projectsRef = collection(this.firestore, 'projects');
    const roomQuery = query(
      projectsRef,
      where('roomId', '==', roomId),
      where('projectName', '==', projectName.trim()),
      limit(1)
    );
    const snapshot = await getDocs(roomQuery);

    // 編集時は自分自身を除外
    if (excludeProjectId && snapshot.size > 0) {
      const existingProject = snapshot.docs.find(
        (doc) => doc.id !== excludeProjectId
      );
      return !!existingProject;
    }

    return !snapshot.empty;
  }

  /** 🔹 ログイン中のユーザーに関連するプロジェクトのみを取得 */
  getUserProjects(
    userEmail: string,
    userName: string | null = null
  ): Observable<IProject[]> {
    return this.getProjects().pipe(
      map((allProjects) => {
        const normalizedEmail = (userEmail || '').trim().toLowerCase();
        const normalizedName =
          userName && userName.trim().length > 0 ? userName.trim() : null;

        console.log('📦 全プロジェクト取得数:', allProjects.length);
        console.log('🔍 フィルタリング対象ユーザー:', {
          email: normalizedEmail,
          name: normalizedName,
        });

        const filtered = allProjects.filter((project) => {
          const responsibleEmail =
            typeof project.responsibleEmail === 'string'
              ? project.responsibleEmail.trim().toLowerCase()
              : '';
          if (normalizedEmail && responsibleEmail === normalizedEmail) {
            console.log(
              `✅ [責任者(単数メール)] プロジェクト: ${project.projectName}`
            );
            return true;
          }

          if (Array.isArray(project.responsibles)) {
            const hasMatch = project.responsibles.some((entry: any) => {
              if (!entry) {
                return false;
              }
              const entryEmail =
                typeof entry.memberEmail === 'string'
                  ? entry.memberEmail.trim().toLowerCase()
                  : '';
              const entryName =
                typeof entry.memberName === 'string'
                  ? entry.memberName.trim()
                  : '';
              const emailMatch =
                !!normalizedEmail && entryEmail === normalizedEmail;
              const nameMatch =
                !!normalizedName && entryName === normalizedName;
              return emailMatch || nameMatch;
            });
            if (hasMatch) {
              console.log(
                `✅ [責任者(複数)] プロジェクト: ${project.projectName}`
              );
              return true;
            }
          }

          if (
            normalizedName &&
            typeof project.responsible === 'string' &&
            project.responsible.length > 0
          ) {
            const matchesName = project.responsible
              .split(',')
              .map((name) => name.trim())
              .filter((name) => !!name)
              .some((name) => name === normalizedName);
            if (matchesName) {
              console.log(
                `✅ [責任者(文字列)] プロジェクト: ${project.projectName}`
              );
              return true;
            }
          }

          if (project.members) {
            if (Array.isArray(project.members)) {
              const hasMember = project.members.some((member: any) => {
                if (!member) {
                  return false;
                }

                if (typeof member === 'string') {
                  const memberValue = member.trim();
                  return (
                    (normalizedEmail &&
                      memberValue.toLowerCase() === normalizedEmail) ||
                    (normalizedName && memberValue === normalizedName)
                  );
                }

                if (typeof member === 'object') {
                  const memberEmail =
                    typeof member.memberEmail === 'string'
                      ? member.memberEmail.trim().toLowerCase()
                      : typeof member.email === 'string'
                      ? member.email.trim().toLowerCase()
                      : '';
                  const memberName =
                    typeof member.memberName === 'string'
                      ? member.memberName.trim()
                      : typeof member.name === 'string'
                      ? member.name.trim()
                      : '';

                  const emailMatch =
                    !!normalizedEmail && memberEmail === normalizedEmail;
                  const nameMatch =
                    !!normalizedName && memberName === normalizedName;

                  return emailMatch || nameMatch;
                }

                return false;
              });

              if (hasMember) {
                console.log(
                  `✅ [メンバー(配列)] プロジェクト: ${project.projectName}`
                );
                return true;
              }
            } else if (typeof project.members === 'string') {
              const tokens = project.members
                .split(',')
                .map((token) => token.trim())
                .filter((token) => !!token);

              const emailMatch =
                !!normalizedEmail &&
                tokens
                  .map((token) => token.toLowerCase())
                  .some((token) => token === normalizedEmail);
              const nameMatch =
                !!normalizedName &&
                tokens.some((token) => token === normalizedName);

              if (emailMatch || nameMatch) {
                console.log(
                  `✅ [メンバー(文字列)] プロジェクト: ${project.projectName}`
                );
                return true;
              }
            }
          }

          return false;
        });

        console.log(`📊 フィルタリング後のプロジェクト数: ${filtered.length}`);
        return filtered;
      })
    );
  }

  /** 🔹 特定のプロジェクト内のタスクを取得 */
  getTasks(projectId: string): Observable<any[]> {
    const tasksRef = collection(this.firestore, `projects/${projectId}/tasks`);
    return collectionData(tasksRef, { idField: 'id' }) as Observable<any[]>;
  }

  /** 🔹 指定されたタスクを取得 */
  getTask(projectId: string, taskId: string): Observable<any> {
    const taskRef = doc(
      this.firestore,
      `projects/${projectId}/tasks/${taskId}`
    );
    const task$ = docData(taskRef, { idField: 'id' }) as Observable<any>;

    // デバッグ: 単一タスク取得時のデータを確認
    return task$.pipe(
      map((task) => {
        console.log(
          `[ProjectService.getTask] タスク「${task.taskName}」の生データ:`,
          task
        );
        console.log(
          `[ProjectService.getTask] タスク「${task.taskName}」のtags（生）:`,
          task.tags
        );
        console.log(
          `[ProjectService.getTask] タスク「${task.taskName}」の全キー:`,
          Object.keys(task)
        );
        return task;
      })
    );
  }

  getProjectById(projectId: string): Observable<IProject | null> {
    return this.authService.currentRoomId$.pipe(
      switchMap((roomId) => {
        if (!roomId) {
          return of(null);
        }
        const projectRef = doc(this.firestore, `projects/${projectId}`);
        const projectDoc$ = docData(projectRef, {
          idField: 'id',
        }) as Observable<ProjectWithRoom | undefined>;

        return projectDoc$.pipe(
          map((project) =>
            !project || project.roomId !== roomId ? null : (project as IProject)
          )
        );
      })
    );
  }

  /** 🔹 プロジェクトIDを指定してタスクを取得 */
  getTasksByProjectId(projectId: string): Observable<Task[]> {
    return this.getProjectById(projectId).pipe(
      switchMap((project) => {
        if (!project) {
          return of([]);
        }
        const tasksRef = collection(
          this.firestore,
          `projects/${projectId}/tasks`
        );
        const tasks$ = collectionData(tasksRef, {
          idField: 'id',
        }) as Observable<TaskWithRoom[]>;

        const projectWithRoom = project as ProjectWithRoom;
        const themeColor = resolveProjectThemeColor(project);
        const projectName = project.projectName || 'プロジェクト';
        const roomId = projectWithRoom.roomId;

        return tasks$.pipe(
          map((tasks) => {
            // デバッグ: Firestoreから取得した生のデータを確認
            console.log(
              `[ProjectService] プロジェクト「${projectName}」のタスク取得（生データ）:`,
              tasks.length,
              '件'
            );
            if (tasks.length > 0) {
              console.log('[ProjectService] 最初のタスクの生データ:', tasks[0]);
              console.log(
                '[ProjectService] 最初のタスクのtags（生）:',
                tasks[0].tags
              );
              console.log(
                '[ProjectService] 最初のタスクの全キー:',
                Object.keys(tasks[0])
              );
            }

            return tasks
              .filter((task) =>
                roomId ? !task.roomId || task.roomId === roomId : true
              )
              .map((task) => {
                const mappedTask = {
                  ...task,
                  projectId,
                  projectName: task.projectName || projectName,
                  projectThemeColor: task.projectThemeColor || themeColor,
                };
                // デバッグ: マッピング後のタスクデータを確認
                console.log(
                  `[ProjectService] タスク「${task.taskName}」マッピング後のtags:`,
                  mappedTask.tags
                );
                return mappedTask;
              }) as Task[];
          })
        );
      })
    );
  }

  /** ✅ 新しいプロジェクトを追加（今回追加する関数） */
  async addProject(project: any) {
    console.log('🔍 ProjectService.addProject が呼び出されました');
    console.log('プロジェクトデータ:', project);

    const roomId = this.authService.getCurrentRoomId();
    const roomDocId = this.authService.getCurrentRoomDocId();
    if (!roomId || !roomDocId) {
      throw new Error('ルーム情報が設定されていません');
    }

    const projectsRef = collection(this.firestore, 'projects');
    const projectPayload = { ...project, roomId, roomDocId };
    const result = await addDoc(projectsRef, projectPayload);

    console.log('✅ プロジェクトを作成しました:', result.id);

    // 編集ログを記録
    console.log('📝 編集ログを記録します...');
    const projectName =
      project.projectName ||
      this.languageService.translate('logs.projectFallback');
    const projectCreatedText = this.languageService.translateWithParams(
      'logs.message.projectCreatedWithName',
      { projectName }
    );
    await this.editLogService.logEdit(
      result.id,
      projectName,
      'create',
      projectCreatedText,
      undefined,
      undefined,
      undefined,
      projectName
    );

    console.log('✅ プロジェクト作成とログ記録が完了しました');
    return result;
  }

  /** ✅ プロジェクトを更新 */
  async updateProject(
    projectId: string,
    projectData: any,
    skipLogging: boolean = false
  ) {
    console.log('ProjectService.updateProject called with:', {
      projectId,
      projectData,
      projectDataKeys: Object.keys(projectData),
    });

    const projectRef = doc(this.firestore, `projects/${projectId}`);

    console.log('Firestore document reference:', projectRef.path);

    try {
      // 古いプロジェクトデータを取得
      const projectDoc = await getDoc(projectRef);
      let oldProject: IProject | null = null;
      if (projectDoc.exists()) {
        oldProject = projectDoc.data() as IProject;
      }

      // undefinedの値を削除（Firestoreはundefinedを許可しない）
      // 配列やオブジェクトの中のundefinedも再帰的に削除
      const cleanedProjectData: any = {};
      for (const [key, value] of Object.entries(projectData)) {
        if (value !== undefined) {
          cleanedProjectData[key] = this.cleanUndefinedValues(value);
        }
      }

      console.log(
        '[ProjectService.updateProject] 更新するプロジェクトデータ:',
        {
          projectId,
          projectDataKeys: Object.keys(cleanedProjectData),
          removedUndefinedKeys: Object.keys(projectData).filter(
            (key) => projectData[key] === undefined
          ),
        }
      );

      const result = await updateDoc(projectRef, cleanedProjectData);

      // プロジェクト名が変更された場合、そのプロジェクトのすべてのタスクのprojectNameも更新
      if (
        oldProject &&
        projectData.projectName &&
        oldProject.projectName &&
        projectData.projectName !== oldProject.projectName
      ) {
        console.log(
          'プロジェクト名が変更されました。タスクのprojectNameも更新します。',
          {
            oldProjectName: oldProject.projectName,
            newProjectName: projectData.projectName,
          }
        );

        try {
          const tasksRef = collection(
            this.firestore,
            `projects/${projectId}/tasks`
          );
          const tasksQuery = query(tasksRef);
          const tasksSnapshot = await getDocs(tasksQuery);

          // 各タスクのprojectNameを更新
          const updatePromises = tasksSnapshot.docs.map((taskDoc) => {
            const taskRef = doc(
              this.firestore,
              `projects/${projectId}/tasks/${taskDoc.id}`
            );
            return updateDoc(taskRef, { projectName: projectData.projectName });
          });

          await Promise.all(updatePromises);
          console.log(
            `✅ ${tasksSnapshot.docs.length}件のタスクのprojectNameを更新しました`
          );
        } catch (taskUpdateError: any) {
          console.error('タスクのprojectName更新エラー:', taskUpdateError);
          // タスク更新のエラーはプロジェクト更新を失敗させない
        }
      }

      // 変更があったフィールドのみをChangeDetail配列として作成
      const changeDetails: ChangeDetail[] = [];

      if (oldProject) {
        // プロジェクト名
        if (
          projectData.projectName !== undefined &&
          projectData.projectName !== oldProject['projectName']
        ) {
          changeDetails.push({
            field: this.getProjectFieldName('projectName'),
            oldValue: oldProject['projectName'] || '',
            newValue: projectData.projectName || '',
          });
        }

        // 説明（overview）
        if (
          projectData.overview !== undefined &&
          projectData.overview !== oldProject['overview']
        ) {
          changeDetails.push({
            field: this.getProjectFieldName('overview'),
            oldValue: oldProject['overview'] || '',
            newValue: projectData.overview || '',
          });
        }

        // 開始日
        if (
          projectData.startDate !== undefined &&
          projectData.startDate !== oldProject['startDate']
        ) {
          changeDetails.push({
            field: this.getProjectFieldName('startDate'),
            oldValue: oldProject['startDate'] || '',
            newValue: projectData.startDate || '',
          });
        }

        // 終了日
        if (
          projectData.endDate !== undefined &&
          projectData.endDate !== oldProject['endDate']
        ) {
          changeDetails.push({
            field: this.getProjectFieldName('endDate'),
            oldValue: oldProject['endDate'] || '',
            newValue: projectData.endDate || '',
          });
        }

        // テーマ色
        if (
          projectData.themeColor !== undefined &&
          projectData.themeColor !== oldProject['themeColor']
        ) {
          changeDetails.push({
            field: this.getProjectFieldName('themeColor'),
            oldValue: oldProject['themeColor'] || '',
            newValue: projectData.themeColor || '',
          });
        }

        // 資料（添付ファイル）
        if (projectData.attachments !== undefined) {
          const oldAttachments = Array.isArray(oldProject['attachments'])
            ? oldProject['attachments']
            : [];
          const newAttachments = Array.isArray(projectData.attachments)
            ? projectData.attachments
            : [];

          // 追加されたファイル
          const addedAttachments = newAttachments.filter(
            (newAtt: any) =>
              !oldAttachments.some((oldAtt: any) => oldAtt.id === newAtt.id)
          );
          addedAttachments.forEach((attachment: any) => {
            const fileName = attachment.name || 'ファイル';
            changeDetails.push({
              field: this.getProjectFieldName('attachments'),
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
              field: this.getProjectFieldName('attachments'),
              oldValue: fileName,
            });
          });
        }

        // 責任者
        if (
          projectData.responsible !== undefined &&
          projectData.responsible !== oldProject['responsible']
        ) {
          changeDetails.push({
            field: this.getProjectFieldName('responsible'),
            oldValue: oldProject['responsible'] || '',
            newValue: projectData.responsible || '',
          });
        }

        // メンバー
        if (
          projectData.members !== undefined &&
          projectData.members !== oldProject['members']
        ) {
          const oldMembers = oldProject['members'] || '';
          const newMembers = projectData.members || '';
          changeDetails.push({
            field: this.getProjectFieldName('members'),
            oldValue: oldMembers,
            newValue: newMembers,
          });
        }

        // マイルストーン
        if (projectData.milestones !== undefined) {
          const oldMilestones = Array.isArray(oldProject['milestones'])
            ? oldProject['milestones']
            : [];
          const newMilestones = Array.isArray(projectData.milestones)
            ? projectData.milestones
            : [];

          // 追加されたマイルストーン
          const addedMilestones = newMilestones.filter(
            (newMs: any) =>
              !oldMilestones.some((oldMs: any) => oldMs.id === newMs.id)
          );
          addedMilestones.forEach((milestone: any) => {
            const milestoneName = milestone.name || 'マイルストーン';
            const milestoneDate = milestone.date || '';
            const milestoneDisplayName =
              milestoneDate && milestoneName
                ? `${milestoneDate}　${milestoneName}`
                : milestoneName;
            changeDetails.push({
              field: this.getProjectFieldName('milestone'),
              newValue: milestoneDisplayName,
            });
          });

          // 削除されたマイルストーン
          const removedMilestones = oldMilestones.filter(
            (oldMs: any) =>
              !newMilestones.some((newMs: any) => newMs.id === oldMs.id)
          );
          removedMilestones.forEach((milestone: any) => {
            const milestoneName = milestone.name || 'マイルストーン';
            const milestoneDate = milestone.date || '';
            const milestoneDisplayName =
              milestoneDate && milestoneName
                ? `${milestoneDate}　${milestoneName}`
                : milestoneName;
            changeDetails.push({
              field: this.getProjectFieldName('milestone'),
              oldValue: milestoneDisplayName,
            });
          });
        }
      }

      // 編集ログを記録（changeDetailsは既に多言語対応済み）
      // 変更がない場合、またはskipLoggingがtrueの場合は編集ログを記録しない
      if (changeDetails.length > 0 && !skipLogging) {
        const projectUpdatedText = this.languageService.translate(
          'logs.projectUpdated'
        );
        const changeDescriptionText = `${projectUpdatedText} (${changeDetails
          .map((c) => `${c.field}: ${c.oldValue}→${c.newValue}`)
          .join(', ')})`;

        await this.editLogService.logEdit(
          projectId,
          projectData.projectName ||
            (oldProject ? oldProject['projectName'] : null) ||
            this.languageService.translate('logs.projectFallback'),
          'update',
          changeDescriptionText,
          undefined, // taskId
          undefined, // taskName
          undefined, // oldValue
          undefined, // newValue
          changeDetails // changes
        );
      }

      return result;
    } catch (error: any) {
      console.error('ProjectService.updateProject error:', error);
      console.error('Error details:', {
        code: error?.code,
        message: error?.message,
        projectId,
        projectData,
      });
      throw error;
    }
  }

  /** ✅ 特定プロジェクトにタスクを追加 */
  async addTaskToProject(projectId: string, taskData: any) {
    console.log('[ProjectService.addTaskToProject] 開始:', {
      projectId,
      taskDataKeys: Object.keys(taskData),
      parentTaskId: taskData.parentTaskId,
    });

    const roomId = this.authService.getCurrentRoomId();
    const roomDocId = this.authService.getCurrentRoomDocId();
    if (!roomId || !roomDocId) {
      throw new Error('ルーム情報が設定されていません');
    }

    // undefinedの値を削除（Firestoreはundefinedを許可しない）
    const cleanedTaskData = this.cleanUndefinedValues({
      ...taskData,
      roomId,
      roomDocId,
    });

    console.log('[ProjectService.addTaskToProject] cleanedTaskData:', {
      keys: Object.keys(cleanedTaskData),
      parentTaskId: cleanedTaskData.parentTaskId,
      attachments: cleanedTaskData.attachments,
    });

    const tasksRef = collection(this.firestore, `projects/${projectId}/tasks`);
    const result = await addDoc(tasksRef, cleanedTaskData);

    console.log('[ProjectService.addTaskToProject] タスク作成成功:', {
      taskId: result.id,
      projectId,
      parentTaskId: cleanedTaskData.parentTaskId,
    });

    // 編集ログを記録（エラーが発生してもタスク作成は成功とみなす）
    try {
      await this.editLogService.logEdit(
        projectId,
        taskData.projectName || 'プロジェクト',
        'create',
        `タスク「${taskData.taskName || 'タスク'}」を作成しました`,
        result.id,
        taskData.taskName || 'タスク',
        undefined,
        taskData.taskName || 'タスク'
      );
      console.log('[ProjectService.addTaskToProject] 編集ログ記録完了');
    } catch (logError: any) {
      console.error(
        '[ProjectService.addTaskToProject] 編集ログ記録エラー:',
        logError
      );
      // 編集ログのエラーは無視（タスク作成は成功している）
    }

    return result;
  }

  /** ✅ タスクを更新 */
  async updateTask(
    projectId: string,
    taskId: string,
    taskData: any,
    skipLogging: boolean = false
  ) {
    console.log('ProjectService.updateTask called with:', {
      projectId,
      taskId,
      taskData,
      taskDataKeys: Object.keys(taskData),
    });

    const taskRef = doc(
      this.firestore,
      `projects/${projectId}/tasks/${taskId}`
    );

    console.log('Firestore document reference:', taskRef.path);

    try {
      // 変更前の値を取得
      const oldTaskDoc = await getDoc(taskRef);
      const oldTaskData = oldTaskDoc.exists() ? oldTaskDoc.data() : {};

      // roomIdが未設定の場合は自動的に設定
      const roomId = this.authService.getCurrentRoomId();
      const roomDocId = this.authService.getCurrentRoomDocId();
      if (roomId && (!oldTaskData['roomId'] || !taskData.roomId)) {
        taskData.roomId = roomId;
      }
      if (roomDocId && (!oldTaskData['roomDocId'] || !taskData.roomDocId)) {
        taskData.roomDocId = roomDocId;
      }

      // undefinedの値を削除（Firestoreはundefinedを許可しない）
      // 配列やオブジェクトの中のundefinedも再帰的に削除
      const cleanedTaskData: any = {};
      for (const [key, value] of Object.entries(taskData)) {
        if (value !== undefined) {
          cleanedTaskData[key] = this.cleanUndefinedValues(value);
        }
      }

      console.log('[ProjectService.updateTask] cleanedTaskData:', {
        keys: Object.keys(cleanedTaskData),
        attachments: cleanedTaskData.attachments,
        attachmentsLength: cleanedTaskData.attachments?.length,
      });

      const result = await updateDoc(taskRef, cleanedTaskData);

      // 編集ログを記録 - ChangeDetail配列を生成
      const changeDetails: ChangeDetail[] = [];
      const changeStrings: string[] = [];

      // ステータスの変更
      if (taskData.status && oldTaskData['status'] !== taskData.status) {
        changeDetails.push({
          field: 'ステータス',
          oldValue: oldTaskData['status'] || '不明',
          newValue: taskData.status,
        });
        changeStrings.push(
          `ステータス: ${oldTaskData['status'] || '不明'} → ${taskData.status}`
        );
      }

      // タスク名の変更
      if (taskData.taskName && oldTaskData['taskName'] !== taskData.taskName) {
        changeDetails.push({
          field: 'タスク名',
          oldValue: oldTaskData['taskName'] || '不明',
          newValue: taskData.taskName,
        });
        changeStrings.push(
          `タスク名: ${oldTaskData['taskName'] || '不明'} → ${
            taskData.taskName
          }`
        );
      }

      // 優先度の変更
      if (taskData.priority && oldTaskData['priority'] !== taskData.priority) {
        changeDetails.push({
          field: '優先度',
          oldValue: oldTaskData['priority'] || '不明',
          newValue: taskData.priority,
        });
        changeStrings.push(
          `優先度: ${oldTaskData['priority'] || '不明'} → ${taskData.priority}`
        );
      }

      // 担当者の変更
      if (taskData.assignee && oldTaskData['assignee'] !== taskData.assignee) {
        const oldAssignee = oldTaskData['assignee']?.trim();
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
      if (taskData.dueDate && oldTaskData['dueDate'] !== taskData.dueDate) {
        changeDetails.push({
          field: '期限',
          oldValue: oldTaskData['dueDate'] || '不明',
          newValue: taskData.dueDate,
        });
        changeStrings.push(
          `期限: ${oldTaskData['dueDate'] || '不明'} → ${taskData.dueDate}`
        );
      }

      // 概要（説明）の変更
      if (
        taskData.description &&
        oldTaskData['description'] !== taskData.description
      ) {
        changeDetails.push({
          field: '概要',
          oldValue: oldTaskData['description'] || '変更なし',
          newValue: taskData.description,
        });
        changeStrings.push(
          `概要: ${oldTaskData['description'] || '変更なし'}→${
            taskData.description
          }に変更しました`
        );
      }

      // タグの変更（追加・削除）
      // taskData.tagsがundefinedの場合は、タグの変更を検出しない（他のフィールドのみ更新する場合）
      if (taskData.tags !== undefined) {
        const oldTags = oldTaskData['tags'] || [];
        const newTags = taskData.tags || [];
        const oldTagsStr = JSON.stringify(oldTags.sort());
        const newTagsStr = JSON.stringify(newTags.sort());

        if (oldTagsStr !== newTagsStr) {
          // 追加されたタグ
          const addedTags = newTags.filter(
            (tag: string) => !oldTags.includes(tag)
          );
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
      }

      // 変更がない場合、またはskipLoggingがtrueの場合は編集ログを記録しない
      if (changeDetails.length > 0 && !skipLogging) {
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

      return result;
    } catch (error: any) {
      console.error('ProjectService.updateTask error:', error);
      console.error('Error details:', {
        code: error?.code,
        message: error?.message,
        projectId,
        taskId,
        taskData,
      });
      throw error;
    }
  }

  /** undefinedの値を再帰的に削除（配列やオブジェクトの中も含む） */
  private cleanUndefinedValues(value: any): any {
    // undefinedの場合はスキップ（呼び出し元で既にチェック済み）
    if (value === undefined) {
      return undefined;
    }

    // nullは許可される
    if (value === null) {
      return null;
    }

    // 配列の場合
    if (Array.isArray(value)) {
      const cleaned = value
        .map((item) => this.cleanUndefinedValues(item))
        .filter((item) => item !== undefined);
      return cleaned;
    }

    // オブジェクトの場合
    if (typeof value === 'object' && value.constructor === Object) {
      const cleaned: any = {};
      for (const [key, val] of Object.entries(value)) {
        const cleanedVal = this.cleanUndefinedValues(val);
        if (cleanedVal !== undefined) {
          cleaned[key] = cleanedVal;
        }
      }
      return cleaned;
    }

    // プリミティブ値の場合
    return value;
  }

  /** ✅ プロジェクトを削除（プロジェクト内のすべてのタスクも削除） */
  async deleteProject(projectId: string, projectData: any) {
    console.log('🔍 ProjectService.deleteProject が呼び出されました');
    console.log(
      'プロジェクトID:',
      projectId,
      'プロジェクトデータ:',
      projectData
    );

    // プロジェクト内のすべてのタスクを削除
    await this.deleteAllTasksInProject(
      projectId,
      projectData.projectName || 'プロジェクト'
    );

    // プロジェクトの添付ファイルを削除
    if (projectData.attachments && Array.isArray(projectData.attachments)) {
      for (const attachment of projectData.attachments) {
        if (attachment.type === 'file' && attachment.storagePath) {
          try {
            await this.projectAttachmentService.deleteAttachment(attachment);
          } catch (error) {
            console.error('プロジェクトの添付ファイル削除エラー:', error);
            // エラーが発生してもプロジェクト削除は続行
          }
        }
      }
    }

    // プロジェクト自体を削除
    const projectRef = doc(this.firestore, `projects/${projectId}`);
    const result = await deleteDoc(projectRef);

    console.log('✅ プロジェクトを削除しました');

    // 編集ログを記録
    console.log('📝 編集ログを記録します...');
    const projectName =
      projectData.projectName ||
      this.languageService.translate('logs.projectFallback');
    const projectDeletedText = this.languageService.translateWithParams(
      'logs.message.projectDeletedWithName',
      { projectName }
    );
    await this.editLogService.logEdit(
      projectId,
      projectName,
      'delete',
      projectDeletedText,
      undefined,
      undefined,
      projectName,
      undefined
    );

    console.log('✅ プロジェクト削除とログ記録が完了しました');
    return result;
  }

  /**
   * プロジェクト内のすべてのタスクを削除（親タスクから順に削除）
   * @param projectId プロジェクトID
   * @param projectName プロジェクト名
   */
  private async deleteAllTasksInProject(
    projectId: string,
    projectName: string
  ): Promise<void> {
    console.log(`プロジェクト「${projectName}」内のタスクを削除開始`);

    // プロジェクト内のすべてのタスクを取得
    const tasksRef = collection(this.firestore, `projects/${projectId}/tasks`);
    const tasksSnapshot = await getDocs(tasksRef);

    if (tasksSnapshot.empty) {
      console.log('削除するタスクがありません');
      return;
    }

    const allTasks = tasksSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<{
      id: string;
      parentTaskId?: string;
      taskName?: string;
      attachments?: any[];
      [key: string]: any;
    }>;

    console.log(`削除対象タスク数: ${allTasks.length}件`);

    // 親タスク（parentTaskIdがないタスク）を取得
    const parentTasks = allTasks.filter(
      (task) => !task.parentTaskId || task.parentTaskId === ''
    );

    console.log(`親タスク数: ${parentTasks.length}件`);

    // 親タスクから順に削除（親タスク削除時に子タスクも自動的に削除される）
    const deletePromises = parentTasks.map(async (task) => {
      const taskId = task.id;
      const taskData = {
        taskName: task.taskName || 'タスク',
        projectName: projectName,
        attachments: task.attachments || [],
      };

      console.log(`親タスクを削除中: ${taskData.taskName} (ID: ${taskId})`);

      try {
        await this.taskService.deleteTask(taskId, taskData, projectId);
      } catch (error) {
        console.error(`タスク削除エラー (ID: ${taskId}):`, error);
        // エラーが発生しても他のタスクの削除は続行
      }
    });

    await Promise.all(deletePromises);

    console.log(`プロジェクト「${projectName}」内のすべてのタスクを削除完了`);
  }

  /** ✅ マイルストーンを追加 */
  async addMilestone(projectId: string, projectName: string, milestone: any) {
    console.log('🔍 ProjectService.addMilestone が呼び出されました');
    console.log('プロジェクトID:', projectId, 'マイルストーン:', milestone);

    // プロジェクトを取得してマイルストーンを追加
    const projectRef = doc(this.firestore, `projects/${projectId}`);
    const projectDoc = await docData(projectRef).pipe().toPromise();

    if (projectDoc) {
      const currentProject = projectDoc as any;
      const updatedMilestones = [
        ...(currentProject.milestones || []),
        milestone,
      ];

      const result = await updateDoc(projectRef, {
        milestones: updatedMilestones,
      });

      console.log('✅ マイルストーンを追加しました');

      // 編集ログを記録（プロジェクト更新として記録）
      console.log('📝 編集ログを記録します...');
      const milestoneName = milestone.name || 'マイルストーン';
      const milestoneDate = milestone.date || '';
      const milestoneDisplayName =
        milestoneDate && milestoneName
          ? `${milestoneDate}　${milestoneName}`
          : milestoneName;

      const changeDetails: ChangeDetail[] = [
        {
          field: this.getProjectFieldName('milestone'),
          newValue: milestoneDisplayName,
        },
      ];

      await this.editLogService.logEdit(
        projectId,
        projectName,
        'update',
        this.languageService.translate('logs.projectUpdated'),
        undefined,
        undefined,
        undefined,
        undefined,
        changeDetails
      );

      console.log('✅ マイルストーン追加とログ記録が完了しました');
      return result;
    }
  }

  /** ✅ マイルストーンを更新 */
  async updateMilestone(
    projectId: string,
    projectName: string,
    milestoneId: string,
    updatedMilestone: any,
    oldMilestone: any
  ) {
    console.log('🔍 ProjectService.updateMilestone が呼び出されました');
    console.log('プロジェクトID:', projectId, 'マイルストーンID:', milestoneId);

    // プロジェクトを取得してマイルストーンを更新
    const projectRef = doc(this.firestore, `projects/${projectId}`);
    const projectDoc = await docData(projectRef).pipe().toPromise();

    if (projectDoc) {
      const currentProject = projectDoc as any;
      const updatedMilestones = (currentProject.milestones || []).map(
        (m: any) => (m.id === milestoneId ? updatedMilestone : m)
      );

      const result = await updateDoc(projectRef, {
        milestones: updatedMilestones,
      });

      console.log('✅ マイルストーンを更新しました');

      // 編集ログを記録（プロジェクト更新として記録）
      const oldMilestoneName = oldMilestone?.name || 'マイルストーン';
      const oldMilestoneDate = oldMilestone?.date || '';
      const oldMilestoneDisplayName =
        oldMilestoneDate && oldMilestoneName
          ? `${oldMilestoneDate}　${oldMilestoneName}`
          : oldMilestoneName;

      const newMilestoneName = updatedMilestone.name || 'マイルストーン';
      const newMilestoneDate = updatedMilestone.date || '';
      const newMilestoneDisplayName =
        newMilestoneDate && newMilestoneName
          ? `${newMilestoneDate}　${newMilestoneName}`
          : newMilestoneName;

      const changeDetails: ChangeDetail[] = [
        {
          field: this.getProjectFieldName('milestone'),
          oldValue: oldMilestoneDisplayName,
          newValue: newMilestoneDisplayName,
        },
      ];

      console.log('📝 編集ログを記録します...');
      await this.editLogService.logEdit(
        projectId,
        projectName,
        'update',
        this.languageService.translate('logs.projectUpdated'),
        undefined,
        undefined,
        undefined,
        undefined,
        changeDetails
      );

      console.log('✅ マイルストーン更新とログ記録が完了しました');
      return result;
    }
  }

  /** ✅ マイルストーンを削除 */
  async deleteMilestone(
    projectId: string,
    projectName: string,
    milestoneId: string,
    milestone: any
  ) {
    console.log('🔍 ProjectService.deleteMilestone が呼び出されました');
    console.log('プロジェクトID:', projectId, 'マイルストーンID:', milestoneId);

    // プロジェクトを取得してマイルストーンを削除
    const projectRef = doc(this.firestore, `projects/${projectId}`);
    const projectDoc = await docData(projectRef).pipe().toPromise();

    if (projectDoc) {
      const currentProject = projectDoc as any;
      const updatedMilestones = (currentProject.milestones || []).filter(
        (m: any) => m.id !== milestoneId
      );

      const result = await updateDoc(projectRef, {
        milestones: updatedMilestones,
      });

      console.log('✅ マイルストーンを削除しました');

      // 編集ログを記録（プロジェクト更新として記録）
      console.log('📝 編集ログを記録します...');
      const milestoneName = milestone.name || 'マイルストーン';
      const milestoneDate = milestone.date || '';
      const milestoneDisplayName =
        milestoneDate && milestoneName
          ? `${milestoneDate}　${milestoneName}`
          : milestoneName;

      const changeDetails: ChangeDetail[] = [
        {
          field: this.getProjectFieldName('milestone'),
          oldValue: milestoneDisplayName,
        },
      ];

      await this.editLogService.logEdit(
        projectId,
        projectName,
        'update',
        this.languageService.translate('logs.projectUpdated'),
        undefined,
        undefined,
        undefined,
        undefined,
        changeDetails
      );

      console.log('✅ マイルストーン削除とログ記録が完了しました');
      return result;
    }
  }
}
