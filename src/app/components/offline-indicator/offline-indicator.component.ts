import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { OfflineService } from '../../services/offline.service';

@Component({
  selector: 'app-offline-indicator',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatSnackBarModule],
  template: `
    <div *ngIf="!isOnline" class="offline-indicator">
      <mat-icon>wifi_off</mat-icon>
      <span>オフラインモード</span>
      <span class="offline-message">変更は自動的に同期されます</span>
    </div>
  `,
  styles: [
    `
      .offline-indicator {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background-color: #ff9800;
        color: white;
        padding: 8px 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 1000;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .offline-indicator mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .offline-message {
        font-size: 12px;
        opacity: 0.9;
        margin-left: auto;
      }
    `,
  ],
})
export class OfflineIndicatorComponent implements OnInit, OnDestroy {
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
        const wasOffline = !this.isOnline;
        this.isOnline = isOnline;

        if (wasOffline && isOnline) {
          // オフラインからオンラインに復帰
          this.snackBar.open(
            'オンラインに復帰しました。データを同期中...',
            '閉じる',
            {
              duration: 3000,
              panelClass: ['success-snackbar'],
            }
          );
        } else if (!wasOffline && !isOnline) {
          // オンラインからオフラインに移行
          this.snackBar.open(
            'オフラインモードになりました。変更は自動的に同期されます。',
            '閉じる',
            {
              duration: 5000,
              panelClass: ['warning-snackbar'],
            }
          );
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
