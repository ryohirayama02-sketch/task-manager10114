import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

export interface MemberRemoveConfirmDialogData {
  memberName: string;
  memberId: string;
  affectedTasksCount?: number;
  tasksToDeleteCount?: number;
}

@Component({
  selector: 'app-member-remove-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    <div class="member-remove-confirm-dialog">
      <div class="dialog-header">
        <mat-icon class="warning-icon">warning</mat-icon>
        <h2>{{ 'projectDetail.memberRemoveConfirm.title' | translate }}</h2>
      </div>

      <div class="dialog-content">
        <p>{{ 'projectDetail.memberRemoveConfirm.message' | translate }}</p>
        <div class="member-info">
          <strong>{{ data.memberName }}</strong>
        </div>
        <div class="warning-message" *ngIf="data.affectedTasksCount && data.affectedTasksCount > 0">
          <mat-icon>info</mat-icon>
          <span>{{ getAffectedTasksWarning() }}</span>
        </div>
        <div class="warning-message" *ngIf="data.tasksToDeleteCount && data.tasksToDeleteCount > 0">
          <mat-icon>delete</mat-icon>
          <span>{{ getTasksToDeleteWarning() }}</span>
        </div>
        <div class="warning-message">
          <mat-icon>info</mat-icon>
          <span>{{ 'projectDetail.memberRemoveConfirm.irreversibleWarning' | translate }}</span>
        </div>
      </div>

      <div class="dialog-actions">
        <button mat-button (click)="onCancel()" class="cancel-button">
          {{ 'projectDetail.memberRemoveConfirm.cancel' | translate }}
        </button>
        <button
          mat-raised-button
          color="warn"
          (click)="onConfirm()"
          class="confirm-button"
        >
          <mat-icon>person_remove</mat-icon>
          {{ 'projectDetail.memberRemoveConfirm.remove' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .member-remove-confirm-dialog {
        padding: 24px;
        max-width: 500px;
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

      .member-info {
        background-color: #f5f5f5;
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        border-left: 4px solid #2196f3;
      }

      .member-info strong {
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
        margin-bottom: 12px;
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

        .member-info {
          background-color: #2a2a2a;
          border-left-color: #2196f3;
        }

        .member-info strong {
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
export class MemberRemoveConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<MemberRemoveConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MemberRemoveConfirmDialogData,
    private languageService: LanguageService
  ) {}

  getAffectedTasksWarning(): string {
    return this.languageService.translateWithParams(
      'projectDetail.memberRemoveConfirm.affectedTasksWarning',
      { count: (this.data.affectedTasksCount || 0).toString() }
    );
  }

  getTasksToDeleteWarning(): string {
    return this.languageService.translateWithParams(
      'projectDetail.memberRemoveConfirm.tasksToDeleteWarning',
      { count: (this.data.tasksToDeleteCount || 0).toString() }
    );
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}

