import { Injectable } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TestMailService {
  private app = initializeApp(environment.firebase);
  private functions = getFunctions(this.app);
  private auth = getAuth(this.app);

  constructor() {
    // 匿名ログイン（onCall関数のauth対策）
    signInAnonymously(this.auth).then(() => {
      console.log('✅ 匿名ログイン完了');
    });
  }

  async sendTestEmail(email: string) {
    const sendTestEmail = httpsCallable(this.functions, 'sendTestEmail');
    try {
      const result = await sendTestEmail({ email });
      console.log('✅ メール送信成功:', result.data);
      alert('テストメールを送信しました！');
    } catch (error: any) {
      console.error('❌ メール送信失敗:', error);
      alert('メール送信に失敗しました: ' + error.message);
    }
  }
}
