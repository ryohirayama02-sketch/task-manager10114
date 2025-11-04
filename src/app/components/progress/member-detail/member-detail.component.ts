import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ProjectService } from '../../../services/project.service';
import { Task } from '../../../models/task.model';
import {
  DEFAULT_PROJECT_THEME_COLOR,
  resolveProjectThemeColor,
} from '../../../constants/project-theme-colors';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { Inject } from '@angular/core';

interface MemberDetail {
  name: string;
  projects: string[];
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  completionRate: number;
  tasks: Task[];
  // 優先度別の詳細
  completedByPriority: { high: number; medium: number; low: number };
  inProgressByPriority: { high: number; medium: number; low: number };
  notStartedByPriority: { high: number; medium: number; low: number };
}

@Component({
  selector: 'app-member-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './member-detail.component.html',
  styleUrls: ['./member-detail.component.css'],
})
export class MemberDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private location = inject(Location);
  private dialog = inject(MatDialog);

  memberDetail: MemberDetail | null = null;
  isLoading = true;
  displayedColumns: string[] = [
    'projectName',
    'taskName',
    'dueDate',
    'status',
    'priority',
  ];
  readonly defaultThemeColor = DEFAULT_PROJECT_THEME_COLOR;

  // フィルター用
  filterProjects: string[] = [];
  filterStatus: string[] = [];
  filterPriority: string[] = [];
  filterDueDateSort: string = ''; // 'near' (近い順) or 'far' (遠い順)
  filteredTasks: Task[] = [];
  
  // プロジェクト情報
  private projectMap: Record<string, any> = {};
  private projectNameToId: Record<string, string> = {};

  // 期間フィルター用
  periodStartDate: Date | null = null;
  periodEndDate: Date | null = null;

  ngOnInit() {
    const memberName = this.route.snapshot.paramMap.get('memberName');
    if (memberName) {
      this.loadMemberDetail(memberName);
    }
  }

  loadMemberDetail(memberName: string) {
    this.isLoading = true;
    console.log('メンバー詳細を読み込み中:', memberName);

    // 全プロジェクトのタスクを取得
    this.projectService.getProjects().subscribe((projects) => {
      if (projects.length === 0) {
        this.isLoading = false;
        return;
      }

      // プロジェクトマップを構築
      this.projectMap = projects.reduce(
        (acc, project) => {
          acc[project.id] = project;
          return acc;
        },
        {} as Record<string, any>
      );

      const allTasks: Task[] = [];
      let completedRequests = 0;

      // 各プロジェクトのタスクを取得
      projects.forEach((project) => {
        if (project.id) {
          this.projectService
            .getTasksByProjectId(project.id)
            .subscribe((tasks) => {
              allTasks.push(...tasks);
              completedRequests++;

              // すべてのプロジェクトのタスクを取得したら処理を実行
              if (completedRequests === projects.length) {
                this.processMemberDetail(memberName, allTasks);
              }
            });
        } else {
          completedRequests++;
          if (completedRequests === projects.length) {
            this.processMemberDetail(memberName, allTasks);
          }
        }
      });
    });
  }

  processMemberDetail(memberName: string, allTasks: Task[]) {
    console.log('全タスク:', allTasks);

    // 指定されたメンバーのタスクをフィルタリング
    let memberTasks = allTasks.filter((task) => task.assignee === memberName);

    // タスクにプロジェクトテーマ色を付与
    this.projectNameToId = {};
    memberTasks = memberTasks.map((task) => {
      const project = this.projectMap[task.projectId];
      const themeColor = project
        ? resolveProjectThemeColor(project)
        : this.defaultThemeColor;
      if (task.projectName && task.projectId) {
        this.projectNameToId[task.projectName] = task.projectId;
      }
      return {
        ...task,
        projectThemeColor: themeColor,
      };
    });

    if (memberTasks.length === 0) {
      this.isLoading = false;
      return;
    }

    // 所属プロジェクトを取得
    const projects = [...new Set(memberTasks.map((task) => task.projectName))];

    // タスクの統計を計算
    const completedTasks = memberTasks.filter((t) => t.status === '完了');
    const inProgressTasks = memberTasks.filter((t) => t.status === '作業中');
    const notStartedTasks = memberTasks.filter((t) => t.status === '未着手');
    const completionRate =
      memberTasks.length > 0
        ? Math.round((completedTasks.length / memberTasks.length) * 100)
        : 0;

    // 優先度別の詳細計算
    const completedByPriority = this.calculatePriorityBreakdown(completedTasks);
    const inProgressByPriority =
      this.calculatePriorityBreakdown(inProgressTasks);
    const notStartedByPriority =
      this.calculatePriorityBreakdown(notStartedTasks);

    this.memberDetail = {
      name: memberName,
      projects,
      totalTasks: memberTasks.length,
      completedTasks: completedTasks.length,
      inProgressTasks: inProgressTasks.length,
      notStartedTasks: notStartedTasks.length,
      completionRate,
      tasks: memberTasks,
      completedByPriority,
      inProgressByPriority,
      notStartedByPriority,
    };

    console.log('メンバー詳細:', this.memberDetail);
    this.applyTaskFilters();
    this.isLoading = false;
  }

  navigateToProject(projectName: string, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    const projectId = this.projectNameToId[projectName];
    if (!projectId) {
      return;
    }
    this.router.navigate(['/project', projectId]);
  }

  navigateToTask(task: Task, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    const projectId =
      task.projectId || this.projectNameToId[task.projectName] || null;
    if (!projectId) {
      return;
    }
    if (!task.id) {
      this.router.navigate(['/project', projectId]);
      return;
    }
    this.router.navigate(['/project', projectId, 'task', task.id]);
  }

  /** タスクフィルターを適用 */
  applyTaskFilters() {
    if (!this.memberDetail) return;

    let filtered = [...this.memberDetail.tasks];

    // プロジェクトフィルター
    if (this.filterProjects.length > 0) {
      filtered = filtered.filter((task) =>
        this.filterProjects.includes(task.projectName)
      );
    }

    // ステータスフィルター
    if (this.filterStatus.length > 0) {
      filtered = filtered.filter((task) =>
        this.filterStatus.includes(task.status)
      );
    }

    // 優先度フィルター
    if (this.filterPriority.length > 0) {
      filtered = filtered.filter((task) =>
        this.filterPriority.includes(task.priority)
      );
    }

    // 期日でソート
    if (this.filterDueDateSort === 'near') {
      filtered.sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return dateA - dateB;
      });
    } else if (this.filterDueDateSort === 'far') {
      filtered.sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : -Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : -Infinity;
        return dateB - dateA;
      });
    }

    this.filteredTasks = filtered;
  }

  /** フィルターをリセット */
  resetTaskFilters() {
    this.filterProjects = [];
    this.filterStatus = [];
    this.filterPriority = [];
    this.filterDueDateSort = '';
    this.applyTaskFilters();
  }

  /** 期間フィルターを適用して統計を更新 */
  applyPeriodFilter() {
    if (!this.memberDetail) return;

    let filteredTasks = this.memberDetail.tasks;

    // 期間でフィルター
    if (this.periodStartDate || this.periodEndDate) {
      filteredTasks = filteredTasks.filter((task) => {
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        if (!dueDate) return false;

        const afterStart = this.periodStartDate
          ? dueDate >= this.periodStartDate
          : true;
        const beforeEnd = this.periodEndDate
          ? dueDate <= this.periodEndDate
          : true;

        return afterStart && beforeEnd;
      });
    }

    // 期間フィルター後のステータス・優先度別の内訳を計算
    const completedTasks = filteredTasks.filter((t) => t.status === '完了');
    const inProgressTasks = filteredTasks.filter((t) => t.status === '作業中');
    const notStartedTasks = filteredTasks.filter((t) => t.status === '未着手');

    // 統計情報を更新
    this.memberDetail.completedTasks = completedTasks.length;
    this.memberDetail.inProgressTasks = inProgressTasks.length;
    this.memberDetail.notStartedTasks = notStartedTasks.length;
    this.memberDetail.completedByPriority =
      this.calculatePriorityBreakdown(completedTasks);
    this.memberDetail.inProgressByPriority =
      this.calculatePriorityBreakdown(inProgressTasks);
    this.memberDetail.notStartedByPriority =
      this.calculatePriorityBreakdown(notStartedTasks);
  }

  /** 期間フィルターをリセット */
  resetPeriodFilter() {
    this.periodStartDate = null;
    this.periodEndDate = null;
    this.applyPeriodFilter();
  }

  /** 優先度別の内訳を計算 */
  calculatePriorityBreakdown(tasks: Task[]): {
    high: number;
    medium: number;
    low: number;
  } {
    return {
      high: tasks.filter((t) => t.priority === '高').length,
      medium: tasks.filter((t) => t.priority === '中').length,
      low: tasks.filter((t) => t.priority === '低').length,
    };
  }

  getStatusColor(status: string): string {
    switch (status) {
      case '完了':
        return '#b2e9cb';
      case '作業中':
        return '#fef6c3';
      case '未着手':
        return '#fdd6d5';
      default:
        return '#9e9e9e';
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case '高':
        return '#fdd6d5';
      case '中':
        return '#fef6c3';
      case '低':
        return '#b2e9cb';
      default:
        return '#9e9e9e';
    }
  }

  goBack() {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/progress/members']);
    }
  }

  exportToCSV() {
    if (!this.memberDetail) return;

    const csvContent = this.generateCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${this.memberDetail.name}_tasks.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private generateCSVContent(): string {
    if (!this.memberDetail) return '';

    const headers = [
      'プロジェクト名',
      'タスク名',
      'ステータス',
      '期日',
      '優先度',
    ];
    const rows = this.memberDetail.tasks.map((task) => [
      task.projectName,
      task.taskName,
      task.status,
      task.dueDate,
      task.priority,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  getProjectNameStyle(task: Task) {
    const color = task.projectThemeColor || this.defaultThemeColor;
    return {
      backgroundColor: color,
      color: '#1f2933',
    };
  }

  openPeriodDialog() {
    const dialogRef = this.dialog.open(PeriodFilterDialogComponent, {
      width: '300px',
      data: {
        startDate: this.periodStartDate,
        endDate: this.periodEndDate,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.periodStartDate = result.startDate;
        this.periodEndDate = result.endDate;
        this.applyPeriodFilter();
      }
    });
  }
}

// 期間選択ダイアログコンポーネント
@Component({
  selector: 'app-period-filter-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatFormFieldModule, FormsModule, MatDialogModule],
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
            class="date-input"
          />
        </div>
        <div class="date-field">
          <label for="endDate">終了日</label>
          <input
            id="endDate"
            type="date"
            [(ngModel)]="endDate"
            class="date-input"
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
  styles: [`
    .period-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 0;
    }
    .date-field {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    label {
      font-weight: 500;
      font-size: 14px;
      color: #495057;
    }
    .date-input {
      padding: 8px 12px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px;
    }
    mat-dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-top: 16px;
    }
  `],
})
export class PeriodFilterDialogComponent {
  startDate: string | null = null;
  endDate: string | null = null;

  constructor(
    private dialogRef: MatDialogRef<PeriodFilterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data) {
      this.startDate = data.startDate ? this.formatDateToString(data.startDate) : null;
      this.endDate = data.endDate ? this.formatDateToString(data.endDate) : null;
    }
  }

  onConfirm() {
    const normalizedStartDate = this.normalizeDateInput(this.startDate);
    const normalizedEndDate = this.normalizeDateInput(this.endDate);

    const hasStartDate = !!normalizedStartDate;
    const hasEndDate = !!normalizedEndDate;

    if (!hasStartDate && !hasEndDate) {
      this.startDate = null;
      this.endDate = null;
      this.dialogRef.close({
        startDate: null,
        endDate: null,
      });
      return;
    }

    if (hasStartDate && hasEndDate) {
      this.dialogRef.close({
        startDate: new Date(normalizedStartDate),
        endDate: new Date(normalizedEndDate),
      });
      return;
    }

    if (hasStartDate && !hasEndDate) {
      this.endDate = null;
      this.dialogRef.close({
        startDate: new Date(normalizedStartDate),
        endDate: null,
      });
      return;
    }

    if (!hasStartDate && hasEndDate) {
      this.startDate = null;
      this.dialogRef.close({
        startDate: null,
        endDate: new Date(normalizedEndDate),
      });
    }
  }

  onCancel() {
    this.dialogRef.close();
  }

  isConfirmDisabled(): boolean {
    const normalizedStartDate = this.normalizeDateInput(this.startDate);
    const normalizedEndDate = this.normalizeDateInput(this.endDate);
    const hasStartDate = !!normalizedStartDate;
    const hasEndDate = !!normalizedEndDate;

    if (hasStartDate && hasEndDate) {
      return new Date(normalizedStartDate) > new Date(normalizedEndDate);
    }

    return false;
  }

  private formatDateToString(date: Date): string {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizeDateInput(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
}
