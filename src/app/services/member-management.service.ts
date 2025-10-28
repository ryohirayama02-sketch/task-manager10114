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
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Member } from '../models/member.model';

@Injectable({
  providedIn: 'root',
})
export class MemberManagementService {
  private readonly MEMBERS_COLLECTION = 'members';

  constructor(private firestore: Firestore) {}

  /**
   * 全メンバーを取得
   */
  getMembers(): Observable<Member[]> {
    const membersRef = collection(this.firestore, this.MEMBERS_COLLECTION);
    return collectionData(membersRef, { idField: 'id' }) as Observable<
      Member[]
    >;
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

    const membersRef = collection(this.firestore, this.MEMBERS_COLLECTION);
    const memberData = {
      ...member,
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
    // 注意: この実装は効率的ではありませんが、メンバー数が少ない場合は問題ありません
    // 本格運用では、Firestoreのクエリインデックスを使用することを推奨
    const members = await this.getMembers().pipe().toPromise();
    return members?.find((member) => member.email === email) || null;
  }
}
