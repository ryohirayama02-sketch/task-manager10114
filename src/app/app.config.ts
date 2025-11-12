import {
  ApplicationConfig,
  provideZoneChangeDetection,
  importProvidersFrom,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import { provideAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
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
    provideFirestore(() => getFirestore()),
    provideFunctions(() => getFunctions()),
    provideStorage(() => getStorage()),

    // ✅ Material Datepicker を英語ロケールに設定
    { provide: MAT_DATE_LOCALE, useValue: 'en-US' },
  ],
};
