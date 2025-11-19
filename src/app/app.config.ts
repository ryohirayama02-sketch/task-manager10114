import {
  ApplicationConfig,
  provideZoneChangeDetection,
  importProvidersFrom,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import { provideAuth } from '@angular/fire/auth';
import {
  provideFirestore,
  getFirestore,
  enableIndexedDbPersistence,
} from '@angular/fire/firestore';
import { provideFunctions, getFunctions } from '@angular/fire/functions';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatButtonModule } from '@angular/material/button';
import { environment } from '../environments/environment';
import { MAT_DATE_LOCALE } from '@angular/material/core';

// ✅ firebase/auth から persistence と resolver を import
import {
  initializeAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  browserPopupRedirectResolver, // ← これを追加
} from 'firebase/auth';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    importProvidersFrom(MatButtonModule),

    // ✅ Firebase 初期化（App）
    provideFirebaseApp(() => initializeApp(environment.firebase)),

    // ✅ Auth 初期化（resolver を追加）
    provideAuth(() =>
      initializeAuth(getApp(), {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        popupRedirectResolver: browserPopupRedirectResolver, // ← これが重要！
      })
    ),

    // ✅ Firestore・Functions・Storage はそのままでOK
    provideFirestore(() => {
      const firestore = getFirestore();
      // Firestoreのオフライン永続化を有効化
      enableIndexedDbPersistence(firestore).catch((err) => {
        // 既に有効化されている場合や、複数のタブで開いている場合はエラーになる
        if (err.code === 'failed-precondition') {
          console.warn(
            '⚠️ Firestore永続化は既に有効化されているか、複数のタブで開いています'
          );
        } else if (err.code === 'unimplemented') {
          console.warn(
            '⚠️ このブラウザはFirestore永続化をサポートしていません'
          );
        } else {
          console.error('❌ Firestore永続化の有効化に失敗しました:', err);
        }
      });
      return firestore;
    }),
    provideFunctions(() => getFunctions()),
    provideStorage(() => getStorage()),

    // ✅ Material Datepicker を英語ロケールに設定
    { provide: MAT_DATE_LOCALE, useValue: 'en-US' },
  ],
};
