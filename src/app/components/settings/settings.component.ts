import { Component, OnInit } from '@angular/core';
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
import { NotificationSettings } from '../../models/notification.model';

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
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit {
  notificationSettings!: NotificationSettings; // 非null assertion
  isLoading = false;
  isSaving = false;
  showNotificationSettings = true; // デフォルトで通知設定を表示

  // 通知日数オプション
  deadlineNotificationDays = [1, 2, 3, 5, 7, 14, 30];
  selectedDeadlineDays: number[] = [1, 3, 7];

  // 時間オプション
  timeOptions: string[] = [];
  workTimeOptions = [20, 30, 40, 50, 60, 80];
  checkPeriodOptions = [1, 3, 7, 14, 30];

  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
    private taskReminderService: TaskReminderService,
    private snackBar: MatSnackBar
  ) {
    // 時間オプションを生成（00:00 - 23:30）
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute
          .toString()
          .padStart(2, '0')}`;
        this.timeOptions.push(timeStr);
      }
    }
  }

  async ngOnInit() {
    // デフォルト設定を初期化
    this.notificationSettings =
      this.notificationService.createDefaultNotificationSettings();
    await this.loadNotificationSettings();
  }

  /** 通知設定を読み込み */
  async loadNotificationSettings() {
    this.isLoading = true;
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        this.snackBar.open('ログインが必要です', '閉じる', { duration: 3000 });
        return;
      }

      const loadedSettings =
        await this.notificationService.getNotificationSettings(currentUser.uid);

      if (loadedSettings) {
        this.notificationSettings = loadedSettings;
      } else {
        // デフォルト設定を作成
        this.notificationSettings =
          this.notificationService.createDefaultNotificationSettings();
      }

      // 選択された日数を設定
      this.selectedDeadlineDays =
        this.notificationSettings.taskDeadlineNotifications.daysBeforeDeadline;
    } catch (error) {
      console.error('通知設定の読み込みエラー:', error);
      console.error('エラーの詳細:', error);
      this.snackBar.open(`設定の読み込みに失敗しました: ${error}`, '閉じる', {
        duration: 5000,
      });
    } finally {
      this.isLoading = false;
    }
  }

  /** 通知設定を保存 */
  async saveNotificationSettings() {
    if (!this.notificationSettings) return;

    this.isSaving = true;
    try {
      // 選択された日数を設定に反映
      this.notificationSettings.taskDeadlineNotifications.daysBeforeDeadline =
        this.selectedDeadlineDays;

      await this.notificationService.saveNotificationSettings(
        this.notificationSettings
      );
      this.snackBar.open('通知設定を保存しました', '閉じる', {
        duration: 3000,
      });
    } catch (error) {
      console.error('通知設定の保存エラー:', error);
      this.snackBar.open('設定の保存に失敗しました', '閉じる', {
        duration: 3000,
      });
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
          this.snackBar.open('メールアドレスを入力してください', '閉じる', {
            duration: 3000,
          });
          return;
        }

        console.log('メールアドレス:', emailAddress);

        // メールアドレスの検証
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailAddress)) {
          this.snackBar.open(
            '有効なメールアドレスを入力してください',
            '閉じる',
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

        // Functions側の戻り値が { success: true, message: "..." } の想定
        const data = (result as any)?.data ?? result; // onCallの戻りを安全に取得
        if (data?.success) {
          this.snackBar.open(
            data.message || 'テスト通知を送信しました ✅',
            '閉じる',
            {
              duration: 3000,
            }
          );
        } else {
          this.snackBar.open('テスト通知の送信に失敗しました', '閉じる', {
            duration: 3000,
          });
        }
      } else {
        this.snackBar.open('メール通知を有効にしてください', '閉じる', {
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('テスト通知エラー:', error);
      this.snackBar.open('テスト通知の送信に失敗しました', '閉じる', {
        duration: 3000,
      });
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * 期限が近いタスクのメール通知を手動送信（テスト用）
   */
  async sendTaskRemindersTest(): Promise<void> {
    this.isSaving = true;

    try {
      console.log('🔔 期限が近いタスクのメール通知をテスト送信');

      const result = await this.taskReminderService.sendTaskReminders();

      if (result.success) {
        this.snackBar.open(
          `期限が近いタスクのメール通知を送信しました (${result.taskCount}件のタスク、${result.userCount}人のユーザー)`,
          '閉じる',
          { duration: 5000 }
        );
      } else {
        this.snackBar.open('メール通知の送信に失敗しました', '閉じる', {
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('期限が近いタスクのメール通知テストエラー:', error);
      this.snackBar.open('メール通知の送信に失敗しました', '閉じる', {
        duration: 3000,
      });
    } finally {
      this.isSaving = false;
    }
  }
}
