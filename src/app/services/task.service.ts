import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TaskService {
  constructor(private firestore: Firestore) {}

  /** Firestoreからタスク一覧を取得 */
  getTasks(): Observable<any[]> {
    const tasksRef = collection(this.firestore, 'tasks');
    return collectionData(tasksRef, { idField: 'id' }) as Observable<any[]>;
  }

  /** Firestoreに新しいタスクを追加 */
  addTask(task: any) {
    const tasksRef = collection(this.firestore, 'tasks');
    return addDoc(tasksRef, task); // ✅ addDocをここで使用
  }

  /** タスクのステータスを更新 */
  updateTaskStatus(taskId: string, newStatus: string) {
    const taskRef = doc(this.firestore, 'tasks', taskId);
    return updateDoc(taskRef, { status: newStatus });
  }
}
