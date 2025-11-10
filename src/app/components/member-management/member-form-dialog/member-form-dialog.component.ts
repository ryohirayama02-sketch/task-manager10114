import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MemberManagementService } from '../../../services/member-management.service';
import { Member } from '../../../models/member.model';
import { AuthService } from '../../../services/auth.service';

export interface MemberFormData {
  mode: 'add' | 'edit';
  member?: Member;
}

@Component({
  selector: 'app-member-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './member-form-dialog.component.html',
  styleUrls: ['./member-form-dialog.component.css'],
})
export class MemberFormDialogComponent implements OnInit {
  memberForm: FormGroup;
  isSubmitting = false;

  constructor(
    private dialogRef: MatDialogRef<MemberFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MemberFormData,
    private memberService: MemberManagementService,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.memberForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(20)]],
      email: ['', [Validators.required, Validators.email]],
    });
  }

  ngOnInit(): void {
    if (this.data.mode === 'edit' && this.data.member) {
      this.memberForm.patchValue({
        name: this.data.member.name,
        email: this.data.member.email,
      });
    }
  }

  /**
   * フォーム送信
   */
  async onSubmit(): Promise<void> {
    if (this.memberForm.invalid) {
      this.snackBar.open('入力内容を確認してください', '閉じる', {
        duration: 3000,
      });
      return;
    }

    // メンバー数の制限をチェック（追加時のみ）
    if (this.data.mode === 'add') {
      try {
        const currentCount = await this.memberService.getMemberCount();
        const maxCount = 30;
        if (currentCount >= maxCount) {
          this.snackBar.open(
            `管理メンバーは最大${maxCount}人登録できます`,
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
    }

    this.isSubmitting = true;

    try {
      const formData = this.memberForm.value;

      if (this.data.mode === 'add') {
        await this.memberService.addMember(formData);
        console.log('✅ メンバーを追加しました');
      } else if (this.data.mode === 'edit' && this.data.member?.id) {
        await this.memberService.updateMember(this.data.member.id, formData);
        console.log('✅ メンバーを更新しました');
        
        // 更新されたメンバーが現在ログインしているユーザーの場合、ナビバーのユーザー名を更新
        if (this.data.member.email && formData.name) {
          this.authService.updateMemberNameIfCurrentUser(this.data.member.email, formData.name);
        }
      }

      this.dialogRef.close('success');
    } catch (error) {
      console.error('メンバー保存エラー:', error);
      this.snackBar.open('保存に失敗しました', '閉じる', {
        duration: 3000,
      });
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * ダイアログを閉じる
   */
  onCancel(): void {
    this.dialogRef.close();
  }

  /**
   * エラーメッセージを取得
   */
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
