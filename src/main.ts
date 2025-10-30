import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { environment } from './environments/environment';
import { appConfig } from './app/app.config'; // ← 🔥 追加ポイント

bootstrapApplication(AppComponent, {
  ...appConfig, // ← 🔥 appConfigの中身（ルーター等）をマージ
  providers: [
    ...(appConfig.providers || []), // ← 🔥 appConfig.providersも展開
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
  ],
}).catch((err) => console.error(err));
