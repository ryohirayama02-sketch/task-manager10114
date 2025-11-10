import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface RoomDeleteConfirmDialogData {
  roomName: string;
  roomId: string;
}

@Component({
  selector: 'app-room-delete-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="room-delete-confirm-dialog">
      <div class="dialog-header">
        <mat-icon class="warning-icon">warning</mat-icon>
        <h2>ルームを削除</h2>
      </div>

      <div class="dialog-content">
        <p class="warning-message">
          本当にルーム「<strong>{{ data.roomName }}</strong>」を削除しますか？
        </p>
        <p class="warning-detail">
          この操作は取り消せません。ルームに関連するすべてのデータ（プロジェクト、タスク、メンバーなど）が削除されます。
        </p>
      </div>

      <div class="dialog-actions">
        <button
          mat-button
          type="button"
          (click)="onCancel()"
          class="cancel-button"
        >
          キャンセル
        </button>
        <button
          mat-raised-button
          type="button"
          color="warn"
          (click)="onConfirm()"
          class="confirm-button"
        >
          <mat-icon>delete</mat-icon>
          削除
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .room-delete-confirm-dialog {
        display: flex;
        flex-direction: column;
        min-width: 400px;
        max-width: 500px;
      }

      .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px 24px 0;
        border-bottom: 1px solid #e0e0e0;
      }

      .warning-icon {
        color: #d32f2f;
        font-size: 32px;
        width: 32px;
        height: 32px;
      }

      .dialog-header h2 {
        margin: 0;
        color: #333;
        font-size: 24px;
        font-weight: 500;
      }

      .dialog-content {
        padding: 24px;
      }

      .warning-message {
        font-size: 16px;
        color: #333;
        margin-bottom: 16px;
        line-height: 1.6;
      }

      .warning-message strong {
        color: #d32f2f;
      }

      .warning-detail {
        font-size: 14px;
        color: #666;
        line-height: 1.6;
        background-color: #fff3cd;
        padding: 12px;
        border-radius: 4px;
        border-left: 4px solid #ffc107;
      }

      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 24px 24px;
        border-top: 1px solid #e0e0e0;
      }

      .cancel-button {
        color: #666;
      }

      .confirm-button {
        background-color: #d32f2f;
        color: white;
      }

      .confirm-button:hover {
        background-color: #b71c1c;
      }
    `,
  ],
})
export class RoomDeleteConfirmDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<RoomDeleteConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RoomDeleteConfirmDialogData
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}

