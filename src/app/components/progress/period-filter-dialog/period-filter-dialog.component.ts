import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../../services/language.service';
import { TranslatePipe } from '../../../pipes/translate.pipe';

@Component({
  selector: 'app-period-filter-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    FormsModule,
    MatDialogModule,
    TranslatePipe,
  ],
  templateUrl: './period-filter-dialog.component.html',
  styleUrls: ['./period-filter-dialog.component.css'],
})
export class PeriodFilterDialogComponent {
  startDateObj: Date | null = null;
  endDateObj: Date | null = null;
  maxDate = new Date(9999, 11, 31); // 9999-12-31

  constructor(
    private dialogRef: MatDialogRef<PeriodFilterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data) {
      this.startDateObj = data.startDate
        ? new Date(data.startDate)
        : null;
      this.endDateObj = data.endDate
        ? new Date(data.endDate)
        : null;
    }
  }

  onConfirm() {
    this.dialogRef.close({
      startDate: this.startDateObj,
      endDate: this.endDateObj,
    });
  }

  onCancel() {
    this.dialogRef.close();
  }

  onStartDateChange() {
    // 開始日が終了日より後になった場合、終了日を開始日と同じにする
    if (this.startDateObj && this.endDateObj) {
      if (this.startDateObj > this.endDateObj) {
        this.endDateObj = new Date(this.startDateObj);
      }
    }
  }

  onEndDateChange() {
    // 終了日が開始日より前になった場合、開始日を終了日と同じにする
    if (this.startDateObj && this.endDateObj) {
      if (this.endDateObj < this.startDateObj) {
        this.startDateObj = new Date(this.endDateObj);
      }
    }
  }

  isConfirmDisabled(): boolean {
    if (this.startDateObj && this.endDateObj) {
      return this.startDateObj > this.endDateObj;
    }
    return false;
  }

  onInputFocus(event: FocusEvent): void {
    (event.target as HTMLInputElement).blur();
  }

  onInputKeydown(event: KeyboardEvent): void {
    event.preventDefault();
  }
}
