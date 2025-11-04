import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogRef,
  MatDialogModule,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MemberManagementService } from '../../services/member-management.service';
import { Member } from '../../models/member.model';
import { IProject } from '../../models/project.model';
import {
  resolveProjectThemeColor,
  DEFAULT_PROJECT_THEME_COLOR,
} from '../../constants/project-theme-colors';

interface TaskFormModel {
  projectName: string;
  taskName: string;
  status: string;
  priority: string;
  assignee: string;
  assigneeEmail: string;
  startDate: Date | null;
  dueDate: Date | null;
  tags: string[];
  calendarSyncEnabled: boolean;
  parentTaskId?: string;
}

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './task-form.component.html',
  styleUrls: ['./task-form.component.css'],
})
export class TaskFormComponent implements OnInit {
  // ✅ inject 構文を使った依存注入
  private dialogRef = inject(MatDialogRef<TaskFormComponent>);
  private data = inject(MAT_DIALOG_DATA, { optional: true }); // ← 追加（projectを受け取る）
  private memberService = inject(MemberManagementService);
  private snackBar = inject(MatSnackBar);
  parentTaskName = '';

  // プロジェクト情報
  project: IProject | undefined;

  // メンバー関連
  members: Member[] = [];
  loading = false;

  // 日付用の文字列プロパティ
  startDateString: string = '';
  dueDateString: string = '';

  // 選択されたメンバーID
  selectedMemberId: string = '';

  // 入力モデル（双方向バインディング用）
  model: TaskFormModel = {
    projectName: '',
    taskName: '',
    status: '未着手',
    priority: '中',
    assignee: '',
    assigneeEmail: '',
    startDate: null,
    dueDate: null,
    tags: [],
    calendarSyncEnabled: false,
    parentTaskId: '',
  };
  tagInputValue = '';

  ngOnInit(): void {
    this.loadMembers();
    console.log('TaskFormComponent initialized');
    this.checkDateInputSupport();
  }

  /**
   * ブラウザの日付入力サポートを確認
   */
  checkDateInputSupport(): void {
    const testInput = document.createElement('input');
    testInput.type = 'date';
    const isSupported = testInput.type === 'date';

    console.log('Date input support:', isSupported);
    console.log('Browser:', navigator.userAgent);

    if (!isSupported) {
      console.warn('This browser does not support HTML5 date input');
      // 代替手段を提供
      this.showDateInputAlternative();
    }
  }

  /**
   * 日付入力の代替手段を表示
   */
  showDateInputAlternative(): void {
    console.log('Using alternative date input method');
    // ここで代替の日付選択UIを表示する
  }

  constructor() {
    // ダイアログ呼び出し時に受け取ったデータを初期セット
    if (this.data?.project) {
      this.project = this.data.project;
      this.model.projectName = this.data.project.projectName;
    } else if (this.data?.projectName) {
      // 後方互換性を保つ
      this.model.projectName = this.data.projectName;
    }

    if (this.data?.parentTaskName) {
      this.parentTaskName = this.data.parentTaskName;
    }

    if (this.data?.parentTaskId) {
      this.model.parentTaskId = this.data.parentTaskId;
    }

    // 複製データがある場合は、フォームに設定
    if (this.data?.duplicateData) {
      const duplicateData = this.data.duplicateData;
      this.model = {
        ...this.model,
        projectName: this.data.projectName || duplicateData.projectName || '',
        taskName: duplicateData.taskName || '',
        status: duplicateData.status || '未着手',
        priority: duplicateData.priority || '中',
        assignee: duplicateData.assignee || '',
        calendarSyncEnabled: duplicateData.calendarSyncEnabled ?? false,
        parentTaskId:
          duplicateData.parentTaskId || this.model.parentTaskId || '',
        startDate: duplicateData.startDate
          ? new Date(duplicateData.startDate)
          : null,
        dueDate:
          duplicateData.endDate || duplicateData.dueDate
            ? new Date(duplicateData.endDate || duplicateData.dueDate)
            : null,
        tags: Array.isArray(duplicateData.tags)
          ? [...duplicateData.tags]
          : duplicateData.tags
          ? [duplicateData.tags]
          : [],
      };

      // 文字列プロパティも設定
      this.startDateString = duplicateData.startDate || '';
      this.dueDateString = duplicateData.endDate || duplicateData.dueDate || '';

      // 担当者が設定されている場合、selectedMemberIdを設定
      if (duplicateData.assignee) {
        const member = this.members.find(
          (m) => m.name === duplicateData.assignee
        );
        if (member) {
          this.selectedMemberId = member.id || '';
        }
      }
    }
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

        // 複製データがある場合、担当者を設定
        if (this.data?.duplicateData?.assignee) {
          const member = members.find(
            (m) => m.name === this.data.duplicateData.assignee
          );
          if (member) {
            this.selectedMemberId = member.id || '';
            this.model.assignee = member.name;
            this.model.assigneeEmail = member.email;
          }
        }
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
  onMemberSelectionChange(memberId: string): void {
    console.log('メンバー選択変更:', memberId);

    if (!memberId) {
      this.model.assignee = '';
      this.model.assigneeEmail = '';
      return;
    }

    const selectedMember = this.members.find(
      (member) => member.id === memberId
    );

    if (selectedMember) {
      this.model.assignee = selectedMember.name;
      this.model.assigneeEmail = selectedMember.email;
      console.log('選択されたメンバー:', selectedMember);
    } else {
      console.warn('メンバーが見つかりません:', memberId);
      this.model.assignee = '';
      this.model.assigneeEmail = '';
    }
  }

  onTagInputEnter(event: Event): void {
    event.preventDefault();
    this.addTagFromInput();
  }

  addTagFromInput(): void {
    const value = this.tagInputValue.trim();
    if (!value) {
      this.tagInputValue = '';
      return;
    }

    if (!this.model.tags) {
      this.model.tags = [];
    }

    if (this.model.tags.includes(value)) {
      this.tagInputValue = '';
      return;
    }

    this.model.tags.push(value);
    this.tagInputValue = '';
  }

  removeTag(tag: string): void {
    if (!this.model.tags) {
      return;
    }
    this.model.tags = this.model.tags.filter((t) => t !== tag);
  }

  save() {
    if (!this.model.taskName) return;

    if (this.model.tags) {
      this.model.tags = this.model.tags
        .map((tag) => tag.trim())
        .filter((tag, index, arr) => tag && arr.indexOf(tag) === index);
    } else {
      this.model.tags = [];
    }

    // 文字列の日付をそのまま使用
    const result = {
      ...this.model,
      startDate: this.startDateString,
      dueDate: this.dueDateString,
    };

    console.log('Saving task with dates:', result);
    this.dialogRef.close(result);
  }

  cancel() {
    this.dialogRef.close();
  }

  /**
   * プロジェクトのテーマカラーに基づいた背景色スタイルを取得
   */
  getThemeBackgroundStyle(): Record<string, string> {
    if (!this.project) {
      return {};
    }
    const themeColor = resolveProjectThemeColor(this.project);
    if (themeColor === DEFAULT_PROJECT_THEME_COLOR) {
      return {};
    }
    return { 'background-color': themeColor };
  }
}
