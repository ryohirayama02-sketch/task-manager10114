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
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AuthService } from '../../services/auth.service';
import { MemberManagementService } from '../../services/member-management.service';
import { Member } from '../../models/member.model';
import { combineLatest, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { getMemberNamesAsString, getMemberNames } from '../../utils/member-utils';
import { LanguageService } from '../../services/language.service';

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
    TranslatePipe,
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
  members: Member[] = []; // メンバー一覧

  // 日付範囲
  startDate: Date = new Date();
  endDate: Date = new Date();
  dateRange: Date[] = [];

  // スクロール位置追跡
  currentScrollLeft: number = 0;

  // 担当者列の動的幅
  assigneeColumnWidth: number = 120;

  // 全体の動的幅
  totalInfoWidth: number = 483;

  // マイルストーン
  allMilestones: any[] = [];

  // ツールチップ
  tooltipVisible: boolean = false;
  tooltipPosition: { x: number; y: number } = { x: 0, y: 0 };
  tooltipMilestones: any[] = [];
  @ViewChild('tooltip', { static: false }) tooltipElement?: ElementRef;

  // ステータス色（日本語キーを保持して後方互換性を維持）
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

  /** ステータスの値を取得（日本語キーを返す） */
  getStatusValue(key: 'notStarted' | 'inProgress' | 'completed'): string {
    const statusMap: Record<string, string> = {
      notStarted: '未着手',
      inProgress: '作業中',
      completed: '完了',
    };
    return statusMap[key] || key;
  }

  /** 優先度の値を取得（日本語キーを返す） */
  getPriorityValue(key: 'high' | 'medium' | 'low'): string {
    const priorityMap: Record<string, string> = {
      high: '高',
      medium: '中',
      low: '低',
    };
    return priorityMap[key] || key;
  }

  // 年月ヘッダー用
  currentYearMonthGroup: any = null;
  yearMonthHeaderStyle: { [key: string]: string } = {};
  @ViewChild('leftPane') leftPane?: ElementRef<HTMLDivElement>;
  @ViewChild('rightPane') rightPane?: ElementRef<HTMLDivElement>;
  @ViewChild('leftHeader') leftHeader?: ElementRef<HTMLDivElement>;
  @ViewChild('rightHeader') rightHeader?: ElementRef<HTMLDivElement>;
  @ViewChild('timelineContainer') timelineContainer?: ElementRef<HTMLDivElement>;
  private isSyncingVerticalScroll = false;
  private headerResizeObserver?: ResizeObserver;
  private pendingHorizontalScroll: number | null = null;
  private hasUserHorizontalScrolled = false;
  private isApplyingHorizontalScroll = false;
  private timelineScrollListener?: () => void;
  private windowResizeListener?: () => void;

  // 画面幅警告
  isScreenTooNarrow: boolean = false;
  readonly MIN_SCREEN_WIDTH = 750;

  constructor(
    private projectService: ProjectService,
    private projectSelectionService: ProjectSelectionService,
    private router: Router,
    private authService: AuthService,
    private memberManagementService: MemberManagementService,
    private languageService: LanguageService
  ) {}

  ngOnInit(): void {
    // メンバー一覧を読み込み
    this.memberManagementService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
        console.log('Members loaded:', members.length);
      },
      error: (error) => {
        console.error('Failed to load members:', error);
      },
    });

    this.initializeDateRange();
    this.observeUserProjects();
    this.setupScrollSync();
    this.setupScreenWidthWarning();

    this.projectSelectionService
      .getSelectedProjectIds()
      .subscribe((projectIds: string[]) => {
        this.selectedProjectIds = projectIds;
        this.filterTasksBySelectedProjects();
      });
  }

  ngAfterViewInit(): void {
    this.syncVerticalScroll();
    this.initializeHeaderHeightSync();
    this.initializeHorizontalScrollTracking();
    this.applyPendingHorizontalScroll();
    this.checkScreenWidth();
  }

  ngOnDestroy(): void {
    this.headerResizeObserver?.disconnect();
    const container = this.timelineContainer?.nativeElement;
    if (container && this.timelineScrollListener) {
      container.removeEventListener('scroll', this.timelineScrollListener);
    }
    this.timelineScrollListener = undefined;
    
    if (this.windowResizeListener) {
      window.removeEventListener('resize', this.windowResizeListener);
    }
    this.windowResizeListener = undefined;
  }

  /** 日付範囲を初期化 */
  initializeDateRange() {
    this.setDefaultDateRange();
  }

  private setDefaultDateRange(): void {
    const today = new Date();
    this.startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    this.endDate = new Date(today.getFullYear(), today.getMonth() + 3, 0);
    this.generateDateRange();
    this.scheduleScrollToDate(today, !this.hasUserHorizontalScrolled);
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

  private observeUserProjects(): void {
    this.authService.currentUserEmail$
      .pipe(
        switchMap((userEmail) => {
          console.log('🔑 現在のユーザー情報(ガント):', { userEmail });
          if (!userEmail) {
            this.resetProjectState(true);
            return of([]);
          }
          return this.projectService.getProjects();
        })
      )
      .subscribe((projects) => {
        console.log('🎯 ガント用ルーム内全プロジェクト一覧:', projects);
        if (projects.length === 0) {
          this.resetProjectState();
          this.projectSelectionService.clearSelection();
          return;
        }

        this.applyProjectList(projects);
      });
  }

  private applyProjectList(projects: IProject[]): void {
    this.projects = projects;
    this.updateThemeColorMap();

    const storedSelection =
      this.projectSelectionService.getSelectedProjectIdsSync();
    const availableIds = new Set(
      projects
        .map((project) => project.id)
        .filter((id): id is string => !!id)
    );
    let nextSelection = storedSelection.filter((id) =>
      availableIds.has(id)
    );

    if (nextSelection.length === 0) {
      // 保存された選択がない場合は、すべてのプロジェクトを選択
      const allIds = Array.from(availableIds);
      nextSelection = allIds;
    }

    if (nextSelection.length > 0) {
      this.projectSelectionService.setSelectedProjectIds(nextSelection);
    } else {
      this.projectSelectionService.clearSelection();
    }
    this.selectedProjectIds = nextSelection;

    this.loadAllTasks();
    this.loadAllMilestones();
    this.filterTasksBySelectedProjects();
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

    // 担当者フィルター（カンマ区切り対応 + assignedMembers対応）
    if (this.filterAssignee.length > 0) {
      filteredTasks = filteredTasks.filter((task) => {
        const assignees: string[] = [];

        // assignee をカンマで分割（メンバー名のカンマ区切り文字列）
        if (task.assignee) {
          const assigneeNames = task.assignee
            .split(',')
            .map((name) => name.trim())
            .filter((name) => name.length > 0);
          assignees.push(...assigneeNames);
        }

        // assignedMembers も含める（メンバーIDをメンバー名に変換）
        if (Array.isArray(task.assignedMembers) && task.assignedMembers.length > 0) {
          const memberNames = getMemberNames(task.assignedMembers, this.members);
          assignees.push(...memberNames);
        }

        // 担当者がいない場合はフィルターにマッチしない
        if (assignees.length === 0) {
          return false;
        }

        // フィルター値とマッチするか確認（いずれかの担当者がフィルターに含まれていればOK）
        return assignees.some((assignee) =>
          this.filterAssignee.includes(assignee)
        );
      });
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
    this.updateTimelineRange(this.tasks);
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

  private resetProjectState(includeSelection = false): void {
    this.projects = [];
    this.selectedProjectIds = [];
    this.allTasks = [];
    this.tasks = [];
    this.allMilestones = [];
    this.themeColorByProjectId = {};
    if (includeSelection) {
      this.projectSelectionService.clearSelection();
    }
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
    this.assigneeColumnWidth = 120;
    this.calculateTotalInfoWidth();
  }

  /** 全体の情報列幅を計算 */
  calculateTotalInfoWidth(): void {
    // プロジェクト名(150) + タスク名(150) + 優先度(60) + 担当者(固定) + ボーダー(3)
    this.totalInfoWidth = 150 + 150 + 60 + this.assigneeColumnWidth + 3;
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
    // ローカルタイムゾーンで日付文字列を生成（YYYY-MM-DD形式）
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return this.allMilestones.filter((milestone) => milestone.date === dateStr);
  }

  /** マイルストーンツールチップを表示 */
  showMilestoneTooltip(event: MouseEvent, milestones: any[]) {
    if (!milestones || milestones.length === 0) {
      return;
    }
    this.tooltipMilestones = milestones;
    
    // 初期位置を設定
    const tooltipWidth = 250; // max-width
    const padding = 10;
    const margin = 10;
    
    let x = event.clientX + margin;
    let y = event.clientY - margin;
    
    // ウィンドウの境界を取得
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // 右側にはみ出る場合は左側に表示
    if (x + tooltipWidth > windowWidth - padding) {
      x = event.clientX - tooltipWidth - margin;
    }
    
    // 左側にはみ出る場合は右側に表示（最小限のマージンを確保）
    if (x < padding) {
      x = padding;
    }
    
    // 高さは後で調整するため、まずは上方向に配置
    // マイルストーンの数から高さを推定（1項目あたり約60px、ヘッダー約40px）
    const estimatedHeight = 40 + milestones.length * 60;
    
    // 下側にはみ出る場合は上側に表示
    if (y + estimatedHeight > windowHeight - padding) {
      y = event.clientY - estimatedHeight - margin;
    }
    
    // 上側にはみ出る場合は下側に表示
    if (y < padding) {
      y = event.clientY + margin;
    }
    
    this.tooltipPosition = { x, y };
    this.tooltipVisible = true;
    
    // DOMが更新された後に実際のサイズで再調整
    setTimeout(() => {
      this.adjustTooltipPosition(event);
    }, 0);
  }
  
  /** ツールチップの位置を実際のサイズに基づいて調整 */
  adjustTooltipPosition(event: MouseEvent) {
    if (!this.tooltipElement?.nativeElement) {
      return;
    }
    
    const tooltip = this.tooltipElement.nativeElement;
    const tooltipRect = tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const padding = 10;
    const margin = 10;
    
    let x = this.tooltipPosition.x;
    let y = this.tooltipPosition.y;
    
    // 右側にはみ出る場合は左側に表示
    if (tooltipRect.right > windowWidth - padding) {
      x = event.clientX - tooltipRect.width - margin;
    }
    
    // 左側にはみ出る場合は右側に表示
    if (tooltipRect.left < padding) {
      x = padding;
    }
    
    // 下側にはみ出る場合は上側に表示
    if (tooltipRect.bottom > windowHeight - padding) {
      y = event.clientY - tooltipRect.height - margin;
    }
    
    // 上側にはみ出る場合は下側に表示
    if (tooltipRect.top < padding) {
      y = event.clientY + margin;
    }
    
    // 最終的な境界チェック（確実に画面内に収める）
    if (x + tooltipRect.width > windowWidth - padding) {
      x = windowWidth - tooltipRect.width - padding;
    }
    if (x < padding) {
      x = padding;
    }
    if (y + tooltipRect.height > windowHeight - padding) {
      y = windowHeight - tooltipRect.height - padding;
    }
    if (y < padding) {
      y = padding;
    }
    
    this.tooltipPosition = { x, y };
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

  /** ユニークな担当者一覧を取得（メンバー管理画面のメンバー一覧から取得） */
  getUniqueAssignees(): string[] {
    // メンバー管理画面のメンバー一覧から名前を取得
    const memberNames = this.members
      .map((member) => member.name)
      .filter((name) => name && name.trim().length > 0);
    
    // カンマ区切りのメンバー名を分割
    const assigneeSet = new Set<string>();
    memberNames.forEach((name) => {
      const names = name
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n.length > 0);
      names.forEach((n) => assigneeSet.add(n));
    });
    
    return Array.from(assigneeSet).sort();
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

  private updateTimelineRange(tasks: Task[]): void {
    if (!tasks || tasks.length === 0) {
      this.setDefaultDateRange();
      return;
    }

    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    tasks.forEach((task) => {
      const due = task.dueDate ? new Date(task.dueDate) : null;
      const fallbackStart = task.startDate ? new Date(task.startDate) : null;
      const candidate = due && !isNaN(due.getTime())
        ? due
        : fallbackStart && !isNaN(fallbackStart.getTime())
        ? fallbackStart
        : null;

      if (!candidate) {
        return;
      }

      if (!minDate || candidate < minDate) {
        minDate = candidate;
      }
      if (!maxDate || candidate > maxDate) {
        maxDate = candidate;
      }
    });

    if (!minDate || !maxDate) {
      this.setDefaultDateRange();
      return;
    }

    const ensuredMinDate = minDate as Date;
    const ensuredMaxDate = maxDate as Date;

    const paddedStart = new Date(
      ensuredMinDate.getFullYear(),
      ensuredMinDate.getMonth() - 1,
      1
    );
    const paddedEnd = new Date(
      ensuredMaxDate.getFullYear(),
      ensuredMaxDate.getMonth() + 2,
      0
    );

    if (paddedEnd < paddedStart) {
      this.setDefaultDateRange();
      return;
    }

    this.startDate = paddedStart;
    this.endDate = paddedEnd;
    this.generateDateRange();
    this.scheduleScrollToDate(new Date(), !this.hasUserHorizontalScrolled);
  }

  private scheduleScrollToDate(targetDate: Date, force = false): void {
    if (this.hasUserHorizontalScrolled && !force) {
      return;
    }

    if (!targetDate || !this.startDate || !this.endDate) {
      return;
    }

    const startTime = this.startDate.getTime();
    const endTime = this.endDate.getTime();
    const targetTime = targetDate.getTime();
    const clampedTime = Math.min(Math.max(targetTime, startTime), endTime);
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = Math.floor((clampedTime - startTime) / msPerDay);
    this.pendingHorizontalScroll = Math.max(diffDays * 30, 0);

    this.applyPendingHorizontalScroll();
    setTimeout(() => this.applyPendingHorizontalScroll());
  }

  private applyPendingHorizontalScroll(): void {
    if (this.pendingHorizontalScroll === null) {
      return;
    }

    const container = this.timelineContainer?.nativeElement;
    if (!container) {
      return;
    }

    const maxScroll = Math.max(container.scrollWidth - container.clientWidth, 0);
    const targetScrollLeft = Math.min(this.pendingHorizontalScroll, maxScroll);

    this.isApplyingHorizontalScroll = true;
    container.scrollLeft = targetScrollLeft;
    this.updateScrollPosition(targetScrollLeft);
    this.updateVisibleYearMonth();
    this.pendingHorizontalScroll = null;

    requestAnimationFrame(() => {
      this.isApplyingHorizontalScroll = false;
    });
  }

  private initializeHorizontalScrollTracking(): void {
    const container = this.timelineContainer?.nativeElement;
    if (!container) {
      return;
    }

    if (this.timelineScrollListener) {
      container.removeEventListener('scroll', this.timelineScrollListener);
    }

    this.timelineScrollListener = () => {
      if (this.isApplyingHorizontalScroll) {
        return;
      }
      this.hasUserHorizontalScrolled = true;
      this.updateScrollPosition(container.scrollLeft);
      this.updateVisibleYearMonth();
    };

    container.addEventListener('scroll', this.timelineScrollListener);
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
    console.log('Navigating to task detail:', task);
    if (task.projectId && task.id) {
      this.router.navigate(['/project', task.projectId, 'task', task.id]);
    } else {
      console.error(this.languageService.translate('gantt.error.taskProjectIdMissing'), {
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
    const leftMaxScroll = Math.max(left.scrollHeight - left.clientHeight, 0);
    const rightMaxScroll = Math.max(right.scrollHeight - right.clientHeight, 0);
    const maxSharedScroll = Math.min(leftMaxScroll, rightMaxScroll);
    const clampedScrollTop = Math.min(targetScrollTop, maxSharedScroll);
    left.scrollTop = clampedScrollTop;
    right.scrollTop = clampedScrollTop;
    requestAnimationFrame(() => {
      this.isSyncingVerticalScroll = false;
    });
  }

  /** プロジェクト詳細画面に遷移 */
  openProjectDetail(projectId?: string | null) {
    if (projectId) {
      this.router.navigate(['/project', projectId]);
    } else {
      console.error(this.languageService.translate('gantt.error.projectIdMissing'));
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

  /** ステータスを表示（言語設定に応じて） */
  getStatusDisplay(status: string): string {
    const currentLanguage = this.languageService.getCurrentLanguage();
    const statusMap: Record<string, Record<'ja' | 'en', string>> = {
      '未着手': { ja: '未着手', en: 'Not Started' },
      '作業中': { ja: '作業中', en: 'In Progress' },
      '完了': { ja: '完了', en: 'Completed' },
      'notStarted': { ja: '未着手', en: 'Not Started' },
      'inProgress': { ja: '作業中', en: 'In Progress' },
      'completed': { ja: '完了', en: 'Completed' },
    };
    return statusMap[status]?.[currentLanguage] || status;
  }

  /** 優先度を表示（言語設定に応じて） */
  getPriorityDisplay(priority: string): string {
    const currentLanguage = this.languageService.getCurrentLanguage();
    const priorityMap: Record<string, Record<'ja' | 'en', string>> = {
      '高': { ja: '高', en: 'High' },
      '中': { ja: '中', en: 'Medium' },
      '低': { ja: '低', en: 'Low' },
      'high': { ja: '高', en: 'High' },
      'medium': { ja: '中', en: 'Medium' },
      'low': { ja: '低', en: 'Low' },
    };
    return priorityMap[priority]?.[currentLanguage] || priority;
  }

  /** 優先度の短縮形を表示（言語設定に応じて） */
  getPriorityShortDisplay(priority: string): string {
    const currentLanguage = this.languageService.getCurrentLanguage();
    const priorityShortMap: Record<string, Record<'ja' | 'en', string>> = {
      '高': { ja: '高', en: 'H' },
      '中': { ja: '中', en: 'M' },
      '低': { ja: '低', en: 'L' },
      'high': { ja: '高', en: 'H' },
      'medium': { ja: '中', en: 'M' },
      'low': { ja: '低', en: 'L' },
    };
    return priorityShortMap[priority]?.[currentLanguage] || priority;
  }

  /** タスクの担当者を表示（カンマ区切り対応） */
  getTaskAssigneeDisplay(task: Task): string {
    // assignedMembers がある場合はそれを使用
    if (task.assignedMembers && task.assignedMembers.length > 0) {
      // デバッグ: assignedMembersとmembersの内容を確認
      console.log('🔍 [Gantt getTaskAssigneeDisplay] タスク:', task.taskName);
      console.log('   - assignedMembers:', task.assignedMembers);
      console.log('   - this.members:', this.members);
      console.log('   - this.members.length:', this.members.length);

      // 各assignedMembersのUIDがmembersに存在するか確認
      task.assignedMembers.forEach((memberId, index) => {
        const member = this.members.find((m) => m.id === memberId);
        console.log(
          `   - assignedMembers[${index}]: ${memberId} → ${
            member ? member.name : '(見つからない)'
          }`
        );
      });

      const display = getMemberNamesAsString(
        task.assignedMembers,
        this.members,
        ', '
      );
      console.log('   - Display result:', display);
      const notSetText = this.languageService.translate('gantt.notSet');
      return display === notSetText ? '—' : display;
    }

    // assignedMembers がない場合は assignee から最新のメンバー名を取得
    if (!task.assignee) {
      return '—';
    }
    
    // assignee がカンマ区切りの場合を考慮
    const assigneeNames = task.assignee.split(',').map(name => name.trim());
    const updatedNames = assigneeNames
      .map(name => {
        const member = this.members.find((m) => m.name === name);
        return member ? member.name : null;
      })
      .filter((name): name is string => name !== null);
    
    return updatedNames.length > 0 ? updatedNames.join(', ') : '—';
  }

  /** タスクバーのツールチップテキストを取得 */
  getTaskBarTooltip(task: Task): string {
    const statusDisplay = this.getStatusDisplay(task.status);
    const startDate = task.startDate || '';
    const dueDate = task.dueDate || '';
    const currentLanguage = this.languageService.getCurrentLanguage();
    const separator = currentLanguage === 'ja' ? ' ～ ' : ' - ';
    return `${task.taskName} (${statusDisplay}) - ${startDate}${separator}${dueDate}`;
  }

  /** 画面幅警告を設定 */
  private setupScreenWidthWarning(): void {
    this.checkScreenWidth();
    this.windowResizeListener = () => {
      this.checkScreenWidth();
    };
    window.addEventListener('resize', this.windowResizeListener);
  }

  /** 画面幅をチェック */
  private checkScreenWidth(): void {
    this.isScreenTooNarrow = window.innerWidth < this.MIN_SCREEN_WIDTH;
  }
}
