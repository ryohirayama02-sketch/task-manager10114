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
import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { Inject } from '@angular/core';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { LanguageService } from '../../../services/language.service';
import { PeriodFilterDialogComponent } from '../period-filter-dialog/period-filter-dialog.component';

interface MemberDetail {
  name: string;
  projects: string[];
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  completionRate: number;
  tasks: Task[];
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
    TranslatePipe,
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
  private languageService = inject(LanguageService);

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

  filterProjects: string[] = [];
  filterStatus: string[] = [];
  filterPriority: string[] = [];
  filterDueDateSort: string = '';
  filteredTasks: Task[] = [];

  private projectMap: Record<string, any> = {};
  private projectNameToId: Record<string, string> = {};

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

    this.projectService.getProjects().subscribe((projects) => {
      if (projects.length === 0) {
        this.isLoading = false;
        return;
      }

      this.projectMap = projects.reduce((acc, project) => {
        acc[project.id] = project;
        return acc;
      }, {} as Record<string, any>);

      const allTasks: Task[] = [];
      let completedRequests = 0;

      projects.forEach((project) => {
        if (project.id) {
          this.projectService
            .getTasksByProjectId(project.id)
            .subscribe((tasks) => {
              allTasks.push(...tasks);
              completedRequests++;

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

  // ✅ カンマ区切り対応版（全メンバー進捗と同等仕様）
  processMemberDetail(memberName: string, allTasks: Task[]) {
    console.log('全タスク:', allTasks);

    const filteredTasks: Task[] = [];

    allTasks.forEach((task) => {
      let assignees: string[] = [];

      if (task.assignee) {
        assignees = task.assignee
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
      }

      if (task.assignedMembers && task.assignedMembers.length > 0) {
        assignees.push(...task.assignedMembers);
      }

      assignees = [...new Set(assignees)];

      if (assignees.includes(memberName)) {
        filteredTasks.push(task);
      }
    });

    this.projectNameToId = {};
    const memberTasks = filteredTasks.map((task) => {
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

    const projects = [...new Set(memberTasks.map((task) => task.projectName))];

    const completedTasks = memberTasks.filter((t) => t.status === '完了');
    const inProgressTasks = memberTasks.filter((t) => t.status === '作業中');
    const notStartedTasks = memberTasks.filter((t) => t.status === '未着手');

    const completionRate =
      memberTasks.length > 0
        ? Math.round((completedTasks.length / memberTasks.length) * 100)
        : 0;

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

  // ===== 以下は既存処理を維持 =====

  navigateToProject(projectName: string, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    const projectId = this.projectNameToId[projectName];
    if (!projectId) return;
    this.router.navigate(['/project', projectId]);
  }

  navigateToTask(task: Task, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    const projectId =
      task.projectId || this.projectNameToId[task.projectName] || null;
    if (!projectId) return;
    if (!task.id) {
      this.router.navigate(['/project', projectId]);
      return;
    }
    this.router.navigate(['/project', projectId, 'task', task.id]);
  }

  applyTaskFilters() {
    if (!this.memberDetail) return;
    let filtered = [...this.memberDetail.tasks];
    if (this.filterProjects.length > 0) {
      filtered = filtered.filter((task) =>
        this.filterProjects.includes(task.projectName)
      );
    }
    if (this.filterStatus.length > 0) {
      filtered = filtered.filter((task) =>
        this.filterStatus.includes(task.status)
      );
    }
    if (this.filterPriority.length > 0) {
      filtered = filtered.filter((task) =>
        this.filterPriority.includes(task.priority)
      );
    }
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

  resetTaskFilters() {
    this.filterProjects = [];
    this.filterStatus = [];
    this.filterPriority = [];
    this.filterDueDateSort = '';
    this.applyTaskFilters();
  }

  applyPeriodFilter() {
    if (!this.memberDetail) return;
    let filteredTasks = this.memberDetail.tasks;
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
    const completedTasks = filteredTasks.filter((t) => t.status === '完了');
    const inProgressTasks = filteredTasks.filter((t) => t.status === '作業中');
    const notStartedTasks = filteredTasks.filter((t) => t.status === '未着手');
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

  resetPeriodFilter() {
    this.periodStartDate = null;
    this.periodEndDate = null;
    this.applyPeriodFilter();
  }

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

  getProjectNameStyle(task: Task) {
    const themeColor = task.projectThemeColor || this.defaultThemeColor;

    return {
      'border-left': `6px solid ${themeColor}`,
      'padding-left': '8px',
    };
  }

  // ⬇️ この下に追加
  openPeriodDialog() {
    const dialogRef = this.dialog.open(PeriodFilterDialogComponent, {
      width: '500px',
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

  /** ✅ タスク一覧をCSV形式で出力 */
  exportToCSV() {
    if (!this.memberDetail) return;

    const tasks = this.filteredTasks.length
      ? this.filteredTasks
      : this.memberDetail.tasks;

    if (!tasks.length) {
      alert('出力できるタスクがありません。');
      return;
    }

    const header = [
      'プロジェクト名',
      'タスク名',
      'ステータス',
      '優先度',
      '期日',
    ];
    const csvRows = tasks.map((task) => [
      `"${task.projectName || ''}"`,
      `"${task.taskName || ''}"`,
      `"${task.status || ''}"`,
      `"${task.priority || ''}"`,
      `"${task.dueDate || ''}"`,
    ]);

    const csvContent = [header, ...csvRows].map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;

    const fileName = `${this.memberDetail.name}_tasks.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ CSV出力完了:', fileName);
  }

  goBack() {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/progress/members']);
    }
  }
}
