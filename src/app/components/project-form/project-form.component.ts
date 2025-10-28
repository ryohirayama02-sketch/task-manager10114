import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { MemberManagementService } from '../../services/member-management.service';
import { Member } from '../../models/member.model';

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './project-form.component.html',
  styleUrl: './project-form.component.css',
})
export class ProjectFormComponent implements OnInit {
  projectForm: FormGroup;
  members: Member[] = [];
  selectedMembers: Member[] = [];
  loading = false;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private projectService: ProjectService,
    private memberService: MemberManagementService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    this.projectForm = this.fb.group({
      projectName: ['', [Validators.required, Validators.minLength(1)]],
      description: [''],
      startDate: [''],
      endDate: [''],
      members: [[]],
    });
  }

  ngOnInit(): void {
    this.loadMembers();
  }

  /**
   * メンバー一覧を読み込み
   */
  loadMembers(): void {
    this.loading = true;
    this.memberService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
        this.loading = false;
        console.log('メンバー一覧を読み込みました:', members.length, '件');
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
        this.snackBar.open('メンバー一覧の読み込みに失敗しました', '閉じる', {
          duration: 3000,
        });
        this.loading = false;
      },
    });
  }

  /**
   * メンバー選択の変更
   */
  onMemberSelectionChange(selectedMemberIds: string[]): void {
    this.selectedMembers = this.members.filter((member) =>
      selectedMemberIds.includes(member.id || '')
    );
    this.projectForm.patchValue({ members: selectedMemberIds });
  }

  /**
   * メンバーを削除
   */
  removeMember(member: Member): void {
    this.selectedMembers = this.selectedMembers.filter(
      (m) => m.id !== member.id
    );
    const memberIds = this.selectedMembers.map((m) => m.id || '');
    this.projectForm.patchValue({ members: memberIds });
  }

  /**
   * プロジェクトを作成
   */
  async onSubmit(): Promise<void> {
    if (this.projectForm.invalid) {
      this.snackBar.open('入力内容を確認してください', '閉じる', {
        duration: 3000,
      });
      return;
    }

    this.isSubmitting = true;

    try {
      const formData = this.projectForm.value;

      // プロジェクトデータを準備
      const projectData = {
        projectName: formData.projectName,
        description: formData.description || '',
        startDate: formData.startDate || '',
        endDate: formData.endDate || '',
        members: this.selectedMembers.map((member) => ({
          memberId: member.id || '',
          memberName: member.name,
          memberEmail: member.email,
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('プロジェクトデータ:', projectData);

      await this.projectService.addProject(projectData);

      this.snackBar.open('プロジェクトを作成しました', '閉じる', {
        duration: 3000,
      });

      // プロジェクト一覧に戻る
      this.router.navigate(['/progress/projects']);
    } catch (error) {
      console.error('プロジェクト作成エラー:', error);
      this.snackBar.open('プロジェクトの作成に失敗しました', '閉じる', {
        duration: 3000,
      });
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * キャンセル
   */
  onCancel(): void {
    this.router.navigate(['/progress/projects']);
  }

  /**
   * エラーメッセージを取得
   */
  getErrorMessage(fieldName: string): string {
    const field = this.projectForm.get(fieldName);
    if (field?.hasError('required')) {
      return '必須項目です';
    }
    if (field?.hasError('minlength')) {
      return '1文字以上入力してください';
    }
    return '';
  }
}
