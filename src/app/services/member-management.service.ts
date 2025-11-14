import { Injectable, inject, Injector } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  docData,
  serverTimestamp,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';
import { Observable, of, switchMap, firstValueFrom } from 'rxjs';
import { Member } from '../models/member.model';
import { AuthService } from './auth.service';
import { ProjectService } from './project.service';
import { TaskService } from './task.service';

@Injectable({
  providedIn: 'root',
})
export class MemberManagementService {
  private readonly MEMBERS_COLLECTION = 'members';
  private readonly injector = inject(Injector);

  constructor(private firestore: Firestore, private authService: AuthService) {}

  /**
   * 循環依存を避けるため、遅延注入でProjectServiceを取得
   */
  private getProjectService(): ProjectService {
    return this.injector.get(ProjectService);
  }

  /**
   * 循環依存を避けるため、遅延注入でTaskServiceを取得
   */
  private getTaskService(): TaskService {
    return this.injector.get(TaskService);
  }

  /**
   * 全メンバーを取得
   */
  getMembers(): Observable<Member[]> {
    return this.authService.currentRoomId$.pipe(
      switchMap((roomId) => {
        if (!roomId) {
          return of([]);
        }
        const membersRef = collection(this.firestore, this.MEMBERS_COLLECTION);
        const roomQuery = query(membersRef, where('roomId', '==', roomId));
        return collectionData(roomQuery, { idField: 'id' }) as Observable<
          Member[]
        >;
      })
    );
  }

  /**
   * メンバーをIDで取得
   */
  getMemberById(memberId: string): Observable<Member | undefined> {
    const memberRef = doc(
      this.firestore,
      `${this.MEMBERS_COLLECTION}/${memberId}`
    );
    return docData(memberRef, { idField: 'id' }) as Observable<
      Member | undefined
    >;
  }

  /**
   * ルーム内のメンバー数を取得
   */
  async getMemberCount(): Promise<number> {
    const roomId = this.authService.getCurrentRoomId();
    if (!roomId) {
      return 0;
    }
    const membersRef = collection(this.firestore, this.MEMBERS_COLLECTION);
    const roomQuery = query(membersRef, where('roomId', '==', roomId));
    const snapshot = await getDocs(roomQuery);
    return snapshot.size;
  }

