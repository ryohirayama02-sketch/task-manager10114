import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  docData,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { IProject } from '../models/project.model'; // 上の方に追加

@Injectable({ providedIn: 'root' })
export class ProjectService {
  constructor(private firestore: Firestore) {}

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
    return collectionData(tasksRef, { idField: 'id' }) as Observable<any[]>;
  }

  /** ✅ 新しいプロジェクトを追加（今回追加する関数） */
  addProject(project: any) {
    const projectsRef = collection(this.firestore, 'projects');
    return addDoc(projectsRef, project);
  }

  /** ✅ 特定プロジェクトにタスクを追加 */
  addTaskToProject(projectId: string, taskData: any) {
    const tasksRef = collection(this.firestore, `projects/${projectId}/tasks`);
    return addDoc(tasksRef, taskData);
  }

  /** ✅ タスクを更新 */
  updateTask(projectId: string, taskId: string, taskData: any) {
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

    return updateDoc(taskRef, taskData).catch((error) => {
      console.error('ProjectService.updateTask error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        projectId,
        taskId,
        taskData,
      });
      throw error;
    });
  }
}
