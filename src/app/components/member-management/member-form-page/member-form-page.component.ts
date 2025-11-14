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
import { AuthService } from '../../../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { LanguageService } from '../../../services/language.service';

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
    TranslatePipe,
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
    private router: Router,
    private authService: AuthService,
    private languageService: LanguageService
  ) {
    this.memberForm = this.fb.group({
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(20),
          this.noCommaValidator,
        ],
      ],
      email: [
        '',
        [Validators.required, Validators.email, Validators.maxLength(254)],
      ],
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

    // メンバー数の制限をチェック
    try {
      const currentCount = await this.memberService.getMemberCount();
      const maxCount = 10;
      if (currentCount >= maxCount) {
        this.snackBar.open(
          this.languageService.translateWithParams(
            'memberManagement.maxMemberLimit',
            { count: maxCount.toString() }
          ),
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
        (member) =>
          member.name?.toLowerCase().trim() ===
          formData.name?.toLowerCase().trim()
      );

      const emailExists = existingMembers.some(
        (member) =>
          member.email?.toLowerCase().trim() ===
          formData.email?.toLowerCase().trim()
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

    this.isSubmitting = true;

    try {
      await this.memberService.addMember(formData);

      // 追加されたメンバーが現在ログインしているユーザーの場合、ナビバーのユーザー名を更新
      if (formData.email && formData.name) {
        this.authService.updateMemberNameIfCurrentUser(
          formData.email,
          formData.name
        );
      }

      this.router.navigate(['/members'], { state: { memberAdded: true } });
    } catch (error) {
      console.error('メンバー追加エラー:', error);
      this.snackBar.open(
        this.languageService.translate('memberManagement.addFailed'),
        this.languageService.translate('memberManagement.close'),
        {
          duration: 3000,
        }
      );
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
        return this.languageService.translate(
          'memberManagement.emailMaxLength'
        );
      }
    }
    if (field?.hasError('noComma')) {
      return this.languageService.translate('memberManagement.noComma');
    }
    return '';
  }
}
