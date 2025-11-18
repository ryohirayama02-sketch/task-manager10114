import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { TaskReminderService } from '../../services/task-reminder.service';
import { HomeScreenSettingsService } from '../../services/home-screen-settings.service';
import { RoomService } from '../../services/room.service';
import { Router } from '@angular/router';
import { ProjectSelectionService } from '../../services/project-selection.service';
import { RoomDeleteConfirmDialogComponent } from './room-delete-confirm-dialog.component';
import { ProjectService } from '../../services/project.service';
import { MemberManagementService } from '../../services/member-management.service';
import { EditLogService } from '../../services/edit-log.service';
import { NotificationSettings } from '../../models/notification.model';
import {
  HomeScreenSettings,
  HomeScreenType,
  HOME_SCREEN_OPTIONS,
} from '../../models/home-screen-settings.model';
import {
  LanguageService,
  SupportedLanguage,
} from '../../services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatIconModule,
    MatExpansionModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit, OnDestroy {
  notificationSettings!: NotificationSettings; // 非null assertion
  isLoading = false;
  isSaving = false;
  selectedSettingsTab: 'notifications' | 'home' | 'language' | 'roomInfo' =
    'notifications';

  // ルーム情報
  roomInfo: { name: string; roomId: string; password: string } | null = null;

  // ホーム画面設定
  homeScreenSettings: HomeScreenSettings | null = null;
  selectedHomeScreen: HomeScreenType = 'kanban';
  homeScreenOptions = HOME_SCREEN_OPTIONS;

  // 言語設定
  languageOptions: Array<{ value: SupportedLanguage; labelKey: string }> = [
    { value: 'ja', labelKey: 'language.japanese' },
    { value: 'en', labelKey: 'language.english' },
  ];
  selectedLanguage: SupportedLanguage = 'ja';
  isSavingLanguage = false;
  private languageService = inject(LanguageService);
  private destroy$ = new Subject<void>();

  private getCloseLabel(): string {
    return this.languageService.translate('common.close');
  }

  // 通知日数オプション
  deadlineNotificationDays = [1, 2, 3, 5, 7, 14, 30];
  selectedDeadlineDays: number[] = [1, 3, 7];

  // 時間オプション（タスク詳細画面と同じ形式）
  hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i.toString().padStart(2, '0'),
    label: i.toString().padStart(2, '0'),
  }));
  minuteOptions = Array.from({ length: 60 }, (_, i) => ({
    value: i.toString().padStart(2, '0'),
    label: i.toString().padStart(2, '0'),
  }));

  // 時間入力用のオブジェクト
  taskDeadlineTime = { hour: '09', minute: '00' };
  // 通知オフ期間機能を無効化（コードは残す）
  // quietStartTime = { hour: '22', minute: '00' };
  // quietEndTime = { hour: '08', minute: '00' };
  workTimeOverflowTime = { hour: '09', minute: '00' };
  dailyReminderTime = { hour: '09', minute: '00' };

  workTimeOptions: number[] = Array.from({ length: 31 }, (_, i) => i * 10); // 0~300時間を10時間刻み
  checkPeriodOptions = [1, 3, 7, 14, 30];

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
    private taskReminderService: TaskReminderService,
    private homeScreenSettingsService: HomeScreenSettingsService,
    private roomService: RoomService,
    private snackBar: MatSnackBar,
    private router: Router,
    private projectSelectionService: ProjectSelectionService,
    private dialog: MatDialog,
    private projectService: ProjectService,
    private memberManagementService: MemberManagementService,
    private editLogService: EditLogService
  ) {}

  async ngOnInit() {
    const roomId = this.authService.getCurrentRoomId();
    const roomDocId = this.authService.getCurrentRoomDocId();
    if (!roomId || !roomDocId) {
      this.snackBar.open(
        this.languageService.translate('settings.roomEnterRequired'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
      return;
    }
    // デフォルト設定を初期化
    this.notificationSettings =
      this.notificationService.createDefaultNotificationSettings();
    this.selectedLanguage = this.languageService.getCurrentLanguage();
    await this.loadNotificationSettings();
    await this.loadHomeScreenSettings();
    await this.loadRoomInfo();
  }

  /** 通知設定を読み込み */
  async loadNotificationSettings() {
    this.isLoading = true;
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        this.snackBar.open(
          this.languageService.translate('settings.loginRequired'),
          this.getCloseLabel(),
          { duration: 3000 }
        );
        return;
      }

      const loadedSettings =
        await this.notificationService.getNotificationSettings(currentUser.uid);

      if (loadedSettings) {
        this.notificationSettings = loadedSettings;
        // ✅ 修正: ログインユーザーのメールアドレスを固定で設定
        const currentUserEmail = currentUser.email || '';
        if (currentUserEmail) {
          this.notificationSettings.notificationChannels.email.address = currentUserEmail;
        }
        // 通知オフ期間機能を無効化（コードは残す）
        // // quietHoursが存在しない場合は初期化
        // if (!this.notificationSettings.quietHours) {
        //   this.notificationSettings.quietHours = {
        //     enabled: false,
        //     startTime: '22:00',
        //     endTime: '08:00',
        //     weekends: true,
        //   };
        // }
        // // enabledがundefinedの場合はfalseに設定
        // if (this.notificationSettings.quietHours.enabled === undefined) {
        //   this.notificationSettings.quietHours.enabled = false;
        // }

        // 時間を{ hour, minute }形式に変換
        this.taskDeadlineTime = this.parseTimeString(
          this.notificationSettings.taskDeadlineNotifications.timeOfDay ||
            '09:00'
        );
        // 通知オフ期間機能を無効化（コードは残す）
        // this.quietStartTime = this.parseTimeString(
        //   this.notificationSettings.quietHours.startTime || '22:00'
        // );
        // this.quietEndTime = this.parseTimeString(
        //   this.notificationSettings.quietHours.endTime || '08:00'
        // );
        this.workTimeOverflowTime = this.parseTimeString(
          this.notificationSettings.workTimeOverflowNotifications.timeOfDay ||
            '09:00'
        );
        this.dailyReminderTime = this.parseTimeString(
          this.notificationSettings.dailyDeadlineReminder.timeOfDay || '09:00'
        );

        // デバッグ: 読み込んだ設定を確認
        // 通知オフ期間機能を無効化（コードは残す）
        // console.log('📋 通知設定を読み込みました:', {
        //   quietHours: this.notificationSettings.quietHours,
        //   quietHoursEnabled: this.notificationSettings.quietHours?.enabled,
        // });
      } else {
        // デフォルト設定を作成
        this.notificationSettings =
          this.notificationService.createDefaultNotificationSettings();
        // ✅ 修正: ログインユーザーのメールアドレスを固定で設定
        const currentUserEmail = currentUser.email || '';
        if (currentUserEmail) {
          this.notificationSettings.notificationChannels.email.address = currentUserEmail;
        }
        // 通知オフ期間機能を無効化（コードは残す）
        // console.log('📋 デフォルト通知設定を作成:', {
        //   quietHours: this.notificationSettings.quietHours,
        //   quietHoursEnabled: this.notificationSettings.quietHours?.enabled,
        // });
      }

      // 選択された日数を設定
      this.selectedDeadlineDays =
        this.notificationSettings.taskDeadlineNotifications.daysBeforeDeadline;
    } catch (error) {
      console.error('通知設定の読み込みエラー:', error);
      console.error('エラーの詳細:', error);
      this.snackBar.open(
        this.languageService.translateWithParams('settings.loadFailed', {
          error: String(error),
        }),
        this.getCloseLabel(),
        {
          duration: 5000,
        }
      );
    } finally {
      this.isLoading = false;
    }
  }

  /** 言語設定を保存 */
  saveLanguageSetting(): void {
    if (!this.selectedLanguage || this.isSavingLanguage) {
      return;
    }

    this.isSavingLanguage = true;
    try {
      this.languageService.setLanguage(this.selectedLanguage);
      this.snackBar.open(
        this.languageService.translate('settings.language.saved'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
    } catch (error) {
      console.error('言語設定の保存エラー:', error);
      this.snackBar.open(
        this.languageService.translate('settings.language.saveError'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
    } finally {
      this.isSavingLanguage = false;
    }
  }

  /** 通知オフ期間のON/OFF変更時の処理 */
  // 通知オフ期間機能を無効化（コードは残す）
  /*
  onQuietHoursEnabledChange(event: any): void {
    // 値を明示的に設定
    this.notificationSettings.quietHours.enabled = event.checked;
    console.log('🔔 通知オフ期間のON/OFF変更:', {
      checked: event.checked,
      quietHoursEnabled: this.notificationSettings.quietHours.enabled,
    });
  }
  */

  /** 時間文字列（'HH:mm'）を{ hour, minute }形式に変換 */
  parseTimeString(timeString: string): { hour: string; minute: string } {
    if (!timeString || !timeString.includes(':')) {
      return { hour: '00', minute: '00' };
    }
    const [hour, minute] = timeString.split(':');
    return {
      hour: hour.padStart(2, '0'),
      minute: minute.padStart(2, '0'),
    };
  }

  /** { hour, minute }形式を時間文字列（'HH:mm'）に変換 */
  formatTimeString(time: { hour: string; minute: string }): string {
    return `${time.hour.padStart(2, '0')}:${time.minute.padStart(2, '0')}`;
  }

  /** 通知オフ期間の時間が有効かチェック（開始時間と終了時間が同じでないか） */
  // 通知オフ期間機能を無効化（コードは残す）
  /*
  isQuietHoursTimeValid(): boolean {
    if (!this.notificationSettings?.quietHours.enabled) {
      return true; // 通知オフ期間が無効な場合は常に有効
    }
    const startTime = this.formatTimeString(this.quietStartTime);
    const endTime = this.formatTimeString(this.quietEndTime);
    return startTime !== endTime;
  }
  */

  /** 通知設定を保存 */
  async saveNotificationSettings() {
    if (!this.notificationSettings) return;

    // 通知オフ期間機能を無効化（コードは残す）
    // // 通知オフ期間の時間バリデーション
    // if (!this.isQuietHoursTimeValid()) {
    //   this.snackBar.open(
    //     '開始時間と終了時間を同じにすることはできません',
    //     this.getCloseLabel(),
    //     {
    //       duration: 5000,
    //     }
    //   );
    //   return;
    // }

    this.isSaving = true;
    try {
      // ✅ 修正: ログインユーザーのメールアドレスを固定で設定
      const currentUser = this.authService.getCurrentUser();
      if (currentUser?.email) {
        this.notificationSettings.notificationChannels.email.address = currentUser.email;
      }

      // 選択された日数を設定に反映
      this.notificationSettings.taskDeadlineNotifications.daysBeforeDeadline =
        this.selectedDeadlineDays;

      // 時間を文字列形式に変換して設定に反映
      this.notificationSettings.taskDeadlineNotifications.timeOfDay =
        this.formatTimeString(this.taskDeadlineTime);
      // 通知オフ期間機能を無効化（コードは残す）
      // this.notificationSettings.quietHours.startTime = this.formatTimeString(
      //   this.quietStartTime
      // );
      // this.notificationSettings.quietHours.endTime = this.formatTimeString(
      //   this.quietEndTime
      // );
      this.notificationSettings.workTimeOverflowNotifications.timeOfDay =
        this.formatTimeString(this.workTimeOverflowTime);
      this.notificationSettings.dailyDeadlineReminder.timeOfDay =
        this.formatTimeString(this.dailyReminderTime);

      // デバッグ: 保存前の値を確認
      // 通知オフ期間機能を無効化（コードは残す）
      // console.log('💾 保存前の通知設定:', {
      //   quietHours: this.notificationSettings.quietHours,
      //   quietHoursEnabled: this.notificationSettings.quietHours?.enabled,
      // });

      await this.notificationService.saveNotificationSettings(
        this.notificationSettings
      );
      this.snackBar.open(
        this.languageService.translate('settings.saveSuccess'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
    } catch (error) {
      console.error('通知設定の保存エラー:', error);
      this.snackBar.open(
        this.languageService.translate('settings.saveError'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
    } finally {
      this.isSaving = false;
    }
  }

  /** 通知日数の選択を更新 */
  updateDeadlineDays(day: number, checked: boolean) {
    if (checked) {
      this.selectedDeadlineDays.push(day);
    } else {
      this.selectedDeadlineDays = this.selectedDeadlineDays.filter(
        (d) => d !== day
      );
    }
    this.selectedDeadlineDays.sort((a, b) => a - b);
  }

  /** 通知日数が選択されているかチェック */
  isDeadlineDaySelected(day: number): boolean {
    return this.selectedDeadlineDays.includes(day);
  }

  /** テスト通知を送信 */
  async sendTestNotification() {
    if (!this.notificationSettings) return;

    // 連続クリックを防ぐ
    if (this.isSaving) {
      console.log('既に処理中です');
      return;
    }

    this.isSaving = true;
    console.log('テスト通知送信開始');
    try {
      // メール通知のテスト
      if (this.notificationSettings.notificationChannels.email.enabled) {
        const emailAddress =
          this.notificationSettings.notificationChannels.email.address;
        if (!emailAddress) {
          this.snackBar.open(
            this.languageService.translate('settings.emailRequired'),
            this.getCloseLabel(),
            {
              duration: 3000,
            }
          );
          return;
        }

        console.log('メールアドレス:', emailAddress);

        // メールアドレスの検証
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailAddress)) {
          this.snackBar.open(
            this.languageService.translate('settings.validEmailRequired'),
            this.getCloseLabel(),
            {
              duration: 3000,
            }
          );
          return;
        }

        const result = await this.notificationService.sendTestNotification(
          emailAddress
        );
        console.log('送信結果:', result);

        if (result) {
          this.snackBar.open(
            this.languageService.translate('settings.testNotificationSent'),
            this.getCloseLabel(),
            {
              duration: 3000,
            }
          );
        } else {
          this.snackBar.open(
            this.languageService.translate('settings.testNotificationFailed'),
            this.getCloseLabel(),
            {
              duration: 3000,
            }
          );
        }
      } else {
        this.snackBar.open(
          this.languageService.translate('settings.enableEmailNotification'),
          this.getCloseLabel(),
          {
            duration: 3000,
          }
        );
      }
    } catch (error: any) {
      console.error('テスト通知エラー:', error);
      const errorMessage = error?.message || error?.code || '不明なエラー';
      this.snackBar.open(
        this.languageService.translateWithParams(
          'settings.testNotificationFailedWithError',
          {
            error: errorMessage,
          }
        ),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * 期限が近いタスクのメール通知を手動送信（テスト用）
   */
  async sendTaskRemindersTest(): Promise<void> {
    const roomId = this.authService.getCurrentRoomId();
    const roomDocId = this.authService.getCurrentRoomDocId();
    if (!roomId || !roomDocId) {
      this.snackBar.open(
        this.languageService.translate('settings.roomEnterRequired'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
      return;
    }

    this.isSaving = true;

    try {
      console.log('🔔 期限が近いタスクのメール通知をテスト送信');

      const result = await this.taskReminderService.sendTaskReminders();

      if (result.success) {
        this.snackBar.open(
          this.languageService.translateWithParams(
            'settings.deadlineNotificationSent',
            {
              taskCount: String(result.taskCount),
              userCount: String(result.userCount),
            }
          ),
          this.getCloseLabel(),
          { duration: 5000 }
        );
      } else {
        this.snackBar.open(
          this.languageService.translate('settings.emailNotificationFailed'),
          this.getCloseLabel(),
          {
            duration: 3000,
          }
        );
      }
    } catch (error) {
      console.error('期限が近いタスクのメール通知テストエラー:', error);
      this.snackBar.open(
        this.languageService.translate('settings.emailNotificationFailed'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * タスク期限通知を手動送信（テスト用・デバッグ用）
   */
  async sendTaskDeadlineNotificationsTest(): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.snackBar.open(
        this.languageService.translate('settings.loginRequired'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
      return;
    }

    const roomId = this.authService.getCurrentRoomId();
    const roomDocId = this.authService.getCurrentRoomDocId();
    if (!roomId || !roomDocId) {
      this.snackBar.open(
        this.languageService.translate('settings.roomEnterRequired'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
      return;
    }

    this.isSaving = true;

    try {
      console.log('🔔 タスク期限通知をテスト送信');

      const { getFunctions, httpsCallable } = await import(
        'firebase/functions'
      );
      const { getApp } = await import('firebase/app');
      const functions = getFunctions(getApp(), 'us-central1');

      const callable = httpsCallable(
        functions,
        'sendTaskDeadlineNotificationsManual'
      );
      const result = (await callable({
        userId: currentUser.uid,
        roomId,
        roomDocId,
        force: true, // 通知時間チェックをスキップ
      })) as any;

      console.log('📊 実行結果:', result.data);

      if (result.data?.success) {
        const results = result.data.results || [];

        // 詳細ログを出力
        console.log('📋 詳細結果:', results);
        results.forEach((r: any, index: number) => {
          console.log(`\n結果 ${index + 1}:`, {
            userId: r.userId,
            success: r.success,
            skipped: r.skipped,
            reason: r.reason,
            taskCount: r.taskCount,
            message: r.message,
            error: r.error,
            details: r.details,
            email: r.email,
          });
        });

        const successCount = results.filter((r: any) => r.success).length;
        const skippedCount = results.filter((r: any) => r.skipped).length;
        const errorCount = results.filter((r: any) => r.error).length;
        const taskCount = results.reduce(
          (sum: number, r: any) => sum + (r.taskCount || 0),
          0
        );

        const message = this.languageService.translateWithParams(
          'settings.deadlineTestCompleted',
          {
            successCount: String(successCount),
            skippedCount: String(skippedCount),
            errorCount: String(errorCount),
            taskCount: String(taskCount),
          }
        );

        this.snackBar.open(message, this.getCloseLabel(), {
          duration: 10000,
        });
      } else {
        this.snackBar.open(
          this.languageService.translate('settings.deadlineTestFailed'),
          this.getCloseLabel(),
          {
            duration: 3000,
          }
        );
      }
    } catch (error: any) {
      console.error('タスク期限通知テストエラー:', error);
      this.snackBar.open(
        this.languageService.translateWithParams('settings.error', {
          error: error.message || '不明なエラー',
        }),
        this.getCloseLabel(),
        {
          duration: 5000,
        }
      );
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * 作業時間オーバー通知を手動送信（テスト用・デバッグ用）
   */
  async sendWorkTimeOverflowNotificationsTest(): Promise<void> {
    console.log('🔔 [1/7] 作業時間オーバー通知テスト送信開始');

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.error('❌ [1/7] ユーザーがログインしていません');
      this.snackBar.open('ログインしてください', this.getCloseLabel(), {
        duration: 3000,
      });
      return;
    }
    console.log(
      '✅ [1/7] ユーザー認証確認完了:',
      currentUser.uid,
      currentUser.email
    );

    const roomId = this.authService.getCurrentRoomId();
    const roomDocId = this.authService.getCurrentRoomDocId();
    if (!roomId || !roomDocId) {
      console.error('❌ [2/7] ルーム情報が取得できません:', {
        roomId,
        roomDocId,
      });
      this.snackBar.open('ルームに入室してください', this.getCloseLabel(), {
        duration: 3000,
      });
      return;
    }
    console.log('✅ [2/7] ルーム情報確認完了:', { roomId, roomDocId });

    this.isSaving = true;

    try {
      console.log('🔔 [3/7] Firebase Functionsのインポート開始');

      const { getFunctions, httpsCallable } = await import(
        'firebase/functions'
      );
      const { getApp } = await import('firebase/app');
      console.log('✅ [3/7] Firebase Functionsのインポート完了');

      console.log('🔔 [4/7] Functionsインスタンスの取得開始');
      const functions = getFunctions(getApp(), 'us-central1');
      console.log('✅ [4/7] Functionsインスタンスの取得完了');

      console.log('🔔 [5/7] Callable関数の準備開始');
      const callable = httpsCallable(
        functions,
        'sendWorkTimeOverflowNotificationsManual'
      );
      console.log('✅ [5/7] Callable関数の準備完了');

      const requestData = {
        userId: currentUser.uid,
        roomId,
        roomDocId,
        force: true, // 通知時間チェックをスキップ
      };
      console.log('🔔 [6/7] Cloud Function呼び出し開始:', requestData);

      const result = (await callable(requestData)) as any;
      console.log('✅ [6/7] Cloud Function呼び出し完了');

      console.log('📊 [7/7] 実行結果:', result.data);

      if (result.data?.success) {
        console.log('✅ [7/7] 実行成功フラグ確認');
        const results = result.data.results || [];
        console.log('📋 [7/7] 詳細結果配列:', results);
        console.log(`📋 [7/7] 結果数: ${results.length}件`);

        // 詳細ログを出力
        results.forEach((r: any, index: number) => {
          console.log(`\n📋 [結果 ${index + 1}/${results.length}]`, {
            userId: r.userId,
            success: r.success,
            skipped: r.skipped,
            reason: r.reason,
            overflowUserCount: r.overflowUserCount,
            notificationCount: r.notificationCount,
            message: r.message,
            error: r.error,
          });

          // 各結果の詳細分析
          if (r.error) {
            console.error(`❌ [結果 ${index + 1}] エラー発生:`, r.error);
          }
          if (r.skipped) {
            console.warn(`⚠️ [結果 ${index + 1}] スキップ:`, r.reason);
          }
          if (r.overflowUserCount > 0 && r.notificationCount === 0) {
            console.warn(
              `⚠️ [結果 ${
                index + 1
              }] オーバーユーザーは検出されたが、通知数が0:`,
              {
                overflowUserCount: r.overflowUserCount,
                notificationCount: r.notificationCount,
              }
            );
          }
          if (r.notificationCount > 0) {
            console.log(`✅ [結果 ${index + 1}] 通知送信成功:`, {
              notificationCount: r.notificationCount,
            });
          }
        });

        const successCount = results.filter((r: any) => r.success).length;
        const skippedCount = results.filter((r: any) => r.skipped).length;
        const errorCount = results.filter((r: any) => r.error).length;
        const overflowUserCount = results.reduce(
          (sum: number, r: any) => sum + (r.overflowUserCount || 0),
          0
        );
        const notificationCount = results.reduce(
          (sum: number, r: any) => sum + (r.notificationCount || 0),
          0
        );

        console.log('📊 [7/7] 集計結果:', {
          successCount,
          skippedCount,
          errorCount,
          overflowUserCount,
          notificationCount,
        });

        const message = this.languageService.translateWithParams(
          'settings.workTimeTestCompleted',
          {
            successCount: String(successCount),
            skippedCount: String(skippedCount),
            errorCount: String(errorCount),
            overflowUserCount: String(overflowUserCount),
            notificationCount: String(notificationCount),
          }
        );

        if (notificationCount === 0 && overflowUserCount > 0) {
          console.warn(
            '⚠️ [7/7] 警告: オーバーユーザーは検出されたが、メールが送信されていません'
          );
          console.warn('⚠️ [7/7] Firebase Consoleのログを確認してください:');
          console.warn(
            '⚠️ [7/7] https://console.firebase.google.com/project/kensyu10114/functions/logs'
          );
        }

        this.snackBar.open(message, this.getCloseLabel(), {
          duration: 10000,
        });
      } else {
        console.error('❌ [7/7] 実行失敗:', result.data);
        this.snackBar.open(
          this.languageService.translate('settings.workTimeTestFailed'),
          this.getCloseLabel(),
          {
            duration: 3000,
          }
        );
      }
    } catch (error: any) {
      console.error('❌ [エラー] 作業時間オーバー通知テストエラー:', error);
      console.error('❌ [エラー] エラータイプ:', error.name);
      console.error('❌ [エラー] エラーメッセージ:', error.message);
      console.error('❌ [エラー] エラーコード:', error.code);
      console.error('❌ [エラー] エラー詳細:', error);
      this.snackBar.open(
        this.languageService.translateWithParams('settings.error', {
          error: error.message || '不明なエラー',
        }),
        this.getCloseLabel(),
        {
          duration: 5000,
        }
      );
    } finally {
      console.log('🔔 [完了] 作業時間オーバー通知テスト送信処理完了');
      this.isSaving = false;
    }
  }

  /**
   * 今日のタスク通知を手動送信（テスト用・デバッグ用）
   */
  async sendDailyTaskRemindersTest(): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.snackBar.open(
        this.languageService.translate('settings.loginRequired'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
      return;
    }

    const roomId = this.authService.getCurrentRoomId();
    const roomDocId = this.authService.getCurrentRoomDocId();
    if (!roomId || !roomDocId) {
      this.snackBar.open(
        this.languageService.translate('settings.roomEnterRequired'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
      return;
    }

    this.isSaving = true;

    try {
      console.log('🔔 [フロントエンド] 今日のタスク通知をテスト送信開始');
      console.log('   - userId:', currentUser.uid);
      console.log('   - roomId:', roomId);
      console.log('   - roomDocId:', roomDocId);

      const { getFunctions, httpsCallable } = await import(
        'firebase/functions'
      );
      const { getApp } = await import('firebase/app');
      const functions = getFunctions(getApp(), 'us-central1');

      console.log('🔍 [フロントエンド] Cloud Functions呼び出し準備完了');
      console.log('   - 関数名: sendDailyTaskRemindersManual');
      console.log('   - パラメータ:', {
        userId: currentUser.uid,
        roomId,
        roomDocId,
        force: true,
      });

      console.log('🔍 [フロントエンド] Cloud Functions呼び出し開始...');
      const callable = httpsCallable(functions, 'sendDailyTaskRemindersManual');
      const result = (await callable({
        userId: currentUser.uid,
        roomId,
        roomDocId,
        force: true, // 通知時間チェックをスキップ
      })) as any;

      console.log('✅ [フロントエンド] Cloud Functions呼び出し完了');
      console.log('📊 [フロントエンド] 実行結果:', result.data);

      if (result.data?.success) {
        const results = result.data.results || [];

        // 詳細ログを出力
        console.log('📋 詳細結果:', results);
        results.forEach((r: any, index: number) => {
          console.log(`\n結果 ${index + 1}:`, {
            userId: r.userId,
            success: r.success,
            skipped: r.skipped,
            reason: r.reason,
            taskCount: r.taskCount,
            message: r.message,
            error: r.error,
            details: r.details,
            email: r.email,
          });
        });

        const successCount = results.filter((r: any) => r.success).length;
        const skippedCount = results.filter((r: any) => r.skipped).length;
        const errorCount = results.filter((r: any) => r.error).length;
        const taskCount = results.reduce(
          (sum: number, r: any) => sum + (r.taskCount || 0),
          0
        );

        const message = this.languageService.translateWithParams(
          'settings.dailyTestCompleted',
          {
            successCount: String(successCount),
            skippedCount: String(skippedCount),
            errorCount: String(errorCount),
            taskCount: String(taskCount),
          }
        );

        this.snackBar.open(message, this.getCloseLabel(), {
          duration: 10000,
        });
      } else {
        this.snackBar.open(
          this.languageService.translate('settings.dailyTestFailed'),
          this.getCloseLabel(),
          {
            duration: 3000,
          }
        );
      }
    } catch (error: any) {
      console.error('今日のタスク通知テストエラー:', error);
      this.snackBar.open(
        this.languageService.translateWithParams('settings.error', {
          error: error.message || '不明なエラー',
        }),
        this.getCloseLabel(),
        {
          duration: 5000,
        }
      );
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * ユーザー個別のタスク通知を手動送信（テスト用）
   */
  async sendUserTaskNotificationsTest(): Promise<void> {
    const roomId = this.authService.getCurrentRoomId();
    const roomDocId = this.authService.getCurrentRoomDocId();
    if (!roomId || !roomDocId) {
      this.snackBar.open(
        this.languageService.translate('settings.roomEnterRequired'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
      return;
    }

    this.isSaving = true;

    try {
      console.log('🔔 ユーザー個別のタスク通知をテスト送信');

      const { getFunctions, httpsCallable } = await import(
        'firebase/functions'
      );
      const { getApp } = await import('firebase/app');
      const functions = getFunctions(getApp(), 'us-central1');

      const callable = httpsCallable(
        functions,
        'sendUserTaskNotificationsManual'
      );
      const result = (await callable({ roomId, roomDocId })) as any;

      if (result.data?.success) {
        this.snackBar.open(
          this.languageService.translateWithParams(
            'settings.userNotificationSent',
            {
              taskCount: String(result.data.taskCount),
              userCount: String(result.data.userCount),
            }
          ),
          this.getCloseLabel(),
          { duration: 5000 }
        );
      } else {
        this.snackBar.open(
          this.languageService.translate('settings.userNotificationFailed'),
          this.getCloseLabel(),
          {
            duration: 3000,
          }
        );
      }
    } catch (error) {
      console.error('ユーザー個別のタスク通知テストエラー:', error);
      this.snackBar.open(
        this.languageService.translate('settings.userNotificationFailed'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
    } finally {
      this.isSaving = false;
    }
  }

  /** ホーム画面設定を読み込み */
  async loadHomeScreenSettings() {
    try {
      this.homeScreenSettingsService.getHomeScreenSettings()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
        next: (settings) => {
          if (settings) {
            this.homeScreenSettings = settings;
            this.selectedHomeScreen = settings.homeScreen;
          } else {
            this.selectedHomeScreen =
              this.homeScreenSettingsService.getDefaultHomeScreen();
          }
        },
        error: (error) => {
          console.error('ホーム画面設定の読み込みエラー:', error);
          this.selectedHomeScreen =
            this.homeScreenSettingsService.getDefaultHomeScreen();
        },
      });
    } catch (error) {
      console.error('ホーム画面設定の読み込みエラー:', error);
      this.selectedHomeScreen =
        this.homeScreenSettingsService.getDefaultHomeScreen();
    }
  }

  /** ホーム画面設定を保存 */
  async saveHomeScreenSettings() {
    this.isSaving = true;
    try {
      await this.homeScreenSettingsService.saveHomeScreenSettings(
        this.selectedHomeScreen
      );
      this.snackBar.open(
        this.languageService.translate('settings.homeScreenSaved'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
    } catch (error) {
      console.error('ホーム画面設定の保存エラー:', error);
      this.snackBar.open(
        this.languageService.translate('settings.homeScreenSaveFailed'),
        this.getCloseLabel(),
        {
          duration: 3000,
        }
      );
    } finally {
      this.isSaving = false;
    }
  }

  /** ホーム画面選択変更 */
  onHomeScreenChange() {
    // 即座に保存
    this.saveHomeScreenSettings();
  }

  getHomeScreenLabel(value: HomeScreenType): string {
    return this.languageService.translate(`homeScreen.${value}`);
  }

  /** 作業予定時間オーバー通知の説明文を取得 */
  getWorkTimeDescription(): string {
    const days =
      this.notificationSettings.workTimeOverflowNotifications.checkPeriodDays ||
      1;
    const hours =
      this.notificationSettings.workTimeOverflowNotifications.maxWorkHours || 0;
    return this.languageService.translateWithParams(
      'settings.worktime.description',
      {
        days: days.toString(),
        hours: hours.toString(),
      }
    );
  }

  /** ルーム情報を読み込み */
  async loadRoomInfo() {
    try {
      const roomId = this.authService.getCurrentRoomId();
      if (!roomId) {
        console.warn('ルームIDが設定されていません');
        return;
      }
      this.roomInfo = await this.roomService.getRoomInfo(roomId);
    } catch (error) {
      console.error('ルーム情報の読み込みエラー:', error);
    }
  }

  /** ルームを変更 */
  changeRoom() {
    // 現在のルームから退出（サインイン状態は維持）
    this.authService.clearRoomId();
    // プロジェクト選択状態もクリア
    this.projectSelectionService.clearSelection();
    // ルーム入室画面に遷移
    this.router.navigate(['/room-login']);
  }

  /** ルームを削除 */
  async deleteRoom() {
    if (!this.roomInfo) {
      return;
    }

    // 確認ダイアログを表示
    const dialogRef = this.dialog.open(RoomDeleteConfirmDialogComponent, {
      width: '500px',
      data: {
        roomName: this.roomInfo.name,
        roomId: this.roomInfo.roomId,
      },
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          const roomId = this.authService.getCurrentRoomId();
          if (!roomId) {
            this.snackBar.open(
              this.languageService.translate('settings.roomIdNotAvailable'),
              this.getCloseLabel(),
              {
                duration: 3000,
              }
            );
            return;
          }

          // ルーム内のすべてのプロジェクトを取得して削除
          const projects = await firstValueFrom(
            this.projectService.getProjects()
          );
          if (projects && projects.length > 0) {
            for (const project of projects) {
              if (project.id) {
                try {
                  // プロジェクトデータをそのまま使用（getProjectsで取得したデータ）
                  await this.projectService.deleteProject(project.id, project);
                } catch (error) {
                  console.error(
                    `プロジェクト「${project.projectName}」の削除エラー:`,
                    error
                  );
                }
              }
            }
          }

          // ルーム内のすべてのメンバーを削除
          try {
            await this.memberManagementService.deleteAllMembersInRoom(roomId);
            console.log('✅ ルーム内のすべてのメンバーを削除しました');
          } catch (error) {
            console.error('メンバー削除エラー:', error);
            // エラーが発生しても続行
          }

          // ルーム内のすべての編集ログを削除
          try {
            await this.editLogService.deleteAllEditLogsInRoom(roomId);
            console.log('✅ ルーム内のすべての編集ログを削除しました');
          } catch (error) {
            console.error('編集ログ削除エラー:', error);
            // エラーが発生しても続行
          }

          // ルームを削除
          await this.roomService.deleteRoom(roomId);

          // ルーム情報をクリア
          this.authService.clearRoomId();
          this.projectSelectionService.clearSelection();

          this.snackBar.open(
            this.languageService.translate('settings.roomDeleted'),
            this.getCloseLabel(),
            {
              duration: 3000,
            }
          );

          // ルーム入室画面に遷移
          this.router.navigate(['/room-login']);
        } catch (error) {
          console.error('ルーム削除エラー:', error);
          this.snackBar.open(
            this.languageService.translate('settings.roomDeleteFailed'),
            this.getCloseLabel(),
            {
              duration: 5000,
            }
          );
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
