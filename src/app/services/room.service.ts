import { Injectable } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  where,
} from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class RoomService {
  constructor(private firestore: Firestore) {}

  async createRoom(name: string, password: string, createdBy: string, roomId: string) {
    const roomsRef = collection(this.firestore, 'rooms');
    return addDoc(roomsRef, {
      name,
      roomId,
      password,
      createdBy,
      createdAt: new Date().toISOString(),
    });
  }

  async joinRoom(roomId: string, password: string) {
    const roomsRef = collection(this.firestore, 'rooms');
    const roomQuery = query(
      roomsRef,
      where('roomId', '==', roomId),
      where('password', '==', password),
      limit(1)
    );
    const snapshot = await getDocs(roomQuery);
    if (snapshot.empty) {
      return null;
    }
    return snapshot.docs[0];
  }
}
