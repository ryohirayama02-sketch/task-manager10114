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
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  private currentMemberNameSubject = new BehaviorSubject<string | null>(null);
  public currentMemberName$ = this.currentMemberNameSubject.asObservable();

  private currentUserEmailSubject = new BehaviorSubject<string | null>(null);
  public currentUserEmail$ = this.currentUserEmailSubject.asObservable();

  private currentRoomId = new BehaviorSubject<string | null>(
    localStorage.getItem('roomId')
  );
  private currentRoomDocId = new BehaviorSubject<string | null>(
    localStorage.getItem('roomDocId')
  );
  public currentRoomId$ = this.currentRoomId.asObservable();
  public currentRoomDocId$ = this.currentRoomDocId.asObservable();

  constructor(private auth: Auth, private router: Router, private firestore: Firestore) {
    setPersistence(this.auth, browserLocalPersistence)
      .then(() => console.log('🧭 Persistence設定完了'))
      .catch((err) => console.error('Persistence設定エラー:', err));

    onAuthStateChanged(this.auth, (user) => {
      console.log('🔐 onAuthStateChanged:', user?.email || 'ユーザーなし');
      this.userSubject.next(user);
      // ユーザー状態変更時にメンバー名とメールアドレスを更新
      if (user?.email) {
        this.currentUserEmailSubject.next(user.email);
        this.resolveAndUpdateMemberName(user.email);
      } else {
        this.currentUserEmailSubject.next(null);
        this.currentMemberNameSubject.next(null);
      }
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
        // メンバー名とメールアドレスを更新
        if (result.user.email) {
          this.currentUserEmailSubject.next(result.user.email);
          await this.resolveAndUpdateMemberName(result.user.email);
        }
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
        // メンバー名とメールアドレスを更新
        if (result.user.email) {
          this.currentUserEmailSubject.next(result.user.email);
          await this.resolveAndUpdateMemberName(result.user.email);
        }
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
    // メンバー名とメールアドレスを更新
    this.currentUserEmailSubject.next(result.user.email!);
    await this.resolveAndUpdateMemberName(result.user.email!);
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
    // メンバー名とメールアドレスを更新
    this.currentUserEmailSubject.next(result.user.email!);
    await this.resolveAndUpdateMemberName(result.user.email!);
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
    // ログアウト時はメンバー名とメールアドレスもクリア
    this.currentUserEmailSubject.next(null);
    this.currentMemberNameSubject.next(null);
    this.clearRoomId();
    await this.router.navigate(['/login']);
  }

  /** 認証状態を取得 */
  isAuthenticated(): boolean {
    return this.auth.currentUser !== null;
  }

  /** 
   * メールアドレスに基づいてFirestoreのmembersコレクションから名前を取得し、
   * currentMemberNameSubjectを更新する
   */
  private async resolveAndUpdateMemberName(email: string): Promise<void> {
    try {
      const membersCollection = collection(this.firestore, 'members');
      const q = query(membersCollection, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const memberDoc = querySnapshot.docs[0].data() as { name?: string };
        if (memberDoc?.name) {
          console.log('✅ メンバー名を取得 (Firestore):', memberDoc.name);
          this.currentMemberNameSubject.next(memberDoc.name);
          return;
        }
      }

      // Firestoreに一致なし、または nameフィールドがない場合
      console.log('⚠️ Firestoreでメンバーが見つからない。フォールバック使用');
      const currentUser = this.auth.currentUser;
      const fallbackName = currentUser?.displayName || currentUser?.email || 'ユーザー';
      this.currentMemberNameSubject.next(fallbackName);
    } catch (error) {
      console.error('❌ resolveAndUpdateMemberName エラー:', error);
      const currentUser = this.auth.currentUser;
      const fallbackName = currentUser?.displayName || currentUser?.email || 'ユーザー';
      this.currentMemberNameSubject.next(fallbackName);
    }
  }

  setRoomId(id: string, docId?: string) {
    this.currentRoomId.next(id);
    localStorage.setItem('roomId', id);
    if (docId) {
      this.currentRoomDocId.next(docId);
      localStorage.setItem('roomDocId', docId);
    }
  }

  clearRoomId() {
    this.currentRoomId.next(null);
    this.currentRoomDocId.next(null);
    localStorage.removeItem('roomId');
    localStorage.removeItem('roomDocId');
  }

  getCurrentRoomId(): string | null {
    return this.currentRoomId.value;
  }

  getCurrentRoomDocId(): string | null {
    return this.currentRoomDocId.value;
  }
}
