import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule],
  providers: [AuthService],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  isLoading = false;

  constructor(private authService: AuthService, private router: Router) {}

  /** Googleでログインボタンを押した時 */
  async onGoogleLogin() {
    try {
      this.isLoading = true;
      console.log('[UI] Googleログイン開始');
      await this.authService.signInWithGoogle();
    } catch (error) {
      console.error('[UI] Googleログインエラー:', error);
      alert('Googleログインに失敗しました。コンソールを確認してください。');
    } finally {
      this.isLoading = false;
    }
  }

  /** メールログイン（必要なら） */
  async onEmailLogin(email: string, password: string) {
    try {
      this.isLoading = true;
      const user = await this.authService.signInWithEmail(email, password);
      console.log('[UI] メールログイン成功:', user.uid);
      this.router.navigate(['/kanban']);
    } catch (error) {
      console.error('[UI] メールログインエラー:', error);
      alert('メールログインに失敗しました。');
    } finally {
      this.isLoading = false;
    }
  }
}
