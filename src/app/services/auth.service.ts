import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
} from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  constructor(private auth: Auth, private router: Router) {
    // 🔧 永続化設定（セッションを保持）
    setPersistence(this.auth, browserLocalPersistence)
      .then(() => {
        console.log('🧭 Persistence: browserLocalPersistence 設定完了');
      })
      .catch((err) => console.error('Persistence設定エラー:', err));

    // 🔐 認証状態の変更を監視
    onAuthStateChanged(this.auth, (user) => {
      console.log('🔐 onAuthStateChanged:', user?.email || 'ユーザーなし');
      this.userSubject.next(user);
    });
  }

  /** メール・パスワードでサインイン */
  async signInWithEmail(email: string, password: string): Promise<User> {
    try {
      const result = await signInWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      console.log('✅ メールログイン成功:', result.user.email);
      this.userSubject.next(result.user);
      return result.user;
    } catch (error) {
      console.error('❌ メールサインインエラー:', error);
      throw error;
    }
  }

  /** メール・パスワードでサインアップ */
  async signUpWithEmail(email: string, password: string): Promise<User> {
    try {
      const result = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      console.log('✅ サインアップ成功:', result.user.email);
      this.userSubject.next(result.user);
      return result.user;
    } catch (error) {
      console.error('❌ サインアップエラー:', error);
      throw error;
    }
  }

  /** ✅ Googleでサインイン（Popup方式） */
  async signInWithGoogle(): Promise<void> {
    try {
      console.log('🔵 Google認証を開始します...');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);
      console.log('✅ Google認証成功:', result.user.email);
      this.userSubject.next(result.user);

      // ログイン後のリダイレクト（必要なら）
      await this.router.navigate(['/']);
    } catch (error) {
      console.error('❌ Googleサインインエラー:', error);
      throw error;
    }
  }

  /** サインアウト */
  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      console.log('🚪 サインアウト完了');
      this.userSubject.next(null);
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('❌ サインアウトエラー:', error);
      throw error;
    }
  }

  /** 現在のユーザーを取得 */
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  /** 認証状態を取得 */
  isAuthenticated(): boolean {
    return this.auth.currentUser !== null;
  }
}
