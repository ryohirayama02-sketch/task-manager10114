import { Injectable, isDevMode } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
  User,
} from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  constructor(private auth: Auth, private router: Router) {
    setPersistence(this.auth, browserLocalPersistence)
      .then(() => console.log('🧭 Persistence設定完了'))
      .catch((err) => console.error('Persistence設定エラー:', err));

    onAuthStateChanged(this.auth, (user) => {
      console.log('🔐 onAuthStateChanged:', user?.email || 'ユーザーなし');
      this.userSubject.next(user);
    });

    if (!isDevMode()) {
      this.checkRedirectResult();
    }
  }

  /** Googleログイン（環境により自動切替） */
  async signInWithGoogle(): Promise<void> {
    try {
      const provider = new GoogleAuthProvider();
      console.log('🔵 Google認証開始...');
      if (isDevMode()) {
        const result = await signInWithPopup(this.auth, provider);
        console.log('✅ Popup認証成功:', result.user.email);
        this.userSubject.next(result.user);
      } else {
        await signInWithRedirect(this.auth, provider);
      }
      await this.router.navigate(['/']);
    } catch (error) {
      console.error('❌ Googleサインインエラー:', error);
    }
  }

  /** 本番用のリダイレクト結果 */
  private async checkRedirectResult(): Promise<void> {
    try {
      const result = await getRedirectResult(this.auth);
      if (result?.user) {
        console.log('✅ Redirect認証成功:', result.user.email);
        this.userSubject.next(result.user);
        await this.router.navigate(['/']);
      }
    } catch (err) {
      console.error('❌ リダイレクト結果エラー:', err);
    }
  }

  /** ✅ メールログイン（既存呼び出し互換） */
  async signInWithEmail(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(this.auth, email, password);
    console.log('✅ メールログイン成功:', result.user.email);
    this.userSubject.next(result.user);
    return result.user;
  }

  /** ✅ メールサインアップ（既存呼び出し互換） */
  async signUpWithEmail(email: string, password: string): Promise<User> {
    const result = await createUserWithEmailAndPassword(
      this.auth,
      email,
      password
    );
    console.log('✅ サインアップ成功:', result.user.email);
    this.userSubject.next(result.user);
    return result.user;
  }

  /** ✅ 現在のユーザーを取得（既存呼び出し互換） */
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  /** サインアウト */
  async signOut(): Promise<void> {
    await signOut(this.auth);
    this.userSubject.next(null);
    await this.router.navigate(['/login']);
  }

  /** 認証状態を取得 */
  isAuthenticated(): boolean {
    return this.auth.currentUser !== null;
  }
}
