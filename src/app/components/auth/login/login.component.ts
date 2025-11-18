import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { LanguageService } from '../../../services/language.service';
import { TranslatePipe } from '../../../pipes/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private languageService: LanguageService
  ) {}

  /** メール・パスワードでログイン */
  async signInWithEmail() {
    const trimmedEmail = this.email?.trim() || '';
    const trimmedPassword = this.password?.trim() || '';
    
    if (!trimmedEmail || !trimmedPassword) {
      this.errorMessage = this.languageService.translate('login.error.emailPasswordRequiredNoPeriod');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.signInWithEmail(trimmedEmail, trimmedPassword);
      this.router.navigate(['/']);
    } catch (error: any) {
      this.errorMessage = this.getErrorMessage(error?.code);
    } finally {
      this.isLoading = false;
    }
  }

  /** メール・パスワードでサインアップ */
  async signUpWithEmail() {
    const trimmedEmail = this.email?.trim() || '';
    const trimmedPassword = this.password?.trim() || '';
    
    if (!trimmedEmail || !trimmedPassword) {
      this.errorMessage = this.languageService.translate('login.error.emailPasswordRequiredNoPeriod');
      return;
    }

    if (trimmedPassword.length < 6) {
      this.errorMessage = this.languageService.translate('login.error.passwordMinLengthNoPeriod');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.signUpWithEmail(trimmedEmail, trimmedPassword);
      this.router.navigate(['/']);
    } catch (error: any) {
      this.errorMessage = this.getErrorMessage(error?.code);
    } finally {
      this.isLoading = false;
    }
  }

  /** Googleでログイン */
  async signInWithGoogle() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      // リダイレクト型認証はリダイレクトするため、
      // AuthServiceが自動的にナビゲーションを処理します
      await this.authService.signInWithGoogle();
      // リダイレクト後はこの行には到達しない（ページがリダイレクトされる）
    } catch (error: any) {
      // ここでエラーキャッチするのはリダイレクト前のエラーのみ
      this.errorMessage = this.getErrorMessage(error?.code || error?.message);
      this.isLoading = false;
    }
  }

  /** エラーメッセージを取得 */
  private getErrorMessage(errorCode: string | undefined): string {
    if (!errorCode) {
      return this.languageService.translate('login.error.loginFailedNoPeriod');
    }
    
    switch (errorCode) {
      case 'auth/user-not-found':
        return this.languageService.translate('login.error.userNotFoundNoPeriod');
      case 'auth/wrong-password':
        return this.languageService.translate('login.error.wrongPasswordAlt');
      case 'auth/email-already-in-use':
        return this.languageService.translate('login.error.emailAlreadyInUseNoPeriod');
      case 'auth/weak-password':
        return this.languageService.translate('login.error.weakPasswordNoPeriod');
      case 'auth/invalid-email':
        return this.languageService.translate('login.error.invalidEmailNoPeriod');
      case 'auth/too-many-requests':
        return this.languageService.translate('login.error.tooManyRequests');
      case 'auth/popup-closed-by-user':
        return this.languageService.translate('login.error.popupClosedByUser');
      default:
        return this.languageService.translate('login.error.loginFailedNoPeriod');
    }
  }
}
