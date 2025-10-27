import { Injectable } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TestMailService {
  private app = getApps().length
    ? getApp()
    : initializeApp(environment.firebase);
  private functions = getFunctions(this.app, 'us-central1'); // リージョン指定推奨
  private auth = getAuth(this.app);

  constructor() {
    signInAnonymously(this.auth)
      .then(() => console.log('✅ 匿名ログイン完了'))
      .catch((err) => console.error('❌ 匿名ログイン失敗:', err));
  }

  async sendTestEmail(email: string) {
    const callable = httpsCallable(this.functions, 'sendTestEmail');
    try {
      const result = await callable({ email });
      console.log('✅ メール送信成功:', result.data);
      alert('テストメールを送信しました！');
    } catch (error: any) {
      console.error('❌ メール送信失敗:', error);
      console.error('❌ メール送信失敗詳細:', JSON.stringify(error, null, 2));
      alert(
        'メール送信に失敗しました: ' + (error.message || JSON.stringify(error))
      );
    }
  }
}
