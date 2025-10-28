import { Injectable } from '@angular/core';
import {
  Firestore,
  enableNetwork,
  disableNetwork,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OfflineService {
  private isOnlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  public isOnline$: Observable<boolean> = this.isOnlineSubject.asObservable();

  constructor(private firestore: Firestore) {
    this.initializeOfflineDetection();
  }

  private initializeOfflineDetection(): void {
    // ブラウザのオンライン/オフライン状態を監視
    window.addEventListener('online', () => {
      console.log('🌐 オンライン状態に復帰しました');
      this.isOnlineSubject.next(true);
      this.enableFirestoreNetwork();
    });

    window.addEventListener('offline', () => {
      console.log('📴 オフライン状態になりました');
      this.isOnlineSubject.next(false);
      this.disableFirestoreNetwork();
    });

    // 初期状態を設定
    if (navigator.onLine) {
      this.enableFirestoreNetwork();
    } else {
      this.disableFirestoreNetwork();
    }
  }

  private async enableFirestoreNetwork(): Promise<void> {
    try {
      await enableNetwork(this.firestore);
      console.log('✅ Firestoreネットワークを有効化しました');
    } catch (error) {
      console.error('❌ Firestoreネットワーク有効化エラー:', error);
    }
  }

  private async disableFirestoreNetwork(): Promise<void> {
    try {
      await disableNetwork(this.firestore);
      console.log(
        '📴 Firestoreネットワークを無効化しました（オフラインモード）'
      );
    } catch (error) {
      console.error('❌ Firestoreネットワーク無効化エラー:', error);
    }
  }

  /** 現在のオンライン状態を取得 */
  get isOnline(): boolean {
    return this.isOnlineSubject.value;
  }

  /** 手動でオフラインモードに切り替え（テスト用） */
  async setOfflineMode(): Promise<void> {
    console.log('🧪 テスト用：オフラインモードに切り替え');
    this.isOnlineSubject.next(false);
    await this.disableFirestoreNetwork();
  }

  /** 手動でオンラインモードに切り替え（テスト用） */
  async setOnlineMode(): Promise<void> {
    console.log('🧪 テスト用：オンラインモードに切り替え');
    this.isOnlineSubject.next(true);
    await this.enableFirestoreNetwork();
  }
}
