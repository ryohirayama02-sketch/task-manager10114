import { Injectable } from '@angular/core';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
} from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';

export interface ProjectProgress {
  projectId: string;
  projectName: string;
  totalTasks: number;
  completedTasks: number;
  progressPercentage: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProgressService {
  constructor(private firestore: Firestore) {}

  /** プロジェクトの進捗率を計算 */
  async getProjectProgress(projectId: string): Promise<ProjectProgress | null> {
    try {
      // プロジェクトのサブコレクションからタスクを取得
      const projectRef = doc(this.firestore, 'projects', projectId);
      const tasksRef = collection(projectRef, 'tasks');

      // 全タスクを取得
      const allTasksSnapshot = await getDocs(tasksRef);
      const totalTasks = allTasksSnapshot.size;
      console.log(`プロジェクト ${projectId} の全タスク数:`, totalTasks);

      // 全タスクのステータスを確認
      console.log(`プロジェクト ${projectId} の全タスク詳細:`);
      allTasksSnapshot.docs.forEach((doc, index) => {
        const taskData = doc.data();
        console.log(`タスク ${index + 1}:`, {
          id: doc.id,
          status: taskData['status'],
          taskName: taskData['taskName'],
        });
      });

      // 完了タスクを取得
      const completedTasksQuery = query(
        tasksRef,
        where('status', '==', '完了')
      );
      const completedTasksSnapshot = await getDocs(completedTasksQuery);
      const completedTasks = completedTasksSnapshot.size;
      console.log(`プロジェクト ${projectId} の完了タスク数:`, completedTasks);

      // プロジェクト名を取得（最初のタスクから）
      let projectName = 'プロジェクト';
      if (allTasksSnapshot.docs.length > 0) {
        const firstTask = allTasksSnapshot.docs[0].data();
        projectName = firstTask['projectName'] || 'プロジェクト';
      }

      const progressPercentage =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        projectId,
        projectName,
        totalTasks,
        completedTasks,
        progressPercentage,
      };
    } catch (error) {
      console.error('プロジェクト進捗の取得エラー:', error);
      return null;
    }
  }

  /** 全プロジェクトの進捗率を取得 */
  async getAllProjectsProgress(
    projectIds: string[]
  ): Promise<ProjectProgress[]> {
    // デバッグ: 全プロジェクトのタスクを確認
    console.log('=== 全プロジェクトのタスク確認 ===');
    let totalTasksCount = 0;

    for (const projectId of projectIds) {
      const projectRef = doc(this.firestore, 'projects', projectId);
      const tasksRef = collection(projectRef, 'tasks');
      const tasksSnapshot = await getDocs(tasksRef);
      totalTasksCount += tasksSnapshot.size;

      console.log(`プロジェクト ${projectId} のタスク数:`, tasksSnapshot.size);
      tasksSnapshot.docs.forEach((doc, index) => {
        const taskData = doc.data();
        console.log(`  - タスク ${index + 1}:`, {
          id: doc.id,
          status: taskData['status'],
          taskName: taskData['taskName'],
        });
      });
    }

    console.log('全プロジェクトの合計タスク数:', totalTasksCount);

    const progressPromises = projectIds.map((id) =>
      this.getProjectProgress(id)
    );
    const results = await Promise.all(progressPromises);
    return results.filter((progress) => progress !== null) as ProjectProgress[];
  }
}
