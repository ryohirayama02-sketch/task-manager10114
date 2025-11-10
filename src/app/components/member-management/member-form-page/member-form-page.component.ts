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
import { firstValueFrom } from 'rxjs';

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
      name: ['', [
        Validators.required, 
        Validators.minLength(1), 
        Validators.maxLength(20),
        this.noCommaValidator
      ]],
      email: ['', [Validators.required, Validators.email]],
    });
  }

  /**
   * カンマを含まないことを検証するカスタムバリデーター
   */
  private noCommaValidator(control: any) {
    if (control.value && control.value.includes(',')) {
      return { noComma: true };
    }
    return null;
  }

  async onSubmit(): Promise<void> {
    if (this.memberForm.invalid) {
      this.snackBar.open('入力内容を確認してください', '閉じる', {
        duration: 3000,
      });
      return;
    }

    const formData = this.memberForm.value;

    // 名前にカンマが含まれているかチェック
    if (formData.name && formData.name.includes(',')) {
      this.snackBar.open('名前に「,」（カンマ）は使用できません', '閉じる', {
        duration: 5000,
      });
      return;
    }

    // メンバー数の制限をチェック
    try {
      const currentCount = await this.memberService.getMemberCount();
      const maxCount = 20;
      if (currentCount >= maxCount) {
        this.snackBar.open(
          `管理メンバーは最大${maxCount}人登録できます`,
          '閉じる',
          { duration: 5000 }
        );
        return;
      }

      // 既存メンバーとの重複チェック（名前・メールアドレス）
      const existingMembers = await firstValueFrom(
        this.memberService.getMembers()
      ).catch(() => []);
      
      const nameExists = existingMembers.some(
        (member) => member.name?.toLowerCase().trim() === formData.name?.toLowerCase().trim()
      );
      
      const emailExists = existingMembers.some(
        (member) => member.email?.toLowerCase().trim() === formData.email?.toLowerCase().trim()
      );

      if (nameExists) {
        this.snackBar.open(
          'この名前は既に登録されています',
          '閉じる',
          { duration: 5000 }
        );
        return;
      }

      if (emailExists) {
        this.snackBar.open(
          'このメールアドレスは既に登録されています',
          '閉じる',
          { duration: 5000 }
        );
        return;
      }
    } catch (error) {
      console.error('メンバー数チェックエラー:', error);
      this.snackBar.open('メンバー数の確認に失敗しました', '閉じる', {
        duration: 3000,
      });
      return;
    }

    this.isSubmitting = true;

    try {
      await this.memberService.addMember(formData);
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
    if (field?.hasError('noComma')) {
      return '名前に「,」（カンマ）は使用できません';
    }
    return '';
  }
}
