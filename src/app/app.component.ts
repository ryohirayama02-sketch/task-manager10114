import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { NavbarComponent } from './components/navbar/navbar.component';
import { NotificationSchedulerService } from './services/notification-scheduler.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatButtonModule, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'task-manager';

  constructor(
    private notificationScheduler: NotificationSchedulerService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // 認証状態の変更を監視して通知スケジューラーを制御
    this.authService.user$.subscribe((user) => {
      if (user) {
        // ログイン時は通知スケジューラーを開始
        this.notificationScheduler.startScheduler();
      } else {
        // ログアウト時は通知スケジューラーを停止
        this.notificationScheduler.stopScheduler();
      }
    });
  }

  ngOnDestroy() {
    // アプリケーション終了時に通知スケジューラーを停止
    this.notificationScheduler.stopScheduler();
  }
}
