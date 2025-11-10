import { Injectable, isDevMode } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, from } from 'rxjs';
import { filter, switchMap, distinctUntilChanged } from 'rxjs/operators';

// ✅ firebase/auth を直接利用
import {
  Auth,
  getAuth,
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';

import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';
import { ProjectSelectionService } from './project-selection.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth: Auth = getAuth(); // ✅ initializeAuthで生成済みのAuthインスタンスを取得

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

  constructor(
    private router: Router,
    private firestore: Firestore,
    private projectSelectionService: ProjectSelectionService
  ) {
    console.log('🔧 AuthService コンストラクタ開始');

    onAuthStateChanged(this.auth, (user) => {
      console.log('🔐 onAuthStateChanged:', user?.email ?? 'ユーザーなし');
      this.userSubject.next(user ?? null);
      if (user?.email) {
        this.currentUserEmailSubject.next(user.email);
        this.resolveAndUpdateMemberName(user.email).catch(console.error);
      } else {
        this.currentUserEmailSubject.next(null);
        this.currentMemberNameSubject.next(null);
      }
    });

    // ルームID変更時の再取得
    this.currentRoomId$
      .pipe(
        distinctUntilChanged(),
        filter((roomId) => !!roomId),
        switchMap(() => {
          const currentUser = this.auth.currentUser;
          return currentUser?.email
            ? from(this.resolveAndUpdateMemberName(currentUser.email))
            : from(Promise.resolve());
        })
      )
      .subscribe();

    // ✅ リダイレクト結果チェック
    if (!isDevMode()) {
      this.checkRedirectResult().catch(console.error);
    }
  }

  /** ✅ Googleログイン */
  async signInWithGoogle(): Promise<void> {
    try {
      const provider = new GoogleAuthProvider();
      console.log('🔵 Google認証開始...');

      // ✅ 一旦、ポップアップ方式でGoogleアカウント画面を開く
      const result = await signInWithPopup(this.auth, provider);
      console.log('✅ Popup認証成功:', result.user.email);
      this.userSubject.next(result.user);

      if (result.user.email) {
        this.currentUserEmailSubject.next(result.user.email);
        await this.resolveAndUpdateMemberName(result.user.email);
      }

      await this.router.navigate(['/']);
    } catch (error) {
      console.error('❌ Googleサインインエラー:', error);
    }
  }

  /** ✅ リダイレクト結果処理（後で有効化） */
  private async checkRedirectResult(): Promise<void> {
    try {
      const result = await getRedirectResult(this.auth);
      if (result?.user) {
        console.log('✅ Redirect認証成功:', result.user.email);
        this.userSubject.next(result.user);
        if (result.user.email) {
          this.currentUserEmailSubject.next(result.user.email);
          await this.resolveAndUpdateMemberName(result.user.email);
        }
        await this.router.navigate(['/']);
      } else {
        console.log('⚠️ Redirect結果なし');
      }
    } catch (err) {
      console.error('❌ リダイレクト結果エラー:', err);
    }
  }

  /** メールログイン */
  async signInWithEmail(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(this.auth, email, password);
    console.log('✅ メールログイン成功:', result.user.email);
    this.userSubject.next(result.user);
    this.currentUserEmailSubject.next(result.user.email!);
    await this.resolveAndUpdateMemberName(result.user.email!);
    return result.user;
  }

  /** メールサインアップ */
  async signUpWithEmail(email: string, password: string): Promise<User> {
    const result = await createUserWithEmailAndPassword(
      this.auth,
      email,
      password
    );
    console.log('✅ サインアップ成功:', result.user.email);
    this.userSubject.next(result.user);
    this.currentUserEmailSubject.next(result.user.email!);
    await this.resolveAndUpdateMemberName(result.user.email!);
    return result.user;
  }

  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  async signOut(): Promise<void> {
    await fbSignOut(this.auth);
    this.userSubject.next(null);
    this.currentUserEmailSubject.next(null);
    this.currentMemberNameSubject.next(null);
    this.clearRoomId();
    this.projectSelectionService.clearSelection();
    await this.router.navigate(['/login']);
  }

  /** メンバー名取得 */
  async resolveAndUpdateMemberName(email: string): Promise<void> {
    try {
      const roomId = this.getCurrentRoomId();
      if (!roomId) {
        console.log('⚠️ ルームID未設定。フォールバック使用');
        const user = this.auth.currentUser;
        this.currentMemberNameSubject.next(
          user?.displayName || user?.email || 'ユーザー'
        );
        return;
      }

      const membersCollection = collection(this.firestore, 'members');
      const q = query(
        membersCollection,
        where('email', '==', email),
        where('roomId', '==', roomId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as { name?: string };
        if (data?.name) {
          console.log('✅ メンバー名取得:', data.name);
          this.currentMemberNameSubject.next(data.name);
          return;
        }
      }

      const user = this.auth.currentUser;
      this.currentMemberNameSubject.next(
        user?.displayName || user?.email || 'ユーザー'
      );
    } catch (e) {
      console.error('resolveAndUpdateMemberName エラー:', e);
      const user = this.auth.currentUser;
      this.currentMemberNameSubject.next(
        user?.displayName || user?.email || 'ユーザー'
      );
    }
  }

  setRoomId(id: string, docId?: string) {
    this.currentRoomId.next(id);
    localStorage.setItem('roomId', id);
    if (docId) {
      this.currentRoomDocId.next(docId);
      localStorage.setItem('roomDocId', docId);
    }
    const user = this.auth.currentUser;
    if (user?.email) {
      this.resolveAndUpdateMemberName(user.email).catch(console.error);
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

  /** ルームDoc ID取得（他サービス互換用） */
  getCurrentRoomDocId(): string | null {
    return this.currentRoomDocId.value;
  }

  /** 現在ログイン中のユーザーならメンバー名を更新 */
  updateMemberNameIfCurrentUser(email: string, name: string): void {
    const currentUser = this.auth.currentUser;
    if (currentUser?.email === email) {
      console.log('✅ 現在ユーザーのメンバー名更新:', name);
      this.currentMemberNameSubject.next(name);
    }
  }
}
