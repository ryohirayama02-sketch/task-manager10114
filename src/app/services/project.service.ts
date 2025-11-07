import { Injectable } from '@angular/core';
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
} from '@angular/fire/firestore';
import { Observable, combineLatest, map, of, switchMap } from 'rxjs';
import { IProject } from '../models/project.model'; // 上の方に追加
import { Task, ChangeDetail } from '../models/task.model';
import { EditLogService } from './edit-log.service';
import { resolveProjectThemeColor } from '../constants/project-theme-colors';
import { AuthService } from './auth.service';

type ProjectWithRoom = IProject & { roomId?: string };
type TaskWithRoom = Task & { roomId?: string };

@Injectable({ providedIn: 'root' })
export class ProjectService {
  constructor(
    private firestore: Firestore,
    private editLogService: EditLogService,
    private authService: AuthService
  ) {}

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
    const taskRef = doc(this.firestore, `projects/${projectId}/tasks/${taskId}`);
    return docData(taskRef, { idField: 'id' }) as Observable<any>;
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
          map((project) => (!project || project.roomId !== roomId ? null : (project as IProject)))
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
          map(
            (tasks) =>
              tasks
                .filter((task) =>
                  roomId ? !task.roomId || task.roomId === roomId : true
                )
                .map((task) => ({
                  ...task,
                  projectId,
                  projectName: task.projectName || projectName,
                  projectThemeColor: task.projectThemeColor || themeColor,
                })) as Task[]
          )
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
    await this.editLogService.logEdit(
      result.id,
      project.projectName || 'プロジェクト',
      'create',
      `プロジェクト「${project.projectName || 'プロジェクト'}」を作成しました`,
      undefined,
      undefined,
      undefined,
      project.projectName || 'プロジェクト'
    );

