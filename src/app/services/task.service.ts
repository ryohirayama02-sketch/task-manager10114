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
    const targetDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().split('T')[0];
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
                    allTasks.push({
                      id: taskDoc.id,
                      projectId,
                      projectName: projectData['projectName'] || 'プロジェクト',
                      ...taskData,
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
                    allTasks.push({
                      id: taskDoc.id,
                      projectId: taskData['projectId'] || '',
                      projectName: taskData['projectName'] || 'タスク',
                      ...taskData,
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
                      due >= todayStr &&
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

                    // ② assignedMembers
                    if (Array.isArray((task as any).assignedMembers)) {
                      (task as any).assignedMembers.forEach((member: any) => {
                        if (typeof member === 'string') {
                          assignees.push(member.trim().toLowerCase());
                        } else if (typeof member === 'object') {
                          if (member.memberName)
                            assignees.push(
                              member.memberName.trim().toLowerCase()
                            );
                          if (member.name)
                            assignees.push(member.name.trim().toLowerCase());
                          if (member.memberEmail)
                            assignees.push(
                              member.memberEmail.trim().toLowerCase()
                            );
                          if (member.email)
                            assignees.push(member.email.trim().toLowerCase());
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
        });
      })
    );
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
    await updateDoc(taskRef, taskData);

    const changes: string[] = [];
    if (taskData.status && oldTaskData?.status !== taskData.status)
      changes.push(
        `ステータス: ${oldTaskData?.status || '不明'} → ${taskData.status}`
      );
    if (taskData.priority && oldTaskData?.priority !== taskData.priority)
      changes.push(
        `優先度: ${oldTaskData?.priority || '不明'} → ${taskData.priority}`
      );
    if (taskData.assignee && oldTaskData?.assignee !== taskData.assignee)
      changes.push(
        `担当者: ${oldTaskData?.assignee || '不明'} → ${taskData.assignee}`
      );
    if (taskData.dueDate && oldTaskData?.dueDate !== taskData.dueDate)
      changes.push(
        `期限: ${oldTaskData?.dueDate || '不明'} → ${taskData.dueDate}`
      );

    if (changes.length > 0) {
      await this.editLogService.logEdit(
        projectId,
        taskData.projectName || 'プロジェクト',
        'update',
        `タスク「${
          taskData.taskName || 'タスク'
        }」を更新しました (${changes.join(', ')})`,
        taskId
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

    await this.editLogService.logEdit(
      projectId,
      projectName || 'プロジェクト',
      'update',
      `タスクのステータスを「${
        oldStatus || '不明'
      }」→「${newStatus}」に変更しました`,
      taskId
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

  /** ❌ タスク削除 */
  async deleteTask(taskId: string, taskData: any, projectId?: string) {
    if (!projectId) throw new Error('プロジェクトIDが必要です');
    const ref = doc(this.firestore, `projects/${projectId}/tasks/${taskId}`);
    await deleteDoc(ref);
    await this.editLogService.logEdit(
      projectId,
      taskData.projectName || 'プロジェクト',
      'delete',
      `タスク「${taskData.taskName}」を削除しました`,
      taskId
    );
  }
}