  /**
   * 新しいメンバーを追加
   */
  async addMember(
    member: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    console.log('🔍 MemberManagementService.addMember が呼び出されました');
    console.log('メンバーデータ:', member);

    const roomId = this.authService.getCurrentRoomId();
    if (!roomId) {
      throw new Error('ルームIDが設定されていません');
    }

    const membersRef = collection(this.firestore, this.MEMBERS_COLLECTION);
    const memberData = {
      ...member,
      roomId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const result = await addDoc(membersRef, memberData);
    console.log('✅ メンバーを追加しました:', result.id);

    // 追加したメンバーが現在のユーザーの場合、ナビゲーションバーを更新
    if (member.email) {
      this.authService.updateMemberNameIfCurrentUser(member.email, member.name);
    }

    return result.id;
  }

  /**
   * メンバーを更新
   */
  async updateMember(
    memberId: string,
    memberData: Partial<Member>
  ): Promise<void> {
    console.log('🔍 MemberManagementService.updateMember が呼び出されました');
    console.log('メンバーID:', memberId, '更新データ:', memberData);

    // メンバー名が変更される場合、古いメンバー情報を取得
    let oldMemberName: string | undefined;
    let memberEmail: string | undefined;
    if (memberData.name) {
      try {
        // メンバー一覧から取得（最も確実な方法）
        const allMembers = await firstValueFrom(this.getMembers());
        const oldMember = allMembers.find((m) => m.id === memberId);
        if (oldMember) {
          oldMemberName = oldMember.name;
          memberEmail = oldMember.email;
        }
      } catch (error) {
        console.warn('古いメンバー情報の取得に失敗しました:', error);
        // フォールバック: 直接ドキュメントを取得
        try {
          const memberRef = doc(
            this.firestore,
            `${this.MEMBERS_COLLECTION}/${memberId}`
          );
          const memberDocData = await firstValueFrom(docData(memberRef));
          if (memberDocData) {
            const oldMember = { id: memberId, ...memberDocData } as Member;
            oldMemberName = oldMember.name;
            memberEmail = oldMember.email;
          }
        } catch (err) {
          console.warn('ドキュメントからの取得にも失敗しました:', err);
        }
      }
    } else {
      // メンバー名が変更されない場合でも、emailを取得する必要がある
      try {
        const allMembers = await firstValueFrom(this.getMembers());
        const member = allMembers.find((m) => m.id === memberId);
        if (member) {
          memberEmail = member.email;
        }
      } catch (error) {
        // フォールバック: 直接ドキュメントを取得
        try {
          const memberRef = doc(
            this.firestore,
            `${this.MEMBERS_COLLECTION}/${memberId}`
          );
          const memberDocData = await firstValueFrom(docData(memberRef));
          if (memberDocData) {
            const member = { id: memberId, ...memberDocData } as Member;
            memberEmail = member.email;
          }
        } catch (err) {
          console.warn('メールアドレスの取得に失敗しました:', err);
        }
      }
    }

    const memberRef = doc(
      this.firestore,
      `${this.MEMBERS_COLLECTION}/${memberId}`
    );
    const updateData = {
      ...memberData,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(memberRef, updateData);
    console.log('✅ メンバーを更新しました');

    // メンバー名が変更された場合、関連するプロジェクトとタスクを更新
    if (oldMemberName && memberData.name && oldMemberName !== memberData.name) {
      console.log(
        `🔄 メンバー名が変更されました: "${oldMemberName}" → "${memberData.name}"`
      );
      console.log('関連するプロジェクトとタスクを更新します...');
      await this.updateRelatedProjectsAndTasks(
        memberId,
        oldMemberName,
        memberData.name
      );

      // 現在のユーザーのメンバー名を更新
      if (memberEmail) {
        this.authService.updateMemberNameIfCurrentUser(
          memberEmail,
          memberData.name
        );
      }
    }
  }

  /**
   * メンバー名変更時に、関連するプロジェクトとタスクを更新
   */
  private async updateRelatedProjectsAndTasks(
    memberId: string,
    oldMemberName: string,
    newMemberName: string
  ): Promise<void> {
    const roomId = this.authService.getCurrentRoomId();
    if (!roomId) {
      console.warn('ルームIDが設定されていないため、更新をスキップします');
      return;
    }

    try {
      // 1. プロジェクトのmembersフィールドを更新
      const projectsRef = collection(this.firestore, 'projects');
      const projectsQuery = query(projectsRef, where('roomId', '==', roomId));
      const projectsSnapshot = await getDocs(projectsQuery);

      const projectUpdatePromises: Promise<void>[] = [];

      projectsSnapshot.forEach((projectDoc) => {
        const projectData = projectDoc.data();
        const projectId = projectDoc.id;

        // プロジェクトのmembersフィールド（メンバー名のカンマ区切り文字列）を確認
        if (
          projectData['members'] &&
          typeof projectData['members'] === 'string'
        ) {
          const memberNames = projectData['members']
            .split(',')
            .map((name: string) => name.trim())
            .filter((name: string) => name.length > 0);

          // 古いメンバー名が含まれている場合、新しいメンバー名に置き換え
          if (memberNames.includes(oldMemberName)) {
            const updatedMemberNames = memberNames.map((name: string) =>
              name === oldMemberName ? newMemberName : name
            );
            const updatedMembersString = updatedMemberNames.join(', ');

            console.log(
              `📝 プロジェクト「${projectData['projectName']}」のmembersフィールドを更新: "${projectData['members']}" → "${updatedMembersString}"`
            );

            projectUpdatePromises.push(
              this.getProjectService()
                .updateProject(projectId, { members: updatedMembersString })
                .then(() => {
                  console.log(
                    `✅ プロジェクト「${projectData['projectName']}」のmembersフィールドを更新しました`
                  );
                })
                .catch((error) => {
                  console.error(
                    `❌ プロジェクト「${projectData['projectName']}」の更新エラー:`,
                    error
                  );
                })
            );
          }
        }
      });

      // 2. タスクのassigneeフィールドを更新（プロジェクト配下のタスク）
      const taskUpdatePromises: Promise<void>[] = [];

      // 各プロジェクトのタスクコレクションを確認
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        const projectTasksRef = collection(
          this.firestore,
          `projects/${projectId}/tasks`
        );
        const projectTasksSnapshot = await getDocs(projectTasksRef);

        for (const taskDoc of projectTasksSnapshot.docs) {
          const taskData = taskDoc.data();
          const taskId = taskDoc.id;

          // assigneeフィールドを確認
          if (
            taskData['assignee'] &&
            typeof taskData['assignee'] === 'string'
          ) {
            const assigneeNames = taskData['assignee']
              .split(',')
              .map((name: string) => name.trim())
              .filter((name: string) => name.length > 0);

            // 古いメンバー名が含まれている場合、新しいメンバー名に置き換え
            if (assigneeNames.includes(oldMemberName)) {
              const updatedAssigneeNames = assigneeNames.map((name: string) =>
                name === oldMemberName ? newMemberName : name
              );
              const updatedAssigneeString = updatedAssigneeNames.join(', ');

              console.log(
                `📝 タスク「${taskData['taskName']}」のassigneeフィールドを更新: "${taskData['assignee']}" → "${updatedAssigneeString}"`
              );

              taskUpdatePromises.push(
                this.getTaskService()
                  .updateTask(
                    taskId,
                    { assignee: updatedAssigneeString },
                    taskData,
                    projectId
                  )
                  .then(() => {
                    console.log(
                      `✅ タスク「${taskData['taskName']}」のassigneeフィールドを更新しました`
                    );
                  })
                  .catch((error) => {
                    console.error(
                      `❌ タスク「${taskData['taskName']}」の更新エラー:`,
                      error
                    );
                  })
              );
            }
          }
        }
      }

      // すべての更新を実行
      await Promise.all([...projectUpdatePromises, ...taskUpdatePromises]);
      console.log(
        `✅ メンバー名変更に伴う関連データの更新が完了しました（プロジェクト: ${projectUpdatePromises.length}件、タスク: ${taskUpdatePromises.length}件）`
      );
    } catch (error) {
      console.error('関連データの更新エラー:', error);
      // エラーが発生してもメンバー更新は成功とする
    }
  }

  /**
   * メンバーを削除
   */
  async deleteMember(memberId: string): Promise<void> {
    console.log('🔍 MemberManagementService.deleteMember が呼び出されました');
    console.log('メンバーID:', memberId);

    const memberRef = doc(
      this.firestore,
      `${this.MEMBERS_COLLECTION}/${memberId}`
    );
    await deleteDoc(memberRef);
    console.log('✅ メンバーを削除しました');
  }

  /**
   * メールアドレスでメンバーを検索
   */
  async getMemberByEmail(email: string): Promise<Member | null> {
    const members = await firstValueFrom(this.getMembers());
    return members?.find((member) => member.email === email) || null;
  }

  /**
   * ルーム内のすべてのメンバーを削除
   */
  async deleteAllMembersInRoom(roomId: string): Promise<void> {
    console.log(
      '🔍 MemberManagementService.deleteAllMembersInRoom が呼び出されました'
    );
    console.log('ルームID:', roomId);

    if (!roomId || roomId.trim() === '') {
      throw new Error('ルームIDが指定されていません');
    }

    const membersRef = collection(this.firestore, this.MEMBERS_COLLECTION);
    const roomQuery = query(membersRef, where('roomId', '==', roomId));
    const snapshot = await getDocs(roomQuery);

    console.log(`削除対象のメンバー数: ${snapshot.size}件`);

    const deletePromises = snapshot.docs.map(async (memberDoc) => {
      const memberRef = doc(
        this.firestore,
        `${this.MEMBERS_COLLECTION}/${memberDoc.id}`
      );
      await deleteDoc(memberRef);
      console.log(`✅ メンバーを削除しました: ${memberDoc.id}`);
    });

    await Promise.all(deletePromises);
    console.log(
      `✅ ルーム内のすべてのメンバーを削除しました: ${snapshot.size}件`
    );
  }
}
