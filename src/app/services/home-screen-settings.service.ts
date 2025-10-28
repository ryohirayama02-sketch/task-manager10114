import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  docData,
  serverTimestamp,
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import {
  HomeScreenSettings,
  HomeScreenType,
} from '../models/home-screen-settings.model';
import { Observable, map, switchMap, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class HomeScreenSettingsService {
  private readonly COLLECTION_NAME = 'homeScreenSettings';

  constructor(private firestore: Firestore, private authService: AuthService) {}

  /**
   * ホーム画面設定を取得
   */
  getHomeScreenSettings(): Observable<HomeScreenSettings | null> {
    return this.authService.user$.pipe(
      switchMap((user) => {
        if (!user) {
          return of(null);
        }

        const docRef = doc(this.firestore, this.COLLECTION_NAME, user.uid);
        return docData(docRef, {
          idField: 'id',
        }) as Observable<HomeScreenSettings | null>;
      })
    );
  }

  /**
   * ホーム画面設定を保存
   */
  async saveHomeScreenSettings(homeScreen: HomeScreenType): Promise<void> {
    const user = await this.authService.getCurrentUser();
    if (!user) {
      throw new Error('ユーザーが認証されていません');
    }

    const settings = {
      userId: user.uid,
      homeScreen,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = doc(this.firestore, this.COLLECTION_NAME, user.uid);
    await setDoc(docRef, settings, { merge: true });
  }

  /**
   * デフォルトのホーム画面設定を取得
   */
  getDefaultHomeScreen(): HomeScreenType {
    return 'kanban';
  }
}
