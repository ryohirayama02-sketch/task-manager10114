import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

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

  constructor(
    private authService: AuthService,
    private router: Router,
    private languageService: LanguageService
  ) {}

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
      this.errorMessage = this.languageService.translate('login.error.googleLoginFailed');
    } finally {
      this.isLoading = false;
    }
  }

  /** メールログイン */
  async onEmailLogin(email: string, password: string) {
    if (!email || !password) {
      this.errorMessage = this.languageService.translate('login.error.emailPasswordRequired');
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
      this.errorMessage = this.languageService.translate('login.error.allFieldsRequired');
      return;
    }

    if (password !== confirmPassword) {
      this.errorMessage = this.languageService.translate('login.error.passwordMismatch');
      return;
    }

    if (password.length < 6) {
      this.errorMessage = this.languageService.translate('login.error.passwordMinLength');
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
        return this.languageService.translate('login.error.invalidEmail');
      case 'auth/user-disabled':
        return this.languageService.translate('login.error.userDisabled');
      case 'auth/user-not-found':
        return this.languageService.translate('login.error.userNotFound');
      case 'auth/wrong-password':
        return this.languageService.translate('login.error.wrongPassword');
      case 'auth/email-already-in-use':
        return this.languageService.translate('login.error.emailAlreadyInUse');
      case 'auth/weak-password':
        return this.languageService.translate('login.error.weakPassword');
      case 'auth/operation-not-allowed':
        return this.languageService.translate('login.error.operationNotAllowed');
      default:
        return this.languageService.translate('login.error.loginFailed');
    }
  }
}
