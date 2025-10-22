export interface Member {
  id: string;
  name: string;
  role: string;
  email: string;
  done: number;
  working: number;
  todo: number;
}

import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MemberService {
  constructor(private firestore: Firestore) {}

  getMembers(): Observable<Member[]> {
    const membersRef = collection(this.firestore, 'members');
    return collectionData(membersRef, { idField: 'id' }) as Observable<
      Member[]
    >;
  }

  getMemberById(memberId: string): Observable<Member> {
    const memberRef = doc(this.firestore, `members/${memberId}`);
    return docData(memberRef, { idField: 'id' }) as Observable<Member>;
  }

  getTasksByMemberId(memberId: string): Observable<any[]> {
    const memberRef = doc(this.firestore, `members/${memberId}`);
    const tasksRef = collection(memberRef, 'tasks');
    return collectionData(tasksRef, { idField: 'id' }) as Observable<any[]>;
  }
}
