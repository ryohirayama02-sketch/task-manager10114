import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
} from '@angular/fire/auth';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  constructor(private auth: Auth) {
    // 認証状態の変更を監視
    onAuthStateChanged(this.auth, (user) => {
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
      return result.user;
    } catch (error) {
      console.error('サインインエラー:', error);
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
      return result.user;
    } catch (error) {
      console.error('サインアップエラー:', error);
      throw error;
    }
  }

  /** Googleでサインイン */
  async signInWithGoogle(): Promise<User> {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);
      return result.user;
    } catch (error) {
      console.error('Googleサインインエラー:', error);
      throw error;
    }
  }

  /** サインアウト */
  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('サインアウトエラー:', error);
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
