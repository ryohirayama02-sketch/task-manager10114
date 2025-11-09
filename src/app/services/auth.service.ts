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
  User,
} from '@angular/fire/auth';
import { BehaviorSubject, from } from 'rxjs';
import { Router } from '@angular/router';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { ProjectSelectionService } from './project-selection.service';
import { filter, switchMap, take, distinctUntilChanged } from 'rxjs/operators';

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

  constructor(
    private auth: Auth,
    private router: Router,
    private firestore: Firestore,
    private projectSelectionService: ProjectSelectionService
  ) {
    // Angular Fire v18では、browserLocalPersistenceがデフォルトで使用されるため、
    // 明示的な設定は不要です

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

    // ルームIDが変更されたときにメンバー名を再取得
    this.currentRoomId$
      .pipe(
        distinctUntilChanged(), // 同じルームIDが連続して来た場合はスキップ
        filter((roomId) => roomId !== null && roomId !== undefined),
        switchMap(() => {
          const currentUser = this.auth.currentUser;
          if (currentUser?.email) {
            return from(this.resolveAndUpdateMemberName(currentUser.email));
          }
          return from(Promise.resolve());
        })
      )
      .subscribe();

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
    // プロジェクト選択状態もクリア
    this.projectSelectionService.clearSelection();
    await this.router.navigate(['/login']);
  }

  /** 認証状態を取得 */
  isAuthenticated(): boolean {
    return this.auth.currentUser !== null;
  }

  /** 
   * メールアドレスとルームIDに基づいてFirestoreのmembersコレクションから名前を取得し、
   * currentMemberNameSubjectを更新する
   */
  async resolveAndUpdateMemberName(email: string): Promise<void> {
    try {
      const roomId = this.getCurrentRoomId();
      if (!roomId) {
        console.log('⚠️ ルームIDが設定されていません。フォールバック使用');
        const currentUser = this.auth.currentUser;
        const fallbackName = currentUser?.displayName || currentUser?.email || 'ユーザー';
        this.currentMemberNameSubject.next(fallbackName);
        return;
      }

      // 直接Firestoreからルーム内のメンバーを取得（循環依存を避けるため）
      const membersCollection = collection(this.firestore, 'members');
      const q = query(
        membersCollection,
        where('email', '==', email),
        where('roomId', '==', roomId)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const memberDoc = querySnapshot.docs[0].data() as { name?: string };
        if (memberDoc?.name) {
          console.log('✅ メンバー名を取得 (ルームID考慮):', memberDoc.name, 'ルームID:', roomId);
          this.currentMemberNameSubject.next(memberDoc.name);
          return;
        }
      }

      // メンバーが見つからない場合
      console.log('⚠️ ルーム内でメンバーが見つからない。フォールバック使用');
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
    // ルームIDが変更されたときにメンバー名を再取得
    const currentUser = this.auth.currentUser;
    if (currentUser?.email) {
      this.resolveAndUpdateMemberName(currentUser.email).catch((error) => {
        console.error('ルームID変更時のメンバー名更新エラー:', error);
      });
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

  /**
   * 現在ログインしているユーザーのメンバー名を更新する
   * メンバー管理画面でユーザー名を更新した際に呼び出す
   */
  async refreshCurrentMemberName(): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (currentUser?.email) {
      await this.resolveAndUpdateMemberName(currentUser.email);
    }
  }

  /**
   * メンバー名を直接更新する（メールアドレスが一致する場合のみ）
   * @param email メールアドレス
   * @param name 新しい名前
   */
  updateMemberNameIfCurrentUser(email: string, name: string): void {
    const currentUser = this.auth.currentUser;
    if (currentUser?.email === email) {
      console.log('✅ 現在のユーザーのメンバー名を更新:', name);
      this.currentMemberNameSubject.next(name);
    }
  }
}
