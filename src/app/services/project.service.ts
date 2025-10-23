import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  docData,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  constructor(private firestore: Firestore) {}

  /** 🔹 全プロジェクト一覧を取得 */
  getProjects(): Observable<any[]> {
    const projectsRef = collection(this.firestore, 'projects');
    return collectionData(projectsRef, { idField: 'id' }) as Observable<any[]>;
  }

  /** 🔹 特定のプロジェクト内のタスクを取得 */
  getTasks(projectId: string): Observable<any[]> {
    const tasksRef = collection(this.firestore, `projects/${projectId}/tasks`);
    return collectionData(tasksRef, { idField: 'id' }) as Observable<any[]>;
  }

  /** 🔹 ID指定でプロジェクトを取得 */
  getProjectById(projectId: string): Observable<any> {
    const projectRef = doc(this.firestore, `projects/${projectId}`);
    return docData(projectRef, { idField: 'id' }) as Observable<any>;
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
}
