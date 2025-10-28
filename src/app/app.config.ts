import {
  ApplicationConfig,
  provideZoneChangeDetection,
  importProvidersFrom,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import {
  provideFirestore,
  getFirestore,
  connectFirestoreEmulator,
  enableNetwork,
  disableNetwork,
} from '@angular/fire/firestore';
import { provideFunctions, getFunctions } from '@angular/fire/functions';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatButtonModule } from '@angular/material/button';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    importProvidersFrom(MatButtonModule),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => {
      const firestore = getFirestore();
      // オフライン機能を有効化（デフォルトで有効）
      return firestore;
    }),
    provideFunctions(() => getFunctions()),
  ],
};
