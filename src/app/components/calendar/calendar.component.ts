import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ProjectSelectionService } from '../../services/project-selection.service';
import { OfflineService } from '../../services/offline.service';
import { Task } from '../../models/task.model';
import { IProject } from '../../models/project.model';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatChipsModule,
    MatMenuModule,
    MatButtonToggleModule,
    MatSnackBarModule,
    FormsModule,
  ],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css'],
})
export class CalendarComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  projects: IProject[] = [];
  selectedProjectIds: string[] = [];
  allTasks: Task[] = [];
  isOnline = true;
  private destroy$ = new Subject<void>();

  // カレンダー表示用
  currentDate: Date = new Date();
  calendarDays: Date[] = [];
  weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  // 表示モード
  viewMode: 'day' | 'week' | 'month' = 'month';
  selectedDate: Date | null = null;

  // フィルター用
  filterPriority: string[] = [];
  filterAssignee: string[] = [];
  filterStatus: string[] = [];

  // ステータス色
  statusColors: { [key: string]: string } = {
    未着手: '#fdd6d5',
    作業中: '#fef6c3',
    完了: '#b2e9cb',
  };

  statusTextColors: { [key: string]: string } = {
    未着手: '#000000',
    作業中: '#000000',
    完了: '#000000',
  };

  // マイルストーン
  allMilestones: any[] = [];

  // ツールチップ
  tooltipVisible: boolean = false;
  tooltipPosition: { x: number; y: number } = { x: 0, y: 0 };
  tooltipMilestone: any = null;

  constructor(
    private projectService: ProjectService,
    private projectSelectionService: ProjectSelectionService,
    private router: Router,
    private offlineService: OfflineService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.generateCalendarDays();
    this.loadProjects();

    // オフライン状態を監視
    this.offlineService.isOnline$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isOnline) => {
        this.isOnline = isOnline;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** カレンダーの日付を生成 */
  generateCalendarDays() {
    this.calendarDays = [];

    if (this.viewMode === 'day') {
      // 日表示：当日のみ
      this.calendarDays = [new Date(this.currentDate)];
    } else if (this.viewMode === 'week') {
      // 週表示：現在の週の7日間
      const startOfWeek = new Date(this.currentDate);
      startOfWeek.setDate(
        this.currentDate.getDate() - this.currentDate.getDay()
      );

      for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        this.calendarDays.push(day);
      }
    } else {
      // 月表示：月のカレンダー
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();

      // 月の最初の日
      const firstDay = new Date(year, month, 1);
      // カレンダーの開始日（前月の日付も含む）
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - firstDay.getDay());

      // カレンダーの終了日（6週間分）
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 41); // 6週間分

      const current = new Date(startDate);
      while (current <= endDate) {
        this.calendarDays.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    }
  }

  /** プロジェクト一覧を読み込み */
  loadProjects() {
    this.projectService.getProjects().subscribe((projects) => {
      this.projects = projects;
      this.loadAllTasks();
      this.loadAllMilestones();

      // 保存されているプロジェクト選択状態を復元
      this.selectedProjectIds =
        this.projectSelectionService.getSelectedProjectIdsSync();

      // 保存された選択がない場合は、最初のプロジェクトを選択
      if (this.selectedProjectIds.length === 0) {
        const appProject = projects.find(
          (p) => p.projectName === 'アプリ A改善プロジェクト'
        );
        if (appProject) {
          this.selectedProjectIds = [appProject.id];
          this.projectSelectionService.setSelectedProjectIds(
            this.selectedProjectIds
          );
        }
      }

      this.filterTasksBySelectedProjects();
    });

    // プロジェクト選択状態の変更を監視
    this.projectSelectionService
      .getSelectedProjectIds()
      .subscribe((projectIds: string[]) => {
        this.selectedProjectIds = projectIds;
        this.filterTasksBySelectedProjects();
      });
  }

  /** 全プロジェクトのタスクを読み込み */
  loadAllTasks() {
    this.allTasks = [];
    this.projects.forEach((project) => {
      if (project.id) {
        this.projectService
          .getTasksByProjectId(project.id)
          .subscribe((tasks) => {
            const tasksWithProject = tasks.map((task) => ({
              ...task,
              projectId: task.projectId || project.id!,
              projectName: task.projectName || project.projectName,
            }));

            this.allTasks = this.allTasks.filter(
              (t) => t.projectId !== project.id
            );
            this.allTasks = [...this.allTasks, ...tasksWithProject];
            this.filterTasksBySelectedProjects();
          });
      }
    });
  }

  /** 全プロジェクトのマイルストーンを読み込み */
  loadAllMilestones() {
    this.allMilestones = [];
    this.projects.forEach((project) => {
      if (project.milestones && project.milestones.length > 0) {
        project.milestones.forEach((milestone) => {
          this.allMilestones.push({
            ...milestone,
            projectId: project.id,
            projectName: project.projectName,
          });
        });
      }
    });
  }

  /** 選択されたプロジェクトのタスクをフィルタリング */
  filterTasksBySelectedProjects() {
    this.applyFilters();
  }

  /** フィルターを適用 */
  applyFilters() {
    let filteredTasks = this.selectedProjectIds.length
      ? this.allTasks.filter((task) =>
          this.selectedProjectIds.includes(task.projectId)
        )
      : [];

    if (this.filterPriority.length > 0) {
      filteredTasks = filteredTasks.filter(
        (task) => this.filterPriority.includes(task.priority)
      );
    }
    if (this.filterAssignee.length > 0) {
      filteredTasks = filteredTasks.filter(
        (task) => this.filterAssignee.includes(task.assignee)
      );
    }
    if (this.filterStatus.length > 0) {
      filteredTasks = filteredTasks.filter(
        (task) => this.filterStatus.includes(task.status)
      );
    }

    this.tasks = filteredTasks;
  }

  /** プロジェクト選択をトグル */
  toggleProjectSelection(projectId: string) {
    this.projectSelectionService.toggleProjectSelection(projectId);
  }

  /** プロジェクトをすべて選択 */
  selectAllProjects() {
    const allIds = this.projects
      .map((project) => project.id)
      .filter((id): id is string => !!id);
    this.selectedProjectIds = allIds;
    this.projectSelectionService.setSelectedProjectIds(allIds);
  }

  /** プロジェクト選択を全て解除 */
  clearProjectSelection() {
    this.selectedProjectIds = [];
    this.projectSelectionService.clearSelection();
  }

  /** プロジェクトが選択されているかチェック */
  isProjectSelected(projectId: string): boolean {
    return this.selectedProjectIds.includes(projectId);
  }

  /** プロジェクトIDからプロジェクト名を取得 */
  getProjectName(projectId: string): string {
    const project = this.projects.find((p) => p.id === projectId);
    return project ? project.projectName : '';
  }

  /** 指定された日付のタスクを取得（期限ベース） */
  getTasksForDate(date: Date): Task[] {
    return this.tasks.filter((task) => {
      // 期限日でフィルタリング
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      if (!dueDate) return false;

      // 日付が一致するかチェック
      return dueDate.toDateString() === date.toDateString();
    });
  }

  /** 日付が今日かチェック */
  isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  /** 日付が現在の月かチェック */
  isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.currentDate.getMonth();
  }

  /** 日付を変更 */
  changeDate(direction: number) {
    if (this.viewMode === 'day') {
      this.currentDate.setDate(this.currentDate.getDate() + direction);
    } else if (this.viewMode === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() + direction * 7);
    } else {
      this.currentDate.setMonth(this.currentDate.getMonth() + direction);
    }
    if (this.selectedDate) {
      this.selectedDate = new Date(this.currentDate);
    }
    this.generateCalendarDays();
  }

  /** 現在の日付に戻る */
  goToCurrentDate() {
    this.currentDate = new Date();
    if (this.selectedDate) {
      this.selectedDate = new Date(this.currentDate);
    }
    this.generateCalendarDays();
  }

  /** 表示モードを変更 */
  changeViewMode(mode: 'day' | 'week' | 'month') {
    this.viewMode = mode;
    if (this.selectedDate) {
      this.currentDate = new Date(this.selectedDate);
    }
    this.generateCalendarDays();
  }

  /** 日付が選択中かチェック */
  isSelectedDate(date: Date): boolean {
    return !!this.selectedDate
      ? date.toDateString() === this.selectedDate.toDateString()
      : false;
  }

  /** 日付を選択 */
  onDateSelected(date: Date) {
    this.selectedDate = new Date(date);
    this.currentDate = new Date(date);
    this.generateCalendarDays();
  }

  /** 表示名を取得 */
  getDisplayName(): string {
    if (this.viewMode === 'day') {
      return this.currentDate.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } else if (this.viewMode === 'week') {
      const startOfWeek = new Date(this.currentDate);
      startOfWeek.setDate(
        this.currentDate.getDate() - this.currentDate.getDay()
      );
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      return `${startOfWeek.toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric',
      })} - ${endOfWeek.toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric',
      })}`;
    } else {
      return this.currentDate.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
      });
    }
  }

  /** プロジェクト作成ダイアログを開く */
  openProjectDialog() {
    this.router.navigate(['/project-form'], {
      state: { returnUrl: this.router.url },
    });
  }

  /** フィルターをリセット */
  resetFilters() {
    this.filterPriority = [];
    this.filterAssignee = [];
    this.filterStatus = [];
    this.filterTasksBySelectedProjects();
  }

  /** ユニークな担当者一覧を取得 */
  getUniqueAssignees(): string[] {
    const assignees = [
      ...new Set(
        this.allTasks
          .map((task) => task.assignee)
          .filter((assignee) => assignee)
      ),
    ];
    return assignees;
  }

  /** タスク詳細画面に遷移 */
  openTaskDetail(task: Task) {
    console.log('タスク詳細画面に遷移:', task);
    if (task.projectId && task.id) {
      this.router.navigate(['/project', task.projectId, 'task', task.id]);
    } else {
      console.error('タスクのprojectIdまたはidが不足しています:', {
        projectId: task.projectId,
        id: task.id,
        task: task,
      });
    }
  }

  /** 指定された日付にマイルストーンがあるかチェック */
  getMilestonesForDate(date: Date): any[] {
    const dateStr = date.toISOString().split('T')[0];
    return this.allMilestones.filter((milestone) => milestone.date === dateStr);
  }

  /** マイルストーンツールチップを表示 */
  showMilestoneTooltip(event: MouseEvent, milestone: any) {
    this.tooltipMilestone = milestone;
    this.tooltipPosition = {
      x: event.clientX + 10,
      y: event.clientY - 10,
    };
    this.tooltipVisible = true;
  }

  /** マイルストーンツールチップを非表示 */
  hideMilestoneTooltip() {
    this.tooltipVisible = false;
    this.tooltipMilestone = null;
  }

  /** オフライン時のタスク追加ダイアログを開く */
  openOfflineTaskDialog() {
    this.snackBar.open(
      'オフライン時は簡易的なタスク追加のみ可能です。オンライン復帰後に詳細な編集ができます。',
      '閉じる',
      {
        duration: 5000,
        panelClass: ['info-snackbar'],
      }
    );

    // 簡易的なタスク追加フォームを表示
    const taskName = prompt('タスク名を入力してください:');
    if (taskName) {
      const dueDate = prompt('期日を入力してください (YYYY-MM-DD):');
      if (dueDate) {
        // ローカルストレージに保存（オフライン時の一時保存）
        this.saveOfflineTask(taskName, dueDate);
      }
    }
  }

  /** オフライン時のタスクをローカルストレージに保存 */
  private saveOfflineTask(taskName: string, dueDate: string) {
    const offlineTasks = JSON.parse(
      localStorage.getItem('offlineTasks') || '[]'
    );
    const newTask = {
      id: 'offline_' + Date.now(),
      taskName: taskName,
      dueDate: dueDate,
      status: '未着手',
      priority: '中',
      assignee: '未設定',
      projectName: 'オフラインタスク',
      createdAt: new Date().toISOString(),
      isOffline: true,
    };

    offlineTasks.push(newTask);
    localStorage.setItem('offlineTasks', JSON.stringify(offlineTasks));

    this.snackBar.open(
      'タスクをオフラインで保存しました。オンライン復帰後に同期されます。',
      '閉じる',
      { duration: 3000 }
    );
  }
}
