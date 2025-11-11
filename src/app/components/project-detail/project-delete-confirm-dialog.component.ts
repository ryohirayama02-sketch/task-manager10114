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

export interface ProjectDeleteConfirmDialogData {
  projectName: string;
  projectId: string;
  tasksCount?: number;
}

@Component({
  selector: 'app-project-delete-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    <div class="delete-confirm-dialog">
      <div class="dialog-header">
        <mat-icon class="warning-icon">warning</mat-icon>
        <h2>{{ 'projectDetail.deleteConfirm.title' | translate }}</h2>
      </div>

      <div class="dialog-content">
        <p>{{ 'projectDetail.deleteConfirm.message' | translate }}</p>
        <div class="project-info">
          <strong>{{ data.projectName }}</strong>
        </div>
        <div class="warning-message" *ngIf="data.tasksCount && data.tasksCount > 0">
          <mat-icon>warning</mat-icon>
          <span>{{ getTasksWarning() }}</span>
        </div>
        <div class="warning-message">
          <mat-icon>info</mat-icon>
          <span>{{ 'projectDetail.deleteConfirm.irreversibleWarning' | translate }}</span>
        </div>
      </div>

      <div class="dialog-actions">
        <button mat-button (click)="onCancel()" class="cancel-button">
          {{ 'projectDetail.deleteConfirm.cancel' | translate }}
        </button>
        <button
          mat-raised-button
          color="warn"
          (click)="onConfirm()"
          class="confirm-button"
        >
          <mat-icon>delete</mat-icon>
          {{ 'projectDetail.deleteConfirm.delete' | translate }}
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

      .project-info {
        background-color: #f5f5f5;
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        border-left: 4px solid #2196f3;
      }

      .project-info strong {
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

        .project-info {
          background-color: #2a2a2a;
          border-left-color: #2196f3;
        }

        .project-info strong {
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
export class ProjectDeleteConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ProjectDeleteConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProjectDeleteConfirmDialogData,
    private languageService: LanguageService
  ) {}

  getTasksWarning(): string {
    return this.languageService.translateWithParams(
      'projectDetail.deleteConfirm.tasksWarning',
      { count: (this.data.tasksCount || 0).toString() }
    );
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
