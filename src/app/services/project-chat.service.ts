import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { ChatMessage } from '../models/task.model';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProjectChatService {
  constructor(private firestore: Firestore) {}

  /**
   * プロジェクトのメッセージをリアルタイムで取得
   */
  getMessages(projectId: string): Observable<ChatMessage[]> {
    return new Observable((observer) => {
      const messagesRef = collection(
        this.firestore,
        `projects/${projectId}/messages`
      );
      const q = query(messagesRef, orderBy('createdAt', 'asc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const messages = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as ChatMessage));
          observer.next(messages);
        },
        (error) => {
          observer.error(error);
        }
      );

      return () => unsubscribe();
    });
  }

  /**
   * メッセージを送信
   */
  async sendMessage(
    projectId: string,
    content: string,
    senderId: string,
    senderName: string,
    mentions: string[] = []
  ): Promise<void> {
    const messagesRef = collection(
      this.firestore,
      `projects/${projectId}/messages`
    );

    await addDoc(messagesRef, {
      content,
      sender: senderName,
      senderId,
      mentions,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

