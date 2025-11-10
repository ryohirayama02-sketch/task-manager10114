import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface TaskDeleteConfirmDialogData {
  taskName: string;
  taskId: string;
  childTasksCount?: number;
}

@Component({
  selector: 'app-task-delete-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="delete-confirm-dialog">
      <div class="dialog-header">
        <mat-icon class="warning-icon">warning</mat-icon>
        <h2>タスク削除の確認</h2>
      </div>

      <div class="dialog-content">
        <p>以下のタスクを削除しますか？</p>
        <div class="task-info">
          <strong>{{ data.taskName }}</strong>
        </div>
        <div class="warning-message" *ngIf="data.childTasksCount && data.childTasksCount > 0">
          <mat-icon>warning</mat-icon>
          <span
            >このタスクに紐づく{{ data.childTasksCount }}件の子タスクも一緒に削除されます。</span
          >
        </div>
        <div class="warning-message">
          <mat-icon>info</mat-icon>
          <span
            >この操作は取り消せません。タスクに関連するすべてのデータが削除されます。</span
          >
        </div>
      </div>

      <div class="dialog-actions">
        <button mat-button (click)="onCancel()" class="cancel-button">
          キャンセル
        </button>
        <button
          mat-raised-button
          color="warn"
          (click)="onConfirm()"
          class="confirm-button"
        >
          <mat-icon>delete</mat-icon>
          削除する
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .delete-confirm-dialog {
        padding: 24px;
        max-width: 400px;
      }

      .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
      }

      .warning-icon {
        color: #f44336;
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      .dialog-header h2 {
        margin: 0;
        color: #333;
        font-size: 20px;
        font-weight: 500;
      }

      .dialog-content {
        margin-bottom: 24px;
      }

      .dialog-content p {
        margin: 0 0 16px 0;
        color: #666;
        font-size: 16px;
      }

      .task-info {
        background-color: #f5f5f5;
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        border-left: 4px solid #2196f3;
      }

      .task-info strong {
        color: #333;
        font-size: 16px;
      }

      .warning-message {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        background-color: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 8px;
        padding: 12px;
        color: #856404;
      }

      .warning-message mat-icon {
        color: #f39c12;
        font-size: 20px;
        width: 20px;
        height: 20px;
        margin-top: 2px;
      }

      .warning-message span {
        font-size: 14px;
        line-height: 1.4;
      }

      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      .cancel-button {
        color: #666;
      }

      .confirm-button {
        background-color: #f44336;
        color: white;
      }

      .confirm-button:hover {
        background-color: #d32f2f;
      }

      /* ダークモード対応 */
      @media (prefers-color-scheme: dark) {
        .dialog-header h2 {
          color: #fff;
        }

        .dialog-content p {
          color: #ccc;
        }

        .task-info {
          background-color: #2a2a2a;
          border-left-color: #2196f3;
        }

        .task-info strong {
          color: #fff;
        }

        .warning-message {
          background-color: #3d2f00;
          border-color: #6b4c00;
          color: #ffc107;
        }

        .cancel-button {
          color: #ccc;
        }
      }
    `,
  ],
})
export class TaskDeleteConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<TaskDeleteConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TaskDeleteConfirmDialogData
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
