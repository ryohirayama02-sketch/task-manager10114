import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { Subject, combineLatest } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { NavbarComponent } from './components/navbar/navbar.component';
import { OfflineIndicatorComponent } from './components/offline-indicator/offline-indicator.component';
import { NotificationSchedulerService } from './services/notification-scheduler.service';
import { AuthService } from './services/auth.service';
import { HomeScreenSettingsService } from './services/home-screen-settings.service';
import { NavigationHistoryService } from './services/navigation-history.service';
import { TranslatePipe } from './pipes/translate.pipe';
import { LanguageService } from './services/language.service';
import { DOCUMENT } from '@angular/common';
import { Inject } from '@angular/core';

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
  private destroy$ = new Subject<void>();

  constructor(
    private notificationScheduler: NotificationSchedulerService,
    private authService: AuthService,
    private homeScreenSettingsService: HomeScreenSettingsService,
    private router: Router,
    private navigationHistory: NavigationHistoryService,
    private languageService: LanguageService,
    @Inject(DOCUMENT) private document: Document
  ) {
    // ナビゲーション履歴サービスを初期化（Routerイベントの監視を開始）
  }

  ngOnInit() {
    // HTML要素のlang属性を言語設定に応じて設定
    this.updateHtmlLang();
    // 言語設定の変更を監視
    this.languageService.language$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateHtmlLang();
      });

    // 🔍 現在のルーム情報をコンソールに出力（確認用）
    console.log('✅ 現在のルーム情報を確認します...');
    console.log('roomId:', this.authService.getCurrentRoomId());
    console.log('roomDocId:', this.authService.getCurrentRoomDocId());

    // 認証状態の復元を待つフラグ
    let authStateRestored = false;
    let homeScreenRedirected = false; // ✅ 追加: ホーム画面リダイレクト済みフラグ
    const initialUrl = this.router.url;
    const isInitialLoad = initialUrl !== '/login' && initialUrl !== '/room-login';

    // ✅ 修正: currentUserEmail$ と currentRoomId$ の両方を監視
    combineLatest([
      this.authService.user$,
      this.authService.currentRoomId$
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([user, roomId]) => {
        if (user) {
          console.log('👤 ログインユーザー:', user.email);
          console.log('📦 現在のroomId:', roomId);
          console.log(
            '📦 現在のroomDocId:',
            this.authService.getCurrentRoomDocId()
          );

          // ログイン時は通知スケジューラーを開始
          this.notificationScheduler.startScheduler();
          
          // 認証状態が復元されたことをマーク
          if (!authStateRestored) {
            authStateRestored = true;
            // 初回の認証状態復元時
            // ログイン画面から来た場合のみホーム画面へリダイレクト
            // ページ再読み込み時（既に他の画面にいる場合）はリダイレクトしない
            // ✅ roomIdが設定されている場合のみリダイレクト
            if (!isInitialLoad && roomId && !homeScreenRedirected) {
              // ログイン画面から来た場合
              homeScreenRedirected = true; // ✅ フラグを立てる
              this.redirectToHomeScreen(true);
            }
            // ページ再読み込み時は何もしない（現在の画面にとどまる）
          } else {
            // 認証状態が復元された後のログイン（通常のログイン操作）の場合のみリダイレクト
            // ページ再読み込み時はリダイレクトしない
            // ✅ roomIdが設定されている場合のみリダイレクト
            if (initialUrl !== this.router.url && roomId && !homeScreenRedirected) {
              // URLが変更されている場合は、通常のログイン操作と判断
              homeScreenRedirected = true; // ✅ フラグを立てる
              this.redirectToHomeScreen(true);
            }
          }
        } else {
          // ログアウト時は通知スケジューラーを停止
          this.notificationScheduler.stopScheduler();
          homeScreenRedirected = false; // ✅ ログアウト時にフラグをリセット
          
          // 認証状態が復元された後で、かつログイン画面にいない場合のみログイン画面へナビゲート
          // これにより、ページ再読み込み時の一時的なnull状態ではリダイレクトしない
          if (authStateRestored && !this.router.url.includes('/login') && !this.router.url.includes('/room-login')) {
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
   * @param isInitialLoad 初回読み込み時かどうか（ページ再読み込み時はfalse）
   */
  private redirectToHomeScreen(isInitialLoad: boolean = false) {
    // ログイン画面にいる場合はスキップ
    if (this.router.url.includes('/login') || this.router.url.includes('/room-login')) {
      console.log('🚪 ログイン画面でのホーム画面設定リダイレクトはスキップ');
      return;
    }

    // ✅ 追加: roomIdが設定されていることを確認
    const roomId = this.authService.getCurrentRoomId();
    if (!roomId) {
      console.log('🏠 roomIdが設定されていないため、リダイレクトをスキップ');
      return;
    }

    // ページ再読み込み時（既に特定の画面にいる場合）はリダイレクトしない
    if (!isInitialLoad && this.router.url !== '/' && this.router.url !== '') {
      console.log('🏠 ページ再読み込み時のため、リダイレクトをスキップ');
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
        // ただし、ページ再読み込み時はリダイレクトしない
        const currentPath = this.router.url;
        if ((isInitialLoad || currentPath === '/' || currentPath === '') && !this.router.url.includes('/login')) {
          console.log('🏠 エラー時のデフォルトリダイレクト: /kanban');
          this.router.navigate(['/kanban']);
        }
      },
    });
  }

  /**
   * HTML要素のlang属性を現在の言語設定に応じて更新
   */
  private updateHtmlLang(): void {
    const currentLanguage = this.languageService.getCurrentLanguage();
    const htmlElement = this.document.documentElement;
    if (htmlElement) {
      htmlElement.setAttribute('lang', currentLanguage);
    }
  }

  ngOnDestroy() {
    // アプリケーション終了時に通知スケジューラーを停止
    this.notificationScheduler.stopScheduler();
    // 購読を解除
    this.destroy$.next();
    this.destroy$.complete();
  }
}
