import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { OfflineService } from '../../services/offline.service';

@Component({
  selector: 'app-offline-test',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  template: `
    <mat-card class="offline-test-card">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>wifi</mat-icon>
          オフライン機能テスト
        </mat-card-title>
        <mat-card-subtitle>
          現在の状態:
          <span [class]="isOnline ? 'online-status' : 'offline-status'">
            {{ isOnline ? 'オンライン' : 'オフライン' }}
          </span>
        </mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <div class="test-instructions">
          <h4>テスト手順:</h4>
          <ol>
            <li>「オフラインモードに切り替え」ボタンをクリック</li>
            <li>タスクの編集・作成を試す</li>
            <li>「オンラインモードに切り替え」ボタンをクリック</li>
            <li>変更が自動同期されることを確認</li>
          </ol>
        </div>

        <div class="test-buttons">
          <button
            mat-raised-button
            color="warn"
            (click)="setOfflineMode()"
            [disabled]="!isOnline"
          >
            <mat-icon>wifi_off</mat-icon>
            オフラインモードに切り替え
          </button>

          <button
            mat-raised-button
            color="primary"
            (click)="setOnlineMode()"
            [disabled]="isOnline"
          >
            <mat-icon>wifi</mat-icon>
            オンラインモードに切り替え
          </button>
        </div>

        <div class="test-info">
          <p><strong>注意:</strong> このテスト機能は開発・検証用です。</p>
          <p>
            実際のオフライン状態は、ブラウザのネットワーク設定やWiFiの切断で確認できます。
          </p>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .offline-test-card {
        margin: 20px;
        max-width: 600px;
      }

      .online-status {
        color: #4caf50;
        font-weight: bold;
      }

      .offline-status {
        color: #ff9800;
        font-weight: bold;
      }

      .test-instructions {
        margin: 16px 0;
      }

      .test-instructions h4 {
        margin: 0 0 8px 0;
        color: #333;
      }

      .test-instructions ol {
        margin: 8px 0;
        padding-left: 20px;
      }

      .test-instructions li {
        margin: 4px 0;
      }

      .test-buttons {
        display: flex;
        gap: 16px;
        margin: 20px 0;
        flex-wrap: wrap;
      }

      .test-buttons button {
        flex: 1;
        min-width: 200px;
      }

      .test-info {
        background-color: #f5f5f5;
        padding: 12px;
        border-radius: 4px;
        margin-top: 16px;
      }

      .test-info p {
        margin: 4px 0;
        font-size: 14px;
        color: #666;
      }
    `,
  ],
})
export class OfflineTestComponent implements OnInit, OnDestroy {
  isOnline = true;
  private destroy$ = new Subject<void>();

  constructor(
    private offlineService: OfflineService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.offlineService.isOnline$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isOnline) => {
        this.isOnline = isOnline;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async setOfflineMode(): Promise<void> {
    await this.offlineService.setOfflineMode();
    this.snackBar.open('オフラインモードに切り替えました', '閉じる', {
      duration: 2000,
    });
  }

  async setOnlineMode(): Promise<void> {
    await this.offlineService.setOnlineMode();
    this.snackBar.open('オンラインモードに切り替えました', '閉じる', {
      duration: 2000,
    });
  }
}
