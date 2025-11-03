import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { ProjectSelectionService } from '../../services/project-selection.service';
import { Task } from '../../models/task.model';
import { IProject } from '../../models/project.model';
import {
  DEFAULT_PROJECT_THEME_COLOR,
  resolveProjectThemeColor,
} from '../../constants/project-theme-colors';
import { TruncateOverflowDirective } from '../../directives/truncate-overflow.directive';

@Component({
  selector: 'app-gantt',
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
    FormsModule,
    TruncateOverflowDirective,
  ],
  templateUrl: './gantt.component.html',
  styleUrls: ['./gantt.component.css'],
})
export class GanttComponent implements OnInit, AfterViewInit, OnDestroy {
  tasks: Task[] = [];
  projects: IProject[] = [];
  selectedProjectIds: string[] = [];
  allTasks: Task[] = [];
  private themeColorByProjectId: Record<string, string> = {};
  readonly defaultThemeColor = DEFAULT_PROJECT_THEME_COLOR;

  // フィルター用
  filterPriority: string[] = [];
  filterAssignee: string[] = [];
  filterStatus: string[] = [];

  // 日付範囲
  startDate: Date = new Date();
  endDate: Date = new Date();
  dateRange: Date[] = [];

  // スクロール位置追跡
  currentScrollLeft: number = 0;

  // 担当者列の動的幅
  assigneeColumnWidth: number = 140;

  // 全体の動的幅
  totalInfoWidth: number = 603;

  // マイルストーン
  allMilestones: any[] = [];

  // ツールチップ
  tooltipVisible: boolean = false;
  tooltipPosition: { x: number; y: number } = { x: 0, y: 0 };
  tooltipMilestones: any[] = [];

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

  // 年月ヘッダー用
  currentYearMonthGroup: any = null;
  yearMonthHeaderStyle: { [key: string]: string } = {};
  @ViewChild('leftPane') leftPane?: ElementRef<HTMLDivElement>;
  @ViewChild('rightPane') rightPane?: ElementRef<HTMLDivElement>;
  @ViewChild('leftHeader') leftHeader?: ElementRef<HTMLDivElement>;
  @ViewChild('rightHeader') rightHeader?: ElementRef<HTMLDivElement>;
  private isSyncingVerticalScroll = false;
  private headerResizeObserver?: ResizeObserver;

  constructor(
    private projectService: ProjectService,
    private projectSelectionService: ProjectSelectionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeDateRange();
    this.loadProjects();
    this.setupScrollSync();
  }

  ngAfterViewInit(): void {
    this.syncVerticalScroll();
    this.initializeHeaderHeightSync();
  }

  ngOnDestroy(): void {
    this.headerResizeObserver?.disconnect();
  }

  /** 日付範囲を初期化 */
  initializeDateRange() {
    const today = new Date();
    this.startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    this.endDate = new Date(today.getFullYear(), today.getMonth() + 3, 0);
    this.generateDateRange();
  }