    console.log('✅ プロジェクト作成とログ記録が完了しました');
    return result;
  }

  /** ✅ プロジェクトを更新 */
  async updateProject(projectId: string, projectData: any) {
    console.log('ProjectService.updateProject called with:', {
      projectId,
      projectData,
      projectDataKeys: Object.keys(projectData),
    });

    const projectRef = doc(this.firestore, `projects/${projectId}`);

    console.log('Firestore document reference:', projectRef.path);

    try {
      const result = await updateDoc(projectRef, projectData);

      // 編集ログを記録
      const changes: string[] = [];
      if (projectData.projectName) {
        changes.push(`プロジェクト名: ${projectData.projectName}`);
      }
      if (projectData.description) {
        changes.push(`説明: ${projectData.description}`);
      }
      if (projectData.startDate) {
        changes.push(`開始日: ${projectData.startDate}`);
      }
      if (projectData.endDate) {
        changes.push(`終了日: ${projectData.endDate}`);
      }
      if (projectData.themeColor) {
        changes.push(`テーマ色: ${projectData.themeColor}`);
      }
      if (projectData.attachments) {
        const attachmentCount = Array.isArray(projectData.attachments)
          ? projectData.attachments.length
          : 0;
        changes.push(`資料: ${attachmentCount}件`);
      }
      if (projectData.responsible) {
        changes.push(`責任者: ${projectData.responsible}`);
      }

      await this.editLogService.logEdit(
        projectId,
        projectData.projectName || 'プロジェクト',
        'update',
        `プロジェクトを更新しました (${changes.join(', ')})`,
        undefined,
        undefined,
        undefined,
        changes.join(', ')
      );

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
    const roomId = this.authService.getCurrentRoomId();
    const roomDocId = this.authService.getCurrentRoomDocId();
    if (!roomId || !roomDocId) {
      throw new Error('ルーム情報が設定されていません');
    }

    const tasksRef = collection(this.firestore, `projects/${projectId}/tasks`);
    const result = await addDoc(tasksRef, { ...taskData, roomId, roomDocId });

    // 編集ログを記録
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

    return result;
  }

  /** ✅ タスクを更新 */
  async updateTask(projectId: string, taskId: string, taskData: any) {
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

      const result = await updateDoc(taskRef, taskData);

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
          `タスク名: ${oldTaskData['taskName'] || '不明'} → ${taskData.taskName}`
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
        const isNewAssignee = !oldAssignee || oldAssignee === '' || oldAssignee === '不明';

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
      if (taskData.description && oldTaskData['description'] !== taskData.description) {
        changeDetails.push({
          field: '概要',
          oldValue: oldTaskData['description'] || '変更なし',
          newValue: taskData.description,
        });
        changeStrings.push(
          `概要: ${oldTaskData['description'] || '変更なし'}→${taskData.description}に変更しました`
        );
      }

      // タグの変更（追加・削除）
      if (taskData.tags && JSON.stringify(oldTaskData['tags']) !== JSON.stringify(taskData.tags)) {
        const oldTags = oldTaskData['tags'] || [];
        const newTags = taskData.tags || [];

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
        const removedTags = oldTags.filter((tag: string) => !newTags.includes(tag));
        removedTags.forEach((tag: string) => {
          changeDetails.push({
            field: 'タグ',
            oldValue: tag,
          });
          changeStrings.push(`タグ: ${tag}が削除されました`);
        });
      }

      if (changeDetails.length > 0) {
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

  /** ✅ プロジェクトを削除 */
  async deleteProject(projectId: string, projectData: any) {
    console.log('🔍 ProjectService.deleteProject が呼び出されました');
    console.log(
      'プロジェクトID:',
      projectId,
      'プロジェクトデータ:',
      projectData
    );

    const projectRef = doc(this.firestore, `projects/${projectId}`);
    const result = await deleteDoc(projectRef);

    console.log('✅ プロジェクトを削除しました');

    // 編集ログを記録
    console.log('📝 編集ログを記録します...');
    await this.editLogService.logEdit(
      projectId,
      projectData.projectName || 'プロジェクト',
      'delete',
      `プロジェクト「${
        projectData.projectName || 'プロジェクト'
      }」を削除しました`,
      undefined,
      undefined,
      projectData.projectName || 'プロジェクト',
      undefined
    );

    console.log('✅ プロジェクト削除とログ記録が完了しました');
    return result;
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

      // 編集ログを記録
      console.log('📝 編集ログを記録します...');
      await this.editLogService.logEdit(
        projectId,
        projectName,
        'create',
        `マイルストーン「${milestone.name || 'マイルストーン'}」を追加しました`,
        undefined,
        undefined,
        undefined,
        milestone.name || 'マイルストーン'
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

      // 変更内容を特定
      const changes: string[] = [];
      if (
        updatedMilestone.name &&
        oldMilestone?.name !== updatedMilestone.name
      ) {
        changes.push(
          `名前: ${oldMilestone?.name || '不明'} → ${updatedMilestone.name}`
        );
      }
      if (
        updatedMilestone.date &&
        oldMilestone?.date !== updatedMilestone.date
      ) {
        changes.push(
          `日付: ${oldMilestone?.date || '不明'} → ${updatedMilestone.date}`
        );
      }
      if (
        updatedMilestone.description &&
        oldMilestone?.description !== updatedMilestone.description
      ) {
        changes.push(`説明: 変更されました`);
      }

      // 編集ログを記録
      if (changes.length > 0) {
        console.log('📝 編集ログを記録します...');
        await this.editLogService.logEdit(
          projectId,
          projectName,
          'update',
          `マイルストーン「${
            updatedMilestone.name || 'マイルストーン'
          }」を更新しました (${changes.join(', ')})`,
          undefined,
          undefined,
          oldMilestone ? JSON.stringify(oldMilestone) : undefined,
          changes.join(', ')
        );
      }

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

      // 編集ログを記録
      console.log('📝 編集ログを記録します...');
      await this.editLogService.logEdit(
        projectId,
        projectName,
        'delete',
        `マイルストーン「${milestone.name || 'マイルストーン'}」を削除しました`,
        undefined,
        undefined,
        milestone.name || 'マイルストーン',
        undefined
      );

      console.log('✅ マイルストーン削除とログ記録が完了しました');
      return result;
    }
  }
}
