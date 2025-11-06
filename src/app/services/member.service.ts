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
  query,
  where,
} from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class MemberService {
  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  getMembers(): Observable<Member[]> {
    return this.authService.currentRoomId$.pipe(
      switchMap((roomId) => {
        if (!roomId) {
          return of([]);
        }
        const membersRef = collection(this.firestore, 'members');
        const roomQuery = query(membersRef, where('roomId', '==', roomId));
        return collectionData(roomQuery, { idField: 'id' }) as Observable<
          Member[]
        >;
      })
    );
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