  private initializeHeaderHeightSync(): void {
    this.updateLeftHeaderHeight();
    // Ensure measurement after view rendering completes
    setTimeout(() => this.updateLeftHeaderHeight());

    const rightHeaderEl = this.rightHeader?.nativeElement;
    if (!rightHeaderEl || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.headerResizeObserver = new ResizeObserver(() => {
      this.updateLeftHeaderHeight();
    });
    this.headerResizeObserver.observe(rightHeaderEl);
  }

  private updateLeftHeaderHeight(): void {
    const leftHeaderEl = this.leftHeader?.nativeElement;
    const rightHeaderEl = this.rightHeader?.nativeElement;
    if (!leftHeaderEl || !rightHeaderEl) {
      return;
    }
    const rightHeaderHeight = rightHeaderEl.offsetHeight;
    if (rightHeaderHeight > 0) {
      leftHeaderEl.style.height = `${rightHeaderHeight}px`;
    }
  }

  /** 日付範囲を生成 */
  generateDateRange() {
    this.dateRange = [];
    const current = new Date(this.startDate);
    while (current <= this.endDate) {
      this.dateRange.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
  }

  /** プロジェクト一覧を読み込み */
  loadProjects() {
    this.projectService.getProjects().subscribe((projects) => {
      this.projects = projects;
      this.updateThemeColorMap();
      this.allTasks = this.allTasks.map((task) => this.withTaskTheme(task));
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
            const themeColor = this.getProjectThemeColor(project.id!);
            const tasksWithProject = tasks.map((task) => ({
              ...task,
              projectId: task.projectId || project.id!,
              projectName: task.projectName || project.projectName,
              projectThemeColor:
                task.projectThemeColor || themeColor,
            }));

            this.allTasks = this.allTasks.filter(
              (t) => t.projectId !== project.id
            );
            const normalizedTasks = tasksWithProject.map((task) =>
              this.withTaskTheme(task)
            );
            this.allTasks = [...this.allTasks, ...normalizedTasks];
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
    // プロジェクト選択が変わったらフィルターをリセットして再適用
    this.applyFilters();
  }

  /** フィルターを適用 */
  applyFilters() {
    let filteredTasks = [...this.allTasks];

    // プロジェクトフィルター
    if (this.selectedProjectIds.length > 0) {
      filteredTasks = filteredTasks.filter((task) =>
        this.selectedProjectIds.includes(task.projectId)
      );
    } else {
      // プロジェクトが選択されていない場合は空配列
      filteredTasks = [];
    }

    // 優先度フィルター
    if (this.filterPriority.length > 0) {
      filteredTasks = filteredTasks.filter(
        (task) => this.filterPriority.includes(task.priority)
      );
    }

    // 担当者フィルター
    if (this.filterAssignee.length > 0) {
      filteredTasks = filteredTasks.filter(
        (task) => this.filterAssignee.includes(task.assignee)
      );
    }

    // ステータスフィルター
    if (this.filterStatus.length > 0) {
      filteredTasks = filteredTasks.filter(
        (task) => this.filterStatus.includes(task.status)
      );
    }

    // フィルター後の結果を表示
    this.tasks = filteredTasks.map((task) => this.withTaskTheme(task));
    this.calculateAssigneeColumnWidth(); // フィルター適用後も担当者列の幅を計算
  }

  /** プロジェクト選択をトグル */
  toggleProjectSelection(projectId: string) {
    this.projectSelectionService.toggleProjectSelection(projectId);
  }

  getProjectNameStyle(task: Task) {
    const color = this.getProjectThemeColor(task.projectId);
    return {
      backgroundColor: color,
      color: '#1f2933',
    };
  }

  getTaskBarBackground(task: Task): string {
    return this.statusColors[task.status] || '#fdd6d5';
  }

  getTaskBarTextColor(task: Task): string {
    return this.statusTextColors[task.status] || '#000000';
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

  private updateThemeColorMap(): void {
    this.themeColorByProjectId = this.projects.reduce((acc, project) => {
      if (project.id) {
        acc[project.id] = resolveProjectThemeColor(project);
      }
      return acc;
    }, {} as Record<string, string>);
  }

  getProjectThemeColor(projectId?: string): string {
    if (!projectId) {
      return this.defaultThemeColor;
    }
    return this.themeColorByProjectId[projectId] || this.defaultThemeColor;
  }

  private withTaskTheme(task: Task): Task {
    const color = this.getProjectThemeColor(task.projectId);
    return {
      ...task,
      projectThemeColor: color,
    };
  }

  /** タスクの開始日を取得 */
  getTaskStartDate(task: Task): Date {
    return task.startDate ? new Date(task.startDate) : new Date();
  }

  /** タスクの終了日を取得 */
  getTaskEndDate(task: Task): Date {
    return task.dueDate ? new Date(task.dueDate) : new Date();
  }

  /** タスクの期間を計算 */
  getTaskDuration(task: Task): number {
    const start = this.getTaskStartDate(task);
    const end = this.getTaskEndDate(task);
    return (
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
  }

  /** タスクの開始位置を計算 */
  getTaskStartPosition(task: Task): number {
    const start = this.getTaskStartDate(task);
    const daysDiff = Math.floor(
      (start.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, daysDiff);
  }

  /** 日付をフォーマット */
  formatDate(date: Date): string {
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  }

  /** 年月をフォーマット */
  formatYearMonth(date: Date): string {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
    });
  }

  /** 日付のみをフォーマット */
  formatDay(date: Date): string {
    return date.getDate().toString();
  }

  /** 日付範囲を年月でグループ化 */
  getGroupedDates(): {
    yearMonth: string;
    dates: Date[];
    startIndex: number;
    endIndex: number;
  }[] {
    const groups: { [key: string]: Date[] } = {};

    this.dateRange.forEach((date) => {
      const key = this.formatYearMonth(date);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(date);
    });

    let currentIndex = 0;
    return Object.keys(groups).map((yearMonth) => {
      const dates = groups[yearMonth];
      const startIndex = currentIndex;
      const endIndex = currentIndex + dates.length - 1;
      currentIndex += dates.length;

      return {
        yearMonth,
        dates,
        startIndex,
        endIndex,
      };
    });
  }

  /** 年月ヘッダーの表示位置を計算 */
  getYearMonthPosition(group: { startIndex: number; endIndex: number }): {
    left: string;
    width: string;
    display: string;
  } {
    const cellWidth = 30; // 1日 = 30px
    const left = group.startIndex * cellWidth;
    const width = (group.endIndex - group.startIndex + 1) * cellWidth;

    return {
      left: left + 'px',
      width: width + 'px',
      display: 'block',
    };
  }

  /** 年月ラベルの幅を計算 */
  getYearMonthLabelWidth(group: any): number {
    const cellWidth = 30; // 1日 = 30px
    return group.dates.length * cellWidth;
  }

  /** 現在表示されている年月を取得 */
  getVisibleYearMonth(): string {
    if (!this.currentYearMonthGroup) {
      return this.getGroupedDates()[0]?.yearMonth || '';
    }
    return this.currentYearMonthGroup.yearMonth;
  }

  /** 現在のスクロール位置に基づいて表示年月を更新 */
  updateVisibleYearMonth(): void {
    const scrollLeft = this.currentScrollLeft;
    const cellWidth = 30;

    // スクロール位置の中央付近の日付インデックスを計算
    const visibleCenterIndex = Math.floor(scrollLeft / cellWidth) + 5;

    // どの年月グループに該当するかを検索
    const groups = this.getGroupedDates();
    for (const group of groups) {
      if (
        visibleCenterIndex >= group.startIndex &&
        visibleCenterIndex <= group.endIndex
      ) {
        this.currentYearMonthGroup = group;
        break;
      }
    }

    // グループが見つからない場合は最後のグループを使用
    if (!this.currentYearMonthGroup && groups.length > 0) {
      this.currentYearMonthGroup = groups[groups.length - 1];
    }
  }

  /** 現在のスクロール位置を取得 */
  private getCurrentScrollLeft(): number {
    return this.currentScrollLeft;
  }

  /** スクロール位置を更新 */
  updateScrollPosition(scrollLeft: number): void {
    this.currentScrollLeft = scrollLeft;
  }

  /** 担当者列の幅を動的に計算 */
  calculateAssigneeColumnWidth(): void {
    this.assigneeColumnWidth = 140;
    this.calculateTotalInfoWidth();
  }

  /** 全体の情報列幅を計算 */
  calculateTotalInfoWidth(): void {
    // プロジェクト名(200) + タスク名(200) + 優先度(60) + 担当者(固定) + ボーダー(3)
    this.totalInfoWidth = 200 + 200 + 60 + this.assigneeColumnWidth + 3;
  }

  /** マイルストーンの位置を計算 */
  getMilestonePosition(milestone: any): number {
    const milestoneDate = new Date(milestone.date);
    const startDate = new Date(this.startDate);
    const diffTime = milestoneDate.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays * 30; // 1日 = 30px
  }

  /** 指定された日付にマイルストーンがあるかチェック */
  getMilestonesForDate(date: Date): any[] {
    const dateStr = date.toISOString().split('T')[0];
    return this.allMilestones.filter((milestone) => milestone.date === dateStr);
  }

  /** マイルストーンツールチップを表示 */
  showMilestoneTooltip(event: MouseEvent, milestones: any[]) {
    if (!milestones || milestones.length === 0) {
      return;
    }
    this.tooltipMilestones = milestones;
    this.tooltipPosition = {
      x: event.clientX + 10,
      y: event.clientY - 10,
    };
    this.tooltipVisible = true;
  }

  /** マイルストーンツールチップを非表示 */
  hideMilestoneTooltip() {
    this.tooltipVisible = false;
    this.tooltipMilestones = [];
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

  /** 日付がタスクの期間内かチェック */
  isDateInTaskRange(date: Date, task: Task): boolean {
    const taskStart = this.getTaskStartDate(task);
    const taskEnd = this.getTaskEndDate(task);
    return date >= taskStart && date <= taskEnd;
  }

  /** タスクバーの開始位置を計算（ピクセル単位） */
  getTaskBarStartPosition(task: Task): number {
    const taskStart = this.getTaskStartDate(task);
    const daysDiff = Math.floor(
      (taskStart.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, daysDiff * 30); // 1日 = 30px
  }

  /** タスクバーの幅を計算（ピクセル単位） */
  getTaskBarWidth(task: Task): number {
    const taskStart = this.getTaskStartDate(task);
    const taskEnd = this.getTaskEndDate(task);
    const totalDays =
      Math.ceil(
        (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
    return totalDays * 30; // 1日 = 30px
  }

  /** タイムライン高さを算出 */
  getGanttBarsHeight(): number {
    const rowHeight = 40;
    const rowCount = this.tasks.length;
    return rowCount * rowHeight;
  }

  /** タスクヘッダー直下の区切り線位置 */
  getTaskHeaderDividerPosition(): number {
    return 0;
  }

  /** タスク行の区切り線位置を算出 */
  getTaskRowLinePosition(index: number): number {
    const rowHeight = 40;
    return (index + 1) * rowHeight;
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

  /** 左右の縦スクロールを同期 */
  onLeftScroll(): void {
    if (this.isSyncingVerticalScroll) {
      return;
    }
    this.syncVerticalScroll('left');
  }

  onRightScroll(): void {
    if (this.isSyncingVerticalScroll) {
      return;
    }
    this.syncVerticalScroll('right');
  }

  private syncVerticalScroll(origin?: 'left' | 'right'): void {
    const left = this.leftPane?.nativeElement;
    const right = this.rightPane?.nativeElement;
    if (!left || !right) {
      return;
    }
    this.isSyncingVerticalScroll = true;
    const targetScrollTop =
      origin === 'right' ? right.scrollTop : left.scrollTop;
    if (origin === 'right') {
      left.scrollTop = targetScrollTop;
    } else {
      right.scrollTop = targetScrollTop;
    }
    requestAnimationFrame(() => {
      this.isSyncingVerticalScroll = false;
    });
  }

  /** プロジェクト詳細画面に遷移 */
  openProjectDetail(projectId?: string | null) {
    if (projectId) {
      this.router.navigate(['/project', projectId]);
    } else {
      console.error('プロジェクトIDが不足しています');
    }
  }

  /** スクロール同期を設定 */
  setupScrollSync() {
    // DOMが完全に読み込まれた後に実行
    setTimeout(() => {
      const dateHeader = document.querySelector('.date-header') as HTMLElement;
      const ganttBarsColumn = document.querySelector(
        '.gantt-bars-column'
      ) as HTMLElement;

      if (dateHeader && ganttBarsColumn) {
        // 日付ヘッダーのスクロールをガントバー列に同期
        dateHeader.addEventListener('scroll', () => {
          ganttBarsColumn.scrollLeft = dateHeader.scrollLeft;
          this.updateScrollPosition(dateHeader.scrollLeft);
          this.updateVisibleYearMonth(); // スクロール位置が変更されたら年月も更新
        });

        // ガントバー列のスクロールを日付ヘッダーに同期
        ganttBarsColumn.addEventListener('scroll', () => {
          dateHeader.scrollLeft = ganttBarsColumn.scrollLeft;
          this.updateScrollPosition(ganttBarsColumn.scrollLeft);
          this.updateVisibleYearMonth(); // スクロール位置が変更されたら年月も更新
        });
      }
    }, 100);
  }
}
