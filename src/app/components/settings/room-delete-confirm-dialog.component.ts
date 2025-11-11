import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

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
    TranslatePipe,
  ],
  template: `
    <div class="room-delete-confirm-dialog">
      <div class="dialog-header">
        <mat-icon class="warning-icon">warning</mat-icon>
        <h2>{{ 'settings.deleteRoomTitle' | translate }}</h2>
      </div>

      <div class="dialog-content">
        <p class="warning-message" [innerHTML]="getDeleteConfirmMessage()"></p>
        <p class="warning-detail">
          {{ 'settings.deleteRoomWarning' | translate }}
        </p>
      </div>

      <div class="dialog-actions">
        <button
          mat-button
          type="button"
          (click)="onCancel()"
          class="cancel-button"
        >
          {{ 'settings.cancel' | translate }}
        </button>
        <button
          mat-raised-button
          type="button"
          color="warn"
          (click)="onConfirm()"
          class="confirm-button"
        >
          <mat-icon>delete</mat-icon>
          {{ 'settings.delete' | translate }}
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
  languageService = inject(LanguageService);

  constructor(
    private dialogRef: MatDialogRef<RoomDeleteConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RoomDeleteConfirmDialogData
  ) {}

  getDeleteConfirmMessage(): string {
    const message = this.languageService.translateWithParams('settings.deleteRoomConfirm', {
      roomName: this.data.roomName,
    });
    // ルーム名を強調表示
    return message.replace(
      `"${this.data.roomName}"`,
      `<strong>"${this.data.roomName}"</strong>`
    );
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}

