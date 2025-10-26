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
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  /** メール・パスワードでログイン */
  async signInWithEmail() {
    if (!this.email || !this.password) {
      this.errorMessage = 'メールアドレスとパスワードを入力してください';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.signInWithEmail(this.email, this.password);
      this.router.navigate(['/']);
    } catch (error: any) {
      this.errorMessage = this.getErrorMessage(error.code);
    } finally {
      this.isLoading = false;
    }
  }

  /** メール・パスワードでサインアップ */
  async signUpWithEmail() {
    if (!this.email || !this.password) {
      this.errorMessage = 'メールアドレスとパスワードを入力してください';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'パスワードは6文字以上で入力してください';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.signUpWithEmail(this.email, this.password);
      this.router.navigate(['/']);
    } catch (error: any) {
      this.errorMessage = this.getErrorMessage(error.code);
    } finally {
      this.isLoading = false;
    }
  }

  /** Googleでログイン */
  async signInWithGoogle() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.signInWithGoogle();
      this.router.navigate(['/']);
    } catch (error: any) {
      this.errorMessage = this.getErrorMessage(error.code);
    } finally {
      this.isLoading = false;
    }
  }

  /** エラーメッセージを取得 */
  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'このメールアドレスは登録されていません';
      case 'auth/wrong-password':
        return 'パスワードが間違っています';
      case 'auth/email-already-in-use':
        return 'このメールアドレスは既に使用されています';
      case 'auth/weak-password':
        return 'パスワードが弱すぎます';
      case 'auth/invalid-email':
        return 'メールアドレスの形式が正しくありません';
      case 'auth/too-many-requests':
        return 'リクエストが多すぎます。しばらく待ってから再試行してください';
      case 'auth/popup-closed-by-user':
        return 'ログインがキャンセルされました';
      default:
        return 'ログインに失敗しました。もう一度お試しください';
    }
  }
}
