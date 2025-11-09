import { Component, OnInit, inject } from '@angular/core';
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
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { TaskReminderService } from '../../services/task-reminder.service';
import { HomeScreenSettingsService } from '../../services/home-screen-settings.service';
import { RoomService } from '../../services/room.service';
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
    TranslatePipe,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit {
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
  quietStartTime = { hour: '22', minute: '00' };
  quietEndTime = { hour: '08', minute: '00' };
  workTimeOverflowTime = { hour: '09', minute: '00' };
  dailyReminderTime = { hour: '09', minute: '00' };
  
  workTimeOptions = [20, 30, 40, 50, 60, 80];
  checkPeriodOptions = [1, 3, 7, 14, 30];

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
    private taskReminderService: TaskReminderService,
    private homeScreenSettingsService: HomeScreenSettingsService,
    private roomService: RoomService,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    const roomId = this.authService.getCurrentRoomId();
    const roomDocId = this.authService.getCurrentRoomDocId();
    if (!roomId || !roomDocId) {
      this.snackBar.open('ルームに入室してください', this.getCloseLabel(), {
        duration: 3000,
      });
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
        // quietHoursが存在しない場合は初期化
        if (!this.notificationSettings.quietHours) {
          this.notificationSettings.quietHours = {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            weekends: true,
          };
        }
        // enabledがundefinedの場合はfalseに設定
        if (this.notificationSettings.quietHours.enabled === undefined) {
          this.notificationSettings.quietHours.enabled = false;
        }
        
        // 時間を{ hour, minute }形式に変換
        this.taskDeadlineTime = this.parseTimeString(
          this.notificationSettings.taskDeadlineNotifications.timeOfDay || '09:00'
        );
        this.quietStartTime = this.parseTimeString(
          this.notificationSettings.quietHours.startTime || '22:00'
        );
        this.quietEndTime = this.parseTimeString(
          this.notificationSettings.quietHours.endTime || '08:00'
        );
        this.workTimeOverflowTime = this.parseTimeString(
          this.notificationSettings.workTimeOverflowNotifications.timeOfDay || '09:00'
        );
        this.dailyReminderTime = this.parseTimeString(
          this.notificationSettings.dailyDeadlineReminder.timeOfDay || '09:00'
        );
        
        // デバッグ: 読み込んだ設定を確認
        console.log('📋 通知設定を読み込みました:', {
          quietHours: this.notificationSettings.quietHours,
          quietHoursEnabled: this.notificationSettings.quietHours?.enabled,
        });
      } else {
        // デフォルト設定を作成
        this.notificationSettings =
          this.notificationService.createDefaultNotificationSettings();
        console.log('📋 デフォルト通知設定を作成:', {
          quietHours: this.notificationSettings.quietHours,
          quietHoursEnabled: this.notificationSettings.quietHours?.enabled,
        });
      }

      // 選択された日数を設定
      this.selectedDeadlineDays =
        this.notificationSettings.taskDeadlineNotifications.daysBeforeDeadline;
    } catch (error) {
      console.error('通知設定の読み込みエラー:', error);
      console.error('エラーの詳細:', error);
      this.snackBar.open(
        `設定の読み込みに失敗しました: ${error}`,
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
  onQuietHoursEnabledChange(event: any): void {
    // 値を明示的に設定
    this.notificationSettings.quietHours.enabled = event.checked;
    console.log('🔔 通知オフ期間のON/OFF変更:', {
      checked: event.checked,
      quietHoursEnabled: this.notificationSettings.quietHours.enabled,
    });
  }

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

  /** 通知設定を保存 */
  async saveNotificationSettings() {
    if (!this.notificationSettings) return;

    this.isSaving = true;
    try {
      // 選択された日数を設定に反映
      this.notificationSettings.taskDeadlineNotifications.daysBeforeDeadline =
        this.selectedDeadlineDays;

      // 時間を文字列形式に変換して設定に反映
      this.notificationSettings.taskDeadlineNotifications.timeOfDay =
        this.formatTimeString(this.taskDeadlineTime);
      this.notificationSettings.quietHours.startTime =
        this.formatTimeString(this.quietStartTime);
      this.notificationSettings.quietHours.endTime =
        this.formatTimeString(this.quietEndTime);
      this.notificationSettings.workTimeOverflowNotifications.timeOfDay =
        this.formatTimeString(this.workTimeOverflowTime);
      this.notificationSettings.dailyDeadlineReminder.timeOfDay =
        this.formatTimeString(this.dailyReminderTime);

      // デバッグ: 保存前の値を確認
      console.log('💾 保存前の通知設定:', {
        quietHours: this.notificationSettings.quietHours,
        quietHoursEnabled: this.notificationSettings.quietHours?.enabled,
      });

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
            'メールアドレスを入力してください',
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
            '有効なメールアドレスを入力してください',
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
            'テスト通知を送信しました ✅',
            this.getCloseLabel(),
            {
              duration: 3000,
            }
          );
        } else {
          this.snackBar.open(
            'テスト通知の送信に失敗しました',
            this.getCloseLabel(),
            {
              duration: 3000,
            }
          );
        }
      } else {
        this.snackBar.open(
          'メール通知を有効にしてください',
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
        `テスト通知の送信に失敗しました: ${errorMessage}`,
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
      this.snackBar.open('ルームに入室してください', this.getCloseLabel(), {
        duration: 3000,
      });
      return;
    }

    this.isSaving = true;

    try {
      console.log('🔔 期限が近いタスクのメール通知をテスト送信');

      const result = await this.taskReminderService.sendTaskReminders();

      if (result.success) {
        this.snackBar.open(
          `期限が近いタスクのメール通知を送信しました (${result.taskCount}件のタスク、${result.userCount}人のユーザー)`,
          this.getCloseLabel(),
          { duration: 5000 }
        );
      } else {
        this.snackBar.open(
          'メール通知の送信に失敗しました',
          this.getCloseLabel(),
          {
            duration: 3000,
          }
        );
      }
    } catch (error) {
      console.error('期限が近いタスクのメール通知テストエラー:', error);
      this.snackBar.open(
        'メール通知の送信に失敗しました',
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
      this.snackBar.open('ログインしてください', this.getCloseLabel(), {
        duration: 3000,
      });
      return;
    }

    const roomId = this.authService.getCurrentRoomId();
    const roomDocId = this.authService.getCurrentRoomDocId();
    if (!roomId || !roomDocId) {
      this.snackBar.open('ルームに入室してください', this.getCloseLabel(), {
        duration: 3000,
      });
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

        let message = `タスク期限通知のテスト実行が完了しました\n`;
        message += `成功: ${successCount}件、スキップ: ${skippedCount}件、エラー: ${errorCount}件\n`;
        message += `対象タスク: ${taskCount}件\n`;
        message += `詳細はコンソールを確認してください`;

        this.snackBar.open(message, this.getCloseLabel(), {
          duration: 10000,
        });
      } else {
        this.snackBar.open(
          'タスク期限通知のテスト実行に失敗しました',
          this.getCloseLabel(),
          {
            duration: 3000,
          }
        );
      }
    } catch (error: any) {
      console.error('タスク期限通知テストエラー:', error);
      this.snackBar.open(
        `エラー: ${error.message || '不明なエラー'}`,
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
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.snackBar.open('ログインしてください', this.getCloseLabel(), {
        duration: 3000,
      });
      return;
    }

    const roomId = this.authService.getCurrentRoomId();
    const roomDocId = this.authService.getCurrentRoomDocId();
    if (!roomId || !roomDocId) {
      this.snackBar.open('ルームに入室してください', this.getCloseLabel(), {
        duration: 3000,
      });
      return;
    }

    this.isSaving = true;

    try {
      console.log('🔔 作業時間オーバー通知をテスト送信');

      const { getFunctions, httpsCallable } = await import(
        'firebase/functions'
      );
      const { getApp } = await import('firebase/app');
      const functions = getFunctions(getApp(), 'us-central1');

      const callable = httpsCallable(
        functions,
        'sendWorkTimeOverflowNotificationsManual'
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
            overflowUserCount: r.overflowUserCount,
            notificationCount: r.notificationCount,
            message: r.message,
            error: r.error,
          });
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

        let message = `作業時間オーバー通知のテスト実行が完了しました\n`;
        message += `成功: ${successCount}件、スキップ: ${skippedCount}件、エラー: ${errorCount}件\n`;
        message += `作業時間オーバーユーザー: ${overflowUserCount}人\n`;
        message += `送信通知数: ${notificationCount}件\n`;
        message += `詳細はコンソールを確認してください`;

        this.snackBar.open(message, this.getCloseLabel(), {
          duration: 10000,
        });
      } else {
        this.snackBar.open(
          '作業時間オーバー通知のテスト実行に失敗しました',
          this.getCloseLabel(),
          {
            duration: 3000,
          }
        );
      }
    } catch (error: any) {
      console.error('作業時間オーバー通知テストエラー:', error);
      this.snackBar.open(
        `エラー: ${error.message || '不明なエラー'}`,
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
   * 今日のタスク通知を手動送信（テスト用・デバッグ用）
   */
  async sendDailyTaskRemindersTest(): Promise<void> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.snackBar.open('ログインしてください', this.getCloseLabel(), {
        duration: 3000,
      });
      return;
    }

    const roomId = this.authService.getCurrentRoomId();
    const roomDocId = this.authService.getCurrentRoomDocId();
    if (!roomId || !roomDocId) {
      this.snackBar.open('ルームに入室してください', this.getCloseLabel(), {
        duration: 3000,
      });
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

        let message = `今日のタスク通知のテスト実行が完了しました\n`;
        message += `成功: ${successCount}件、スキップ: ${skippedCount}件、エラー: ${errorCount}件\n`;
        message += `通知タスク数: ${taskCount}件\n`;
        message += `詳細はコンソールを確認してください`;

        this.snackBar.open(message, this.getCloseLabel(), {
          duration: 10000,
        });
      } else {
        this.snackBar.open(
          '今日のタスク通知のテスト実行に失敗しました',
          this.getCloseLabel(),
          {
            duration: 3000,
          }
        );
      }
    } catch (error: any) {
      console.error('今日のタスク通知テストエラー:', error);
      this.snackBar.open(
        `エラー: ${error.message || '不明なエラー'}`,
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
      this.snackBar.open('ルームに入室してください', this.getCloseLabel(), {
        duration: 3000,
      });
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
          `ユーザー個別のタスク通知を送信しました (${result.data.taskCount}件のタスク、${result.data.userCount}人のユーザー)`,
          this.getCloseLabel(),
          { duration: 5000 }
        );
      } else {
        this.snackBar.open(
          'ユーザー個別のタスク通知の送信に失敗しました',
          this.getCloseLabel(),
          {
            duration: 3000,
          }
        );
      }
    } catch (error) {
      console.error('ユーザー個別のタスク通知テストエラー:', error);
      this.snackBar.open(
        'ユーザー個別のタスク通知の送信に失敗しました',
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
      this.homeScreenSettingsService.getHomeScreenSettings().subscribe({
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
      this.snackBar.open('ホーム画面設定を保存しました', this.getCloseLabel(), {
        duration: 3000,
      });
    } catch (error) {
      console.error('ホーム画面設定の保存エラー:', error);
      this.snackBar.open(
        'ホーム画面設定の保存に失敗しました',
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
}
