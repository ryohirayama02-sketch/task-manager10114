import { Injectable } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  where,
  doc,
  getDoc,
  deleteDoc,
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

  async getRoomInfo(roomId: string) {
    const roomsRef = collection(this.firestore, 'rooms');
    const roomQuery = query(
      roomsRef,
      where('roomId', '==', roomId),
      limit(1)
    );
    const snapshot = await getDocs(roomQuery);
    if (snapshot.empty) {
      return null;
    }
    const data = snapshot.docs[0].data();
    return {
      name: data['name'],
      roomId: data['roomId'],
      password: data['password'],
    };
  }

  /**
   * roomIdが既に存在するかチェック
   * @param roomId チェックするroomId
   * @returns roomIdが既に存在する場合true、存在しない場合false
   */
  async roomIdExists(roomId: string): Promise<boolean> {
    if (!roomId || roomId.trim() === '') {
      return false;
    }
    const roomsRef = collection(this.firestore, 'rooms');
    const roomQuery = query(
      roomsRef,
      where('roomId', '==', roomId.trim()),
      limit(1)
    );
    const snapshot = await getDocs(roomQuery);
    return !snapshot.empty;
  }

  /**
   * ルームを削除（roomIdからroomDocIdを取得して削除）
   * @param roomId 削除するルームのroomId
   */
  async deleteRoom(roomId: string): Promise<void> {
    if (!roomId || roomId.trim() === '') {
      throw new Error('ルームIDが指定されていません');
    }
    const roomsRef = collection(this.firestore, 'rooms');
    const roomQuery = query(
      roomsRef,
      where('roomId', '==', roomId.trim()),
      limit(1)
    );
    const snapshot = await getDocs(roomQuery);
    if (snapshot.empty) {
      throw new Error('ルームが見つかりません');
    }
    const roomDoc = snapshot.docs[0];
    await deleteDoc(doc(this.firestore, `rooms/${roomDoc.id}`));
  }
}
