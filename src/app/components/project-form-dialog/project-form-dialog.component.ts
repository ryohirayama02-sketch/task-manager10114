import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ProjectService } from '../../services/project.service';
import { MemberManagementService } from '../../services/member-management.service';
import { ProjectDeleteConfirmDialogComponent } from '../project-detail/project-delete-confirm-dialog.component';
import { Milestone } from '../../models/task.model';
import { IProject } from '../../models/project.model';
import { Member } from '../../models/member.model';

@Component({
  selector: 'app-project-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './project-form-dialog.component.html',
  styleUrls: ['./project-form-dialog.component.css'],
})
export class ProjectFormDialogComponent implements OnInit {
  project = {
    projectName: '',
    overview: '',
    startDate: '',
    members: '',
    tags: '',
    milestones: [] as Milestone[],
  };

  // メンバー選択関連
  members: Member[] = [];
  selectedMembers: Member[] = [];
  selectedMemberIds: string[] = [];
  membersLoading = false;

  isEditMode: boolean = false;
  originalProject: IProject | null = null;

  constructor(
    private projectService: ProjectService,
    private memberService: MemberManagementService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<ProjectFormDialogComponent>,
    private dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: { project?: IProject }
  ) {
    if (data && data.project) {
      this.isEditMode = true;
      this.originalProject = data.project;
      this.project = {
        projectName: data.project.projectName || '',
        overview: data.project.overview || '',
        startDate: data.project.startDate || '',
        members: data.project.members || '',
        tags: data.project.tags || '',
        milestones: data.project.milestones ? [...data.project.milestones] : [],
      };
    }
  }

  ngOnInit(): void {
    this.loadMembers();
  }

  /**
   * メンバー一覧を読み込み
   */
  loadMembers(): void {
    this.membersLoading = true;
    this.memberService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
        this.membersLoading = false;
        console.log('メンバー一覧を読み込みました:', members.length, '件');
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
        this.snackBar.open('メンバー一覧の読み込みに失敗しました', '閉じる', {
          duration: 3000,
        });
        this.membersLoading = false;
      },
    });
  }

  /**
   * メンバー選択の変更
   */
  onMemberSelectionChange(selectedMemberIds: string[]): void {
    this.selectedMemberIds = selectedMemberIds;
    this.selectedMembers = this.members.filter((member) =>
      selectedMemberIds.includes(member.id || '')
    );
    // メンバー情報を文字列として保存（既存の構造との互換性のため）
    this.project.members = this.selectedMembers.map((m) => m.name).join(', ');
  }

  /**
   * メンバーを削除
   */
  removeMember(member: Member): void {
    this.selectedMembers = this.selectedMembers.filter(
      (m) => m.id !== member.id
    );
    this.selectedMemberIds = this.selectedMembers.map((m) => m.id || '');
    this.project.members = this.selectedMembers.map((m) => m.name).join(', ');
  }

  async onSubmit() {
    if (this.isEditMode && this.originalProject) {
      // 編集モードの場合
      const updatedProject: IProject = {
        ...this.originalProject,
        projectName: this.project.projectName,
        overview: this.project.overview,
        startDate: this.project.startDate,
        members: this.project.members,
        tags: this.project.tags,
        milestones: this.project.milestones,
      };
      await this.projectService.updateProject(
        this.originalProject.id,
        updatedProject
      );
    } else {
      // 新規作成モードの場合
      await this.projectService.addProject(this.project);
    }
    this.dialogRef.close('success');
  }

  onCancel() {
    this.dialogRef.close();
  }

  /** マイルストーンを追加 */
  addMilestone() {
    this.project.milestones.push({
      id: this.generateId(),
      name: '',
      date: '',
      description: '',
    });
  }

  /** マイルストーンを削除 */
  removeMilestone(index: number) {
    this.project.milestones.splice(index, 1);
  }

  /** IDを生成 */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /** プロジェクト削除の確認ダイアログ */
  confirmDeleteProject(): void {
    if (!this.originalProject) {
      return;
    }

    const dialogRef = this.dialog.open(ProjectDeleteConfirmDialogComponent, {
      width: '400px',
      data: {
        projectName: this.originalProject.projectName,
        projectId: this.originalProject.id,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === true) {
        this.deleteProject();
      }
    });
  }

  /** プロジェクトを削除 */
  async deleteProject(): Promise<void> {
    if (!this.originalProject?.id) {
      return;
    }

    try {
      await this.projectService.deleteProject(
        this.originalProject.id,
        this.originalProject
      );
      this.snackBar.open(
        `プロジェクト「${this.originalProject.projectName}」を削除しました`,
        '閉じる',
        { duration: 3000 }
      );

      // ダイアログを閉じて削除完了を通知
      this.dialogRef.close({ deleted: true });
    } catch (error) {
      console.error('プロジェクト削除エラー:', error);
      this.snackBar.open('プロジェクトの削除に失敗しました', '閉じる', {
        duration: 3000,
      });
    }
  }

  /** ネイティブ日付ピッカーを開く */
  openDatePicker(input: HTMLInputElement): void {
    if (!input) {
      return;
    }

    if (typeof (input as any).showPicker === 'function') {
      (input as any).showPicker();
    } else {
      input.focus();
      input.click();
    }
  }
}
