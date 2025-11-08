import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { MemberManagementService } from '../../../services/member-management.service';

@Component({
  selector: 'app-member-form-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './member-form-page.component.html',
  styleUrls: ['./member-form-page.component.css'],
})
export class MemberFormPageComponent {
  memberForm: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private memberService: MemberManagementService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    this.memberForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(20)]],
      email: ['', [Validators.required, Validators.email]],
    });
  }

  async onSubmit(): Promise<void> {
    if (this.memberForm.invalid) {
      this.snackBar.open('入力内容を確認してください', '閉じる', {
        duration: 3000,
      });
      return;
    }

    this.isSubmitting = true;

    try {
      await this.memberService.addMember(this.memberForm.value);
      this.router.navigate(['/members'], { state: { memberAdded: true } });
    } catch (error) {
      console.error('メンバー追加エラー:', error);
      this.snackBar.open('メンバーの追加に失敗しました', '閉じる', {
        duration: 3000,
      });
    } finally {
      this.isSubmitting = false;
    }
  }

  onCancel(): void {
    this.router.navigate(['/members']);
  }

  getErrorMessage(fieldName: string): string {
    const field = this.memberForm.get(fieldName);
    if (field?.hasError('required')) {
      return `${fieldName === 'name' ? '名前' : 'メールアドレス'}は必須です`;
    }
    if (field?.hasError('email')) {
      return '有効なメールアドレスを入力してください';
    }
    if (field?.hasError('minlength')) {
      return '1文字以上入力してください';
    }
    if (field?.hasError('maxlength')) {
      return '名前は20文字以内で入力してください';
    }
    return '';
  }
}
