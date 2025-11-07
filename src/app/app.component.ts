import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { NavbarComponent } from './components/navbar/navbar.component';
import { OfflineIndicatorComponent } from './components/offline-indicator/offline-indicator.component';
import { NotificationSchedulerService } from './services/notification-scheduler.service';
import { AuthService } from './services/auth.service';
import { HomeScreenSettingsService } from './services/home-screen-settings.service';
import { TranslatePipe } from './pipes/translate.pipe';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    MatButtonModule,
    NavbarComponent,
    OfflineIndicatorComponent,
    TranslatePipe,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
  constructor(
    private notificationScheduler: NotificationSchedulerService,
    private authService: AuthService,
    private homeScreenSettingsService: HomeScreenSettingsService,
    private router: Router
  ) {}

  ngOnInit() {
    // 🔍 現在のルーム情報をコンソールに出力（確認用）
    console.log('✅ 現在のルーム情報を確認します...');
    console.log('roomId:', this.authService.getCurrentRoomId());
    console.log('roomDocId:', this.authService.getCurrentRoomDocId());

    // 認証状態の変更を監視して通知スケジューラーを制御
    this.authService.user$.subscribe((user) => {
      if (user) {
        console.log('👤 ログインユーザー:', user.email);
        console.log('📦 現在のroomId:', this.authService.getCurrentRoomId());
        console.log(
          '📦 現在のroomDocId:',
          this.authService.getCurrentRoomDocId()
        );

        // ログイン時は通知スケジューラーを開始
        this.notificationScheduler.startScheduler();
        // ホーム画面設定に基づいてリダイレクト
        this.redirectToHomeScreen();
      } else {
        // ログアウト時は通知スケジューラーを停止
        this.notificationScheduler.stopScheduler();
        // ログイン画面にいない場合のみログイン画面へナビゲート
        if (!this.router.url.includes('/login')) {
          console.log(
            '🚪 ユーザーがログアウトしたため、ログイン画面へ遷移します'
          );
          this.router.navigate(['/login']);
        }
      }
    });
  }

  /**
   * ホーム画面設定に基づいてリダイレクト
   */
  private redirectToHomeScreen() {
    // ログイン画面にいる場合はスキップ
    if (this.router.url.includes('/login')) {
      console.log('🚪 ログイン画面でのホーム画面設定リダイレクトはスキップ');
      return;
    }

    console.log('🏠 ホーム画面設定を読み込み中...');
    this.homeScreenSettingsService.getHomeScreenSettings().subscribe({
      next: (settings) => {
        const homeScreen =
          settings?.homeScreen ||
          this.homeScreenSettingsService.getDefaultHomeScreen();
        const currentPath = this.router.url;

        console.log('🏠 ホーム画面設定:', settings);
        console.log('🏠 選択されたホーム画面:', homeScreen);
        console.log('🏠 現在のパス:', currentPath);

        // ホーム画面設定がデフォルト（カンバン）と異なる場合のみリダイレクト
        const defaultHomeScreen =
          this.homeScreenSettingsService.getDefaultHomeScreen();
        const shouldRedirect =
          homeScreen !== defaultHomeScreen &&
          (currentPath === '/' ||
            currentPath === '' ||
            currentPath === `/${defaultHomeScreen}`);

        if (shouldRedirect) {
          console.log(
            '🏠 ホーム画面設定に基づいてリダイレクト実行:',
            `/${homeScreen}`
          );
          this.router.navigate([`/${homeScreen}`]);
        } else {
          console.log(
            '🏠 リダイレクトスキップ（デフォルト設定または条件に合わない）'
          );
        }
      },
      error: (error) => {
        console.error('❌ ホーム画面設定の読み込みエラー:', error);
        // エラーの場合はデフォルトのカンバン画面にリダイレクト
        const currentPath = this.router.url;
        if (currentPath === '/' || currentPath === '') {
          console.log('🏠 エラー時のデフォルトリダイレクト: /kanban');
          this.router.navigate(['/kanban']);
        }
      },
    });
  }

  ngOnDestroy() {
    // アプリケーション終了時に通知スケジューラーを停止
    this.notificationScheduler.stopScheduler();
  }
}
