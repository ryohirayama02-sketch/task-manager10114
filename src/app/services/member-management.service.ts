import { Injectable } from '@angular/core';
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
} from '@angular/fire/firestore';
import { Observable, of, switchMap, firstValueFrom } from 'rxjs';
import { Member } from '../models/member.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class MemberManagementService {
  private readonly MEMBERS_COLLECTION = 'members';

  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

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
}
