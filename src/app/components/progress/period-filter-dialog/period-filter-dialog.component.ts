import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-period-filter-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    FormsModule,
    MatDialogModule,
  ],
  styleUrls: ['./period-filter-dialog.component.css'],
  template: `
    <h2 mat-dialog-title>期間を選択</h2>
    <mat-dialog-content>
      <div class="period-dialog-content">
        <div class="date-field">
          <label for="startDate">開始日</label>
          <input
            id="startDate"
            type="date"
            [(ngModel)]="startDate"
            (ngModelChange)="onStartDateChange($event)"
            [max]="endDate || '9999-12-31'"
            max="9999-12-31"
          />
        </div>
        <div class="date-field">
          <label for="endDate">終了日</label>
          <input
            id="endDate"
            type="date"
            [(ngModel)]="endDate"
            (ngModelChange)="onEndDateChange($event)"
            [min]="startDate || undefined"
            max="9999-12-31"
          />
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button (click)="onCancel()">キャンセル</button>
      <button
        mat-raised-button
        color="primary"
        (click)="onConfirm()"
        [disabled]="isConfirmDisabled()"
      >
        確定
      </button>
    </mat-dialog-actions>
  `,
})
export class PeriodFilterDialogComponent {
  startDate: string | null = null;
  endDate: string | null = null;

  constructor(
    private dialogRef: MatDialogRef<PeriodFilterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data) {
      this.startDate = data.startDate
        ? this.formatDateToString(data.startDate)
        : null;
      this.endDate = data.endDate
        ? this.formatDateToString(data.endDate)
        : null;
    }
  }

  onConfirm() {
    const normalizedStartDate = this.normalizeDateInput(this.startDate);
    const normalizedEndDate = this.normalizeDateInput(this.endDate);

    this.dialogRef.close({
      startDate: normalizedStartDate ? new Date(normalizedStartDate) : null,
      endDate: normalizedEndDate ? new Date(normalizedEndDate) : null,
    });
  }

  onCancel() {
    this.dialogRef.close();
  }

  onStartDateChange(value: string | null) {
    this.startDate = value;
    // 開始日が終了日より後になった場合、終了日を開始日と同じにする
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      if (start > end) {
        this.endDate = this.startDate;
      }
    }
  }

  onEndDateChange(value: string | null) {
    this.endDate = value;
    // 終了日が開始日より前になった場合、開始日を終了日と同じにする
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      if (end < start) {
        this.startDate = this.endDate;
      }
    }
  }

  isConfirmDisabled(): boolean {
    const normalizedStartDate = this.normalizeDateInput(this.startDate);
    const normalizedEndDate = this.normalizeDateInput(this.endDate);
    if (normalizedStartDate && normalizedEndDate) {
      return new Date(normalizedStartDate) > new Date(normalizedEndDate);
    }
    return false;
  }

  private formatDateToString(date: Date): string {
    if (!(date instanceof Date)) date = new Date(date);
    return date.toISOString().split('T')[0];
  }

  private normalizeDateInput(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
}
