import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, TranslatePipe],
  providers: [AuthService],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  isLoading = false;
  isSignUpMode = false;
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';

  private readonly EMAIL_STORAGE_KEY = 'saved_email';

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    // 保存されたメールアドレスを読み込む
    const savedEmail = localStorage.getItem(this.EMAIL_STORAGE_KEY);
    if (savedEmail) {
      this.email = savedEmail;
    }
  }

  /** Googleでログインボタンを押した時 */
  async onGoogleLogin() {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      console.log('[UI] Googleログイン開始');
      await this.authService.signInWithGoogle();
    } catch (error) {
      console.error('[UI] Googleログインエラー:', error);
      this.errorMessage = 'Googleログインに失敗しました。';
    } finally {
      this.isLoading = false;
    }
  }

  /** メールログイン */
  async onEmailLogin(email: string, password: string) {
    if (!email || !password) {
      this.errorMessage = 'メールアドレスとパスワードを入力してください。';
      return;
    }

    try {
      this.isLoading = true;
      this.errorMessage = '';
      const user = await this.authService.signInWithEmail(email, password);
      console.log('[UI] メールログイン成功:', user.uid);
      
      // メールアドレスを保存
      localStorage.setItem(this.EMAIL_STORAGE_KEY, email);
      
      this.router.navigate(['/kanban']);
    } catch (error: any) {
      console.error('[UI] メールログインエラー:', error);
      this.errorMessage = this.getErrorMessage(error.code);
    } finally {
      this.isLoading = false;
    }
  }

  /** メール登録 */
  async onEmailSignUp(email: string, password: string, confirmPassword: string) {
    if (!email || !password || !confirmPassword) {
      this.errorMessage = 'すべての項目を入力してください。';
      return;
    }

    if (password !== confirmPassword) {
      this.errorMessage = 'パスワードが一致しません。';
      return;
    }

    if (password.length < 6) {
      this.errorMessage = 'パスワードは6文字以上で入力してください。';
      return;
    }

    try {
      this.isLoading = true;
      this.errorMessage = '';
      const user = await this.authService.signUpWithEmail(email, password);
      console.log('[UI] メール登録成功:', user.uid);
      
      // メールアドレスを保存
      localStorage.setItem(this.EMAIL_STORAGE_KEY, email);
      
      this.router.navigate(['/kanban']);
    } catch (error: any) {
      console.error('[UI] メール登録エラー:', error);
      this.errorMessage = this.getErrorMessage(error.code);
    } finally {
      this.isLoading = false;
    }
  }

  /** 登録モード/ログインモードの切り替え */
  toggleMode() {
    this.isSignUpMode = !this.isSignUpMode;
    this.errorMessage = '';
    this.password = '';
    this.confirmPassword = '';
  }

  /** エラーメッセージを取得 */
  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'メールアドレスの形式が正しくありません。';
      case 'auth/user-disabled':
        return 'このアカウントは無効化されています。';
      case 'auth/user-not-found':
        return 'このメールアドレスは登録されていません。';
      case 'auth/wrong-password':
        return 'パスワードが正しくありません。';
      case 'auth/email-already-in-use':
        return 'このメールアドレスは既に使用されています。';
      case 'auth/weak-password':
        return 'パスワードが弱すぎます。';
      case 'auth/operation-not-allowed':
        return 'この操作は許可されていません。';
      default:
        return 'ログインに失敗しました。もう一度お試しください。';
    }
  }
}
