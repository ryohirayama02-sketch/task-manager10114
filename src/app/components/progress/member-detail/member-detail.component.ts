import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  HostListener,
  ChangeDetectorRef,
  AfterViewInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
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
import { MatInputModule } from '@angular/material/input';
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
import { MemberManagementService } from '../../../services/member-management.service';
import { Member } from '../../../models/member.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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
    MatInputModule,
    FormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    TranslatePipe,
  ],
  templateUrl: './member-detail.component.html',
  styleUrls: ['./member-detail.component.css'],
})
export class MemberDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private location = inject(Location);
  private dialog = inject(MatDialog);
  private languageService = inject(LanguageService);
  private memberManagementService = inject(MemberManagementService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  @ViewChild('tasksTable', { static: false }) tasksTable?: ElementRef;

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
  private allMembers: Member[] = []; // メンバー一覧

  periodStartDate: Date | null = null;
  periodEndDate: Date | null = null;
  periodStartDateObj: Date | null = null; // Material date picker用
  periodEndDateObj: Date | null = null; // Material date picker用
  maxDate = new Date(9999, 11, 31); // 9999-12-31

  ngOnInit() {
    const memberName = this.route.snapshot.paramMap.get('memberName');
    // ✅ 修正: memberNameがnull/undefinedの場合のチェックを追加
    if (memberName) {
      this.loadMemberDetail(memberName);
    } else {
      console.error('メンバー名が指定されていません');
      this.isLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMemberDetail(memberName: string) {
    // ✅ 修正: memberNameがnull/undefinedの場合のチェックを追加
    if (!memberName) {
      console.error('メンバー名が指定されていません');
      this.isLoading = false;
      return;
    }
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    this.isLoading = true;
    console.log('メンバー詳細を読み込み中:', memberName);

    // メンバー一覧を読み込み
    this.memberManagementService
      .getMembers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (members) => {
          // ✅ 修正: コンポーネントが破棄されていないかチェック
          if (this.destroy$.closed) {
            return;
          }
          // ✅ 修正: membersが配列でない場合の処理を追加
          if (!Array.isArray(members)) {
            console.error('membersが配列ではありません:', members);
            this.allMembers = [];
            this.loadProjectsAndTasks(memberName);
            return;
          }
          this.allMembers = members;
          console.log('メンバー一覧を読み込みました:', members.length, '件');
          this.loadProjectsAndTasks(memberName);
        },
        error: (error) => {
          // ✅ 修正: コンポーネントが破棄されていないかチェック
          if (this.destroy$.closed) {
            return;
          }
          console.error('メンバー一覧の読み込みエラー:', error);
          this.allMembers = [];
          this.loadProjectsAndTasks(memberName);
        },
      });
  }

  private loadProjectsAndTasks(memberName: string) {
    // ✅ 修正: memberNameがnull/undefinedの場合のチェックを追加
    if (!memberName) {
      console.error('メンバー名が指定されていません');
      this.isLoading = false;
      return;
    }
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    this.projectService
      .getProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe((projects) => {
        // ✅ 修正: コンポーネントが破棄されていないかチェック
        if (this.destroy$.closed) {
          return;
        }
        // ✅ 修正: projectsが配列でない場合の処理を追加
        if (!Array.isArray(projects)) {
          console.error('projectsが配列ではありません:', projects);
          this.isLoading = false;
          return;
        }
        if (projects.length === 0) {
          this.isLoading = false;
          return;
        }

        this.projectMap = projects.reduce((acc, project) => {
          // ✅ 修正: projectがnull/undefinedの場合のチェックを追加
          if (project && project.id) {
            acc[project.id] = project;
          }
          return acc;
        }, {} as Record<string, any>);

        const allTasks: Task[] = [];
        let completedRequests = 0;
        let hasProcessed = false; // ✅ 修正: 重複処理を防ぐフラグ

        projects.forEach((project) => {
          // ✅ 修正: projectがnull/undefinedの場合のチェックを追加
          if (!project) {
            completedRequests++;
            if (completedRequests === projects.length && !hasProcessed) {
              hasProcessed = true;
              this.processMemberDetail(memberName, allTasks);
            }
            return;
          }
          if (project.id) {
            this.projectService
              .getTasksByProjectId(project.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (tasks) => {
                  // ✅ 修正: コンポーネントが破棄されていないかチェック
                  if (this.destroy$.closed) {
                    return;
                  }
                  // ✅ 修正: 重複処理を防ぐ
                  if (hasProcessed) {
                    return;
                  }
                  // ✅ 修正: tasksが配列でない場合の処理を追加
                  if (Array.isArray(tasks)) {
                    allTasks.push(...tasks);
                  }
                  completedRequests++;

                  if (completedRequests === projects.length && !hasProcessed) {
                    hasProcessed = true;
                    this.processMemberDetail(memberName, allTasks);
                  }
                },
                error: (error) => {
                  // ✅ 修正: エラーが発生した場合もカウントを進める
                  console.error(`プロジェクト ${project.id} のタスク取得エラー:`, error);
                  if (this.destroy$.closed) {
                    return;
                  }
                  if (hasProcessed) {
                    return;
                  }
                  completedRequests++;
                  if (completedRequests === projects.length && !hasProcessed) {
                    hasProcessed = true;
                    this.processMemberDetail(memberName, allTasks);
                  }
                },
              });
          } else {
            completedRequests++;
            if (completedRequests === projects.length && !hasProcessed) {
              hasProcessed = true;
              this.processMemberDetail(memberName, allTasks);
            }
          }
        });
      });
  }

  // ✅ カンマ区切り対応版（全メンバー進捗と同等仕様）
  processMemberDetail(memberName: string, allTasks: Task[]) {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    // ✅ 修正: memberNameがnull/undefinedの場合のチェックを追加
    if (!memberName) {
      console.error('メンバー名が指定されていません');
      this.isLoading = false;
      return;
    }
    // ✅ 修正: allTasksが配列でない場合の処理を追加
    if (!Array.isArray(allTasks)) {
      console.error('allTasksが配列ではありません:', allTasks);
      this.isLoading = false;
      return;
    }
    // ✅ 修正: allMembersが配列でない場合の処理を追加
    if (!Array.isArray(this.allMembers)) {
      console.error('this.allMembersが配列ではありません:', this.allMembers);
      this.allMembers = [];
    }
    console.log('全タスク:', allTasks);

    const filteredTasks: Task[] = [];

    allTasks.forEach((task) => {
      // ✅ 修正: taskがnull/undefinedの場合のチェックを追加
      if (!task) {
        return;
      }
      let assignees: string[] = [];

      // assignee から名前を取得（メンバー管理画面に存在する名前のみ）
      if (task.assignee && typeof task.assignee === 'string') {
        const assigneeNames = task.assignee
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n.length > 0)
          .filter((name) => {
            // メンバー管理画面に存在する名前のみを追加
            return this.allMembers.some((m) => m && m.name === name);
          });
        assignees.push(...assigneeNames);
      }

      // assignedMembers からメンバー名を取得（IDベースで判断）
      if (task.assignedMembers && Array.isArray(task.assignedMembers) && task.assignedMembers.length > 0) {
        task.assignedMembers.forEach((memberId) => {
          // ✅ 修正: memberIdがnull/undefinedの場合のチェックを追加
          if (!memberId) {
            return;
          }
          // メンバーIDからメンバー名を取得
          const member = this.allMembers.find((m) => m && m.id === memberId);
          if (member && member.name) {
            // IDベースで1人として扱う（メンバー名にカンマは含まれない）
            assignees.push(member.name);
          }
        });
      }

      // 重複を削除
      assignees = [...new Set(assignees)];

      if (assignees.includes(memberName)) {
        filteredTasks.push(task);
      }
    });

    this.projectNameToId = {};
    const memberTasks = filteredTasks
      .filter((task) => task != null) // ✅ 修正: null/undefinedのタスクをフィルタリング
      .map((task) => {
        const project = task.projectId ? this.projectMap[task.projectId] : null;
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
      // ✅ 修正: タスクが0件の場合でもfilteredTasksを初期化し、applyTaskFiltersを呼ぶ
      this.memberDetail = {
        name: memberName,
        projects: [],
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        notStartedTasks: 0,
        completionRate: 0,
        tasks: [],
        completedByPriority: { high: 0, medium: 0, low: 0 },
        inProgressByPriority: { high: 0, medium: 0, low: 0 },
        notStartedByPriority: { high: 0, medium: 0, low: 0 },
      };
      this.filteredTasks = [];
      this.isLoading = false;
      return;
    }

    const projects = [...new Set(memberTasks.map((task) => task.projectName).filter((name) => name != null))];

    // ✅ 修正: statusが文字列でない場合のチェックを追加
    const completedTasks = memberTasks.filter((t) => t && typeof t.status === 'string' && t.status === '完了');
    const inProgressTasks = memberTasks.filter((t) => t && typeof t.status === 'string' && t.status === '作業中');
    const notStartedTasks = memberTasks.filter((t) => t && typeof t.status === 'string' && t.status === '未着手');

    // ✅ 修正: completionRateの計算を安全に（NaNや無限大を防ぐ）
    let completionRate = 0;
    if (memberTasks.length > 0 && completedTasks.length >= 0) {
      const rate = (completedTasks.length / memberTasks.length) * 100;
      completionRate = isNaN(rate) || !isFinite(rate) ? 0 : Math.round(rate);
      // 0-100の範囲にクランプ
      completionRate = Math.max(0, Math.min(100, completionRate));
    }

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

  navigateToProject(projectName: string | null | undefined, event?: Event) {
    // ✅ 修正: projectNameがnull/undefinedの場合のチェックを追加
    if (!projectName) {
      console.error('プロジェクト名が指定されていません');
      return;
    }
    event?.preventDefault();
    event?.stopPropagation();
    const projectId = this.projectNameToId[projectName];
    if (!projectId) {
      console.error('プロジェクトIDが見つかりません:', projectName);
      return;
    }
    this.router.navigate(['/project', projectId]);
  }

  navigateToTask(task: Task | null | undefined, event?: Event) {
    // ✅ 修正: taskがnull/undefinedの場合のチェックを追加
    if (!task) {
      console.error('タスクが指定されていません');
      return;
    }
    event?.preventDefault();
    event?.stopPropagation();
    const projectId =
      task.projectId || (task.projectName ? this.projectNameToId[task.projectName] : null) || null;
    if (!projectId) {
      console.error('プロジェクトIDが見つかりません:', task.projectName);
      return;
    }
    if (!task.id) {
      this.router.navigate(['/project', projectId]);
      return;
    }
    this.router.navigate(['/project', projectId, 'task', task.id]);
  }

  applyTaskFilters() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    if (!this.memberDetail) return;
    // ✅ 修正: memberDetail.tasksが配列でない場合の処理を追加
    if (!Array.isArray(this.memberDetail.tasks)) {
      console.error('memberDetail.tasksが配列ではありません:', this.memberDetail.tasks);
      this.filteredTasks = [];
      return;
    }
    let filtered = [...this.memberDetail.tasks];

    // 期間フィルターを適用
    if (this.periodStartDate || this.periodEndDate) {
      filtered = filtered.filter((task) => {
        // ✅ 修正: taskがnull/undefinedの場合のチェックを追加
        if (!task) {
          return false;
        }
        // ✅ 修正: task.dueDateがnull/undefined/空文字列の場合のチェックを追加
        if (!task.dueDate || (typeof task.dueDate === 'string' && task.dueDate.trim() === '')) {
          return false;
        }
        const dueDate = new Date(task.dueDate);
        if (isNaN(dueDate.getTime())) {
          return false;
        }

        // 日付のみを比較（時刻を00:00:00にリセット）
        const dueDateOnly = this.getDateOnly(dueDate);
        const startDateOnly = this.periodStartDate && !isNaN(this.periodStartDate.getTime())
          ? this.getDateOnly(this.periodStartDate)
          : null;
        const endDateOnly = this.periodEndDate && !isNaN(this.periodEndDate.getTime())
          ? this.getDateOnly(this.periodEndDate)
          : null;

        const afterStart = startDateOnly ? dueDateOnly >= startDateOnly : true;
        const beforeEnd = endDateOnly ? dueDateOnly <= endDateOnly : true;
        return afterStart && beforeEnd;
      });
    }

    // ✅ 修正: filterProjectsが配列でない場合のチェックを追加
    if (this.filterProjects.length > 0 && Array.isArray(this.filterProjects)) {
      filtered = filtered.filter((task) =>
        task && task.projectName && this.filterProjects.includes(task.projectName)
      );
    }
    // ✅ 修正: filterStatusが配列でない場合のチェックを追加
    if (this.filterStatus.length > 0 && Array.isArray(this.filterStatus)) {
      filtered = filtered.filter((task) =>
        task && task.status && this.filterStatus.includes(task.status)
      );
    }
    // ✅ 修正: filterPriorityが配列でない場合のチェックを追加
    if (this.filterPriority.length > 0 && Array.isArray(this.filterPriority)) {
      filtered = filtered.filter((task) =>
        task && task.priority && this.filterPriority.includes(task.priority)
      );
    }
    if (this.filterDueDateSort === 'near') {
      filtered.sort((a, b) => {
        // ✅ 修正: aまたはbがnull/undefinedの場合のチェックを追加
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        const dateA = a.dueDate ? (() => {
          const date = new Date(a.dueDate);
          return isNaN(date.getTime()) ? Infinity : date.getTime();
        })() : Infinity;
        const dateB = b.dueDate ? (() => {
          const date = new Date(b.dueDate);
          return isNaN(date.getTime()) ? Infinity : date.getTime();
        })() : Infinity;
        return dateA - dateB;
      });
    } else if (this.filterDueDateSort === 'far') {
      filtered.sort((a, b) => {
        // ✅ 修正: aまたはbがnull/undefinedの場合のチェックを追加
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        const dateA = a.dueDate ? (() => {
          const date = new Date(a.dueDate);
          return isNaN(date.getTime()) ? -Infinity : date.getTime();
        })() : -Infinity;
        const dateB = b.dueDate ? (() => {
          const date = new Date(b.dueDate);
          return isNaN(date.getTime()) ? -Infinity : date.getTime();
        })() : -Infinity;
        return dateB - dateA;
      });
    }
    // ✅ 修正: filteredが配列でない場合の処理を追加
    if (!Array.isArray(filtered)) {
      console.error('filteredが配列ではありません:', filtered);
      this.filteredTasks = [];
      return;
    }
    this.filteredTasks = filtered;
  }

  resetTaskFilters() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    this.filterProjects = [];
    this.filterStatus = [];
    this.filterPriority = [];
    this.filterDueDateSort = '';
    this.applyTaskFilters();
  }

  /**
   * 日付を時刻を00:00:00にリセットして比較用のDateオブジェクトを作成
   */
  private getDateOnly(date: Date | null | undefined): Date {
    // ✅ 修正: dateがnull/undefinedの場合のチェックを追加
    if (!date || isNaN(date.getTime())) {
      // 無効な日付の場合は現在の日付を使用
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return now;
    }
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    return dateOnly;
  }

  applyPeriodFilter() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    if (!this.memberDetail) return;
    // ✅ 修正: memberDetail.tasksが配列でない場合の処理を追加
    if (!Array.isArray(this.memberDetail.tasks)) {
      console.error('memberDetail.tasksが配列ではありません:', this.memberDetail.tasks);
      return;
    }
    let filteredTasks = this.memberDetail.tasks;
    if (this.periodStartDate || this.periodEndDate) {
      filteredTasks = filteredTasks.filter((task) => {
        // ✅ 修正: taskがnull/undefinedの場合のチェックを追加
        if (!task) {
          return false;
        }
        // ✅ 修正: task.dueDateがnull/undefined/空文字列の場合のチェックを追加
        if (!task.dueDate || (typeof task.dueDate === 'string' && task.dueDate.trim() === '')) {
          return false;
        }
        const dueDate = new Date(task.dueDate);
        if (isNaN(dueDate.getTime())) {
          return false;
        }

        // 日付のみを比較（時刻を00:00:00にリセット）
        const dueDateOnly = this.getDateOnly(dueDate);
        const startDateOnly = this.periodStartDate && !isNaN(this.periodStartDate.getTime())
          ? this.getDateOnly(this.periodStartDate)
          : null;
        const endDateOnly = this.periodEndDate && !isNaN(this.periodEndDate.getTime())
          ? this.getDateOnly(this.periodEndDate)
          : null;

        const afterStart = startDateOnly ? dueDateOnly >= startDateOnly : true;
        const beforeEnd = endDateOnly ? dueDateOnly <= endDateOnly : true;
        return afterStart && beforeEnd;
      });
    }
    // ✅ 修正: statusが文字列でない場合のチェックを追加
    const completedTasks = filteredTasks.filter((t) => t && typeof t.status === 'string' && t.status === '完了');
    const inProgressTasks = filteredTasks.filter((t) => t && typeof t.status === 'string' && t.status === '作業中');
    const notStartedTasks = filteredTasks.filter((t) => t && typeof t.status === 'string' && t.status === '未着手');
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

  /** 期間内完了率を計算 */
  getPeriodCompletionRate(): number {
    if (!this.memberDetail) return 0;
    // ✅ 修正: memberDetail.tasksが配列でない場合の処理を追加
    if (!Array.isArray(this.memberDetail.tasks)) {
      console.error('memberDetail.tasksが配列ではありません:', this.memberDetail.tasks);
      return 0;
    }

    let targetTasks: Task[];

    // 期間が設定されている場合は期間内のタスクをフィルタリング
    if (this.periodStartDate && this.periodEndDate && !isNaN(this.periodStartDate.getTime()) && !isNaN(this.periodEndDate.getTime())) {
      targetTasks = this.memberDetail.tasks.filter((task) => {
        // ✅ 修正: taskがnull/undefinedの場合のチェックを追加
        if (!task) {
          return false;
        }
        // ✅ 修正: task.dueDateがnull/undefined/空文字列の場合のチェックを追加
        if (!task.dueDate || (typeof task.dueDate === 'string' && task.dueDate.trim() === '')) {
          return false;
        }
        const dueDate = new Date(task.dueDate);
        if (isNaN(dueDate.getTime())) {
          return false;
        }

        // 日付のみを比較（時刻を00:00:00にリセット）
        const dueDateOnly = this.getDateOnly(dueDate);
        const startDateOnly = this.getDateOnly(this.periodStartDate);
        const endDateOnly = this.getDateOnly(this.periodEndDate);

        const afterStart = dueDateOnly >= startDateOnly;
        const beforeEnd = dueDateOnly <= endDateOnly;
        return afterStart && beforeEnd;
      });
    } else {
      // 期間が設定されていない場合は全タスクを対象
      targetTasks = this.memberDetail.tasks;
    }

    if (targetTasks.length === 0) return 0;

    // ✅ 修正: statusが文字列でない場合のチェックを追加
    const completedTasks = targetTasks.filter(
      (t) => t && typeof t.status === 'string' && t.status === '完了'
    ).length;
    // ✅ 修正: completionRateの計算を安全に（NaNや無限大を防ぐ）
    if (targetTasks.length === 0) return 0;
    const rate = (completedTasks / targetTasks.length) * 100;
    const completionRate = isNaN(rate) || !isFinite(rate) ? 0 : Math.round(rate);
    return Math.max(0, Math.min(100, completionRate));
  }

  calculatePriorityBreakdown(tasks: Task[]): {
    high: number;
    medium: number;
    low: number;
  } {
    // ✅ 修正: tasksが配列でない場合の処理を追加
    if (!Array.isArray(tasks)) {
      return { high: 0, medium: 0, low: 0 };
    }
    // ✅ 修正: priorityが文字列でない場合のチェックを追加
    return {
      high: tasks.filter((t) => t && typeof t.priority === 'string' && t.priority === '高').length,
      medium: tasks.filter((t) => t && typeof t.priority === 'string' && t.priority === '中').length,
      low: tasks.filter((t) => t && typeof t.priority === 'string' && t.priority === '低').length,
    };
  }

  getStatusColor(status: string | null | undefined): string {
    // ✅ 修正: statusがnull/undefinedの場合のチェックを追加
    if (!status) {
      return '#9e9e9e';
    }
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

  getPriorityColor(priority: string | null | undefined): string {
    // ✅ 修正: priorityがnull/undefinedの場合のチェックを追加
    if (!priority) {
      return '#9e9e9e';
    }
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

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    // リサイズ時に変更検知をトリガー
    this.cdr.detectChanges();
    // セル幅を再チェック
    setTimeout(() => {
      this.checkCellWidth();
    }, 100);
  }

  ngAfterViewInit(): void {
    // ビュー初期化後にセル幅をチェック
    setTimeout(() => {
      this.checkCellWidth();
    }, 0);
  }

  private checkCellWidth(): void {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    // リサイズ時にも呼び出されるようにする
    if (this.tasksTable) {
      // セル幅のチェックはtranslateStatus/translatePriority内で行う
      this.cdr.detectChanges();
    }
  }

  private isCellNarrow(): boolean {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return false;
    }
    if (!this.tasksTable?.nativeElement) {
      // テーブルが存在しない場合はウィンドウ幅で判定
      const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 768;
      return windowWidth <= 768;
    }

    try {
      const table = this.tasksTable.nativeElement;
      const statusHeader = table.querySelector('th.mat-column-status');
      const priorityHeader = table.querySelector('th.mat-column-priority');

      if (statusHeader) {
        const statusRect = statusHeader.getBoundingClientRect();
        // ✅ 修正: statusRectが無効な場合のチェックを追加
        if (statusRect && typeof statusRect.width === 'number' && !isNaN(statusRect.width)) {
          const statusWidth = statusRect.width;
          // セル幅が60px以下の場合は短縮形を使用
          if (statusWidth <= 60) {
            return true;
          }
        }
      }

      if (priorityHeader) {
        const priorityRect = priorityHeader.getBoundingClientRect();
        // ✅ 修正: priorityRectが無効な場合のチェックを追加
        if (priorityRect && typeof priorityRect.width === 'number' && !isNaN(priorityRect.width)) {
          const priorityWidth = priorityRect.width;
          // セル幅が60px以下の場合は短縮形を使用
          if (priorityWidth <= 60) {
            return true;
          }
        }
      }
    } catch (e) {
      // エラーが発生した場合はウィンドウ幅で判定
      const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 768;
      return windowWidth <= 768;
    }

    return false;
  }

  translateStatus(status: string | null | undefined): string {
    // ✅ 修正: statusがnull/undefinedの場合のチェックを追加
    if (!status) {
      return '';
    }
    // セル幅が狭い場合は短縮形を返す
    const isNarrow = this.isCellNarrow();

    if (isNarrow) {
      switch (status) {
        case '完了':
          return 'C';
        case '作業中':
          return 'IP';
        case '未着手':
          return 'NS';
        default:
          return status;
      }
    }

    switch (status) {
      case '完了':
        return this.languageService.translate('progress.status.completed');
      case '作業中':
        return this.languageService.translate('progress.status.inProgress');
      case '未着手':
        return this.languageService.translate('progress.status.notStarted');
      default:
        return status;
    }
  }

  translatePriority(priority: string | null | undefined): string {
    // ✅ 修正: priorityがnull/undefinedの場合のチェックを追加
    if (!priority) {
      return '';
    }
    // セル幅が狭い場合は短縮形を返す
    const isNarrow = this.isCellNarrow();

    if (isNarrow) {
      switch (priority) {
        case '高':
          return 'H';
        case '中':
          return 'M';
        case '低':
          return 'L';
        default:
          return priority;
      }
    }

    switch (priority) {
      case '高':
        return this.languageService.translate('progress.priority.high');
      case '中':
        return this.languageService.translate('progress.priority.medium');
      case '低':
        return this.languageService.translate('progress.priority.low');
      default:
        return priority;
    }
  }

  getProjectNameStyle(task: Task) {
    const themeColor = task.projectThemeColor || this.defaultThemeColor;

    return {
      'border-left': `6px solid ${themeColor}`,
      'padding-left': '8px',
    };
  }

  onPeriodStartDateChange(): void {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    if (this.periodStartDateObj && !isNaN(this.periodStartDateObj.getTime())) {
      this.periodStartDate = this.periodStartDateObj;
    } else {
      this.periodStartDate = null;
    }
    this.applyPeriodFilter();
    this.applyTaskFilters(); // タスク一覧にも期間フィルターを適用
  }

  onPeriodEndDateChange(): void {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    if (this.periodEndDateObj && !isNaN(this.periodEndDateObj.getTime())) {
      this.periodEndDate = this.periodEndDateObj;
    } else {
      this.periodEndDate = null;
    }
    this.applyPeriodFilter();
    this.applyTaskFilters(); // タスク一覧にも期間フィルターを適用
  }

  resetPeriodFilter(): void {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    this.periodStartDateObj = null;
    this.periodEndDateObj = null;
    this.periodStartDate = null;
    this.periodEndDate = null;
    this.applyPeriodFilter();
    this.applyTaskFilters(); // タスク一覧にも期間フィルターを適用
  }

  /** ✅ タスク一覧をCSV形式で出力 */
  exportToCSV() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    if (!this.memberDetail) return;
    // ✅ 修正: memberDetail.tasksが配列でない場合の処理を追加
    if (!Array.isArray(this.memberDetail.tasks)) {
      console.error('memberDetail.tasksが配列ではありません:', this.memberDetail.tasks);
      alert(
        this.languageService.translate('progress.member.filter.noTasksToExport')
      );
      return;
    }

    const tasks = this.filteredTasks.length && Array.isArray(this.filteredTasks)
      ? this.filteredTasks
      : this.memberDetail.tasks;

    if (!tasks.length) {
      alert(
        this.languageService.translate('progress.member.filter.noTasksToExport')
      );
      return;
    }

    const header = [
      this.languageService.translate('progress.member.table.projectName'),
      this.languageService.translate('progress.member.table.taskName'),
      this.languageService.translate('progress.member.table.status'),
      this.languageService.translate('progress.member.table.priority'),
      this.languageService.translate('progress.member.table.dueDate'),
    ];
    const csvRows = tasks
      .filter((task) => task != null) // ✅ 修正: null/undefinedのタスクをフィルタリング
      .map((task) => [
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

    // ✅ 修正: memberDetail.nameがnull/undefinedの場合のチェックを追加
    const memberName = this.memberDetail.name || 'member';
    const fileName = `${memberName}_tasks.csv`;
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
