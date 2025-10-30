import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  docData,
  updateDoc,
  deleteDoc,
} from '@angular/fire/firestore';
import { Observable, combineLatest, map } from 'rxjs';
import { IProject } from '../models/project.model'; // 上の方に追加
import { EditLogService } from './edit-log.service';
import { resolveProjectThemeColor } from '../constants/project-theme-colors';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  constructor(
    private firestore: Firestore,
    private editLogService: EditLogService
  ) {}

  /** 🔹 全プロジェクト一覧を取得 */
  getProjects(): Observable<IProject[]> {
    const projectsRef = collection(this.firestore, 'projects');
    return collectionData(projectsRef, { idField: 'id' }) as Observable<
      IProject[]
    >;
  }

  /** 🔹 特定のプロジェクト内のタスクを取得 */
  getTasks(projectId: string): Observable<any[]> {
    const tasksRef = collection(this.firestore, `projects/${projectId}/tasks`);
    return collectionData(tasksRef, { idField: 'id' }) as Observable<any[]>;
  }

  getProjectById(projectId: string): Observable<IProject> {
    const projectRef = doc(this.firestore, `projects/${projectId}`);
    return docData(projectRef, { idField: 'id' }) as Observable<IProject>;
  }

  /** 🔹 プロジェクトIDを指定してタスクを取得 */
  getTasksByProjectId(projectId: string): Observable<any[]> {
    const projectRef = doc(this.firestore, `projects/${projectId}`);
    const tasksRef = collection(projectRef, 'tasks');
    const project$ = docData(projectRef, {
      idField: 'id',
    }) as Observable<IProject>;
    const tasks$ = collectionData(tasksRef, {
      idField: 'id',
    }) as Observable<any[]>;

    return combineLatest([project$, tasks$]).pipe(
      map(([project, tasks]) => {
        const themeColor = resolveProjectThemeColor(project);
        const projectName = project?.projectName || 'プロジェクト';

        return tasks.map((task) => ({
          ...task,
          projectId,
          projectName: task.projectName || projectName,
          projectThemeColor: task.projectThemeColor || themeColor,
        }));
      })
    );
  }

  /** ✅ 新しいプロジェクトを追加（今回追加する関数） */
  async addProject(project: any) {
    console.log('🔍 ProjectService.addProject が呼び出されました');
    console.log('プロジェクトデータ:', project);

    const projectsRef = collection(this.firestore, 'projects');
    const result = await addDoc(projectsRef, project);

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
    const tasksRef = collection(this.firestore, `projects/${projectId}/tasks`);
    const result = await addDoc(tasksRef, taskData);

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
      const result = await updateDoc(taskRef, taskData);

      // 編集ログを記録
      const changes: string[] = [];
      if (taskData.status) {
        changes.push(`ステータス: ${taskData.status}`);
      }
      if (taskData.taskName) {
        changes.push(`タスク名: ${taskData.taskName}`);
      }
      if (taskData.priority) {
        changes.push(`優先度: ${taskData.priority}`);
      }
      if (taskData.assignee) {
        changes.push(`担当者: ${taskData.assignee}`);
      }
      if (taskData.dueDate) {
        changes.push(`期限: ${taskData.dueDate}`);
      }

      await this.editLogService.logEdit(
        projectId,
        taskData.projectName || 'プロジェクト',
        'update',
        `タスク「${
          taskData.taskName || 'タスク'
        }」を更新しました (${changes.join(', ')})`,
        taskId,
        taskData.taskName || 'タスク',
        undefined,
        changes.join(', ')
      );

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
