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
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { LanguageService } from '../../../services/language.service';

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
    TranslatePipe,
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
    private authService: AuthService,
    private languageService: LanguageService
  ) {
    this.memberForm = this.fb.group({
      name: ['', [
        Validators.required, 
        Validators.minLength(1), 
        Validators.maxLength(20),
        this.noCommaValidator
      ]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
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
      this.snackBar.open(
        this.languageService.translate('memberManagement.checkInput'),
        this.languageService.translate('memberManagement.close'),
        {
          duration: 3000,
        }
      );
      return;
    }

    const formData = this.memberForm.value;

    // 名前にカンマが含まれているかチェック
    if (formData.name && formData.name.includes(',')) {
      this.snackBar.open(
        this.languageService.translate('memberManagement.noComma'),
        this.languageService.translate('memberManagement.close'),
        {
          duration: 5000,
        }
      );
      return;
    }

    // メンバー数の制限をチェック（追加時のみ）
    if (this.data.mode === 'add') {
      try {
        const currentCount = await this.memberService.getMemberCount();
        const maxCount = 20;
        if (currentCount >= maxCount) {
          this.snackBar.open(
            this.languageService.translateWithParams('memberManagement.maxMemberLimit', { count: maxCount.toString() }),
            this.languageService.translate('memberManagement.close'),
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
            this.languageService.translate('memberManagement.nameExists'),
            this.languageService.translate('memberManagement.close'),
            { duration: 5000 }
          );
          return;
        }

        if (emailExists) {
          this.snackBar.open(
            this.languageService.translate('memberManagement.emailExists'),
            this.languageService.translate('memberManagement.close'),
            { duration: 5000 }
          );
          return;
        }
      } catch (error) {
        console.error('メンバー数チェックエラー:', error);
        this.snackBar.open(
          this.languageService.translate('memberManagement.countCheckFailed'),
          this.languageService.translate('memberManagement.close'),
          {
            duration: 3000,
          }
        );
        return;
      }
    }

    // 編集モードの場合も重複チェック（編集中のメンバー自身は除外）
    if (this.data.mode === 'edit' && this.data.member?.id) {
      try {
        const existingMembers = await firstValueFrom(
          this.memberService.getMembers()
        ).catch(() => []);
        
        // 編集中のメンバー以外で重複チェック
        const otherMembers = existingMembers.filter(
          (member) => member.id !== this.data.member?.id
        );
        
        const nameExists = otherMembers.some(
          (member) => member.name?.toLowerCase().trim() === formData.name?.toLowerCase().trim()
        );
        
        const emailExists = otherMembers.some(
          (member) => member.email?.toLowerCase().trim() === formData.email?.toLowerCase().trim()
        );

        if (nameExists) {
          this.snackBar.open(
            this.languageService.translate('memberManagement.nameExists'),
            this.languageService.translate('memberManagement.close'),
            { duration: 5000 }
          );
          return;
        }

        if (emailExists) {
          this.snackBar.open(
            this.languageService.translate('memberManagement.emailExists'),
            this.languageService.translate('memberManagement.close'),
            { duration: 5000 }
          );
          return;
        }
      } catch (error) {
        console.error('重複チェックエラー:', error);
        // エラーが発生しても更新処理は続行
      }
    }

    this.isSubmitting = true;

    try {
      if (this.data.mode === 'add') {
        await this.memberService.addMember(formData);
        console.log('✅ メンバーを追加しました');
        
        // 追加されたメンバーが現在ログインしているユーザーの場合、ナビバーのユーザー名を更新
        if (formData.email && formData.name) {
          this.authService.updateMemberNameIfCurrentUser(formData.email, formData.name);
        }
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
      this.snackBar.open(
        this.languageService.translate('memberManagement.saveFailed'),
        this.languageService.translate('memberManagement.close'),
        {
          duration: 3000,
        }
      );
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
      return fieldName === 'name'
        ? this.languageService.translate('memberManagement.nameRequired')
        : this.languageService.translate('memberManagement.emailRequired');
    }
    if (field?.hasError('email')) {
      return this.languageService.translate('memberManagement.validEmail');
    }
    if (field?.hasError('minlength')) {
      return this.languageService.translate('memberManagement.minLength');
    }
    if (field?.hasError('maxlength')) {
      if (fieldName === 'name') {
        return this.languageService.translate('memberManagement.nameMaxLength');
      } else if (fieldName === 'email') {
        return this.languageService.translate('memberManagement.emailMaxLength');
      }
    }
    if (field?.hasError('noComma')) {
      return this.languageService.translate('memberManagement.noComma');
    }
    return '';
  }
}
