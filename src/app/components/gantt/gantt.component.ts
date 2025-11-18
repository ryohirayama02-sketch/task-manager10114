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
import { combineLatest, of, Subject } from 'rxjs';
import { switchMap, filter, take, takeUntil } from 'rxjs/operators';
import {
  getMemberNamesAsString,
  getMemberNames,
} from '../../utils/member-utils';
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

  // メンバー数チェック
  get hasMembers(): boolean {
    return this.members.length > 0;
  }

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
  private tooltipClickOutsideListener?: (event: Event) => void;

  // ✅ 追加: メモリリーク防止用のSubject
  private destroy$ = new Subject<void>();

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
  @ViewChild('timelineContainer')
  timelineContainer?: ElementRef<HTMLDivElement>;
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
    this.memberManagementService
      .getMembers()
      .pipe(takeUntil(this.destroy$)) // ✅ 追加: メモリリーク防止
      .subscribe({
        next: (members) => {
          // ✅ 修正: コンポーネントが破棄されていないかチェック
          if (this.destroy$.closed) {
            return;
          }
          this.members = members;
          console.log('Members loaded:', members.length);
        },
        error: (error) => {
          // ✅ 修正: コンポーネントが破棄されていないかチェック
          if (this.destroy$.closed) {
            return;
          }
          console.error('Failed to load members:', error);
        },
      });

    this.initializeDateRange();
    this.observeUserProjects();
    this.setupScrollSync();
    this.setupScreenWidthWarning();

    this.projectSelectionService
      .getSelectedProjectIds()
      .pipe(takeUntil(this.destroy$)) // ✅ 追加: メモリリーク防止
      .subscribe((projectIds: string[]) => {
        // ✅ 修正: コンポーネントが破棄されていないかチェック
        if (this.destroy$.closed) {
          return;
        }
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
    // ✅ 追加: メモリリーク防止
    this.destroy$.next();
    this.destroy$.complete();

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

    // ツールチップ外クリックリスナーを削除
    this.removeTooltipClickOutsideListener();
  }

  /** 日付範囲を初期化 */
  initializeDateRange() {
    this.setDefaultDateRange();
  }

  private setDefaultDateRange(): void {
    // 日付選択範囲を設定（当月±3か月）
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // 3か月前の1日
    this.startDate = new Date(currentYear, currentMonth - 3, 1);

    // 3か月後の月末日
    this.endDate = new Date(currentYear, currentMonth + 4, 0); // 翌月の0日 = 今月の月末

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
    // ✅ 修正: startDateとendDateが無効な場合のチェックを追加
    if (!this.startDate || !this.endDate || 
        isNaN(this.startDate.getTime()) || isNaN(this.endDate.getTime())) {
      console.error('日付範囲が無効です:', { startDate: this.startDate, endDate: this.endDate });
      return;
    }
    const current = new Date(this.startDate);
    const end = new Date(this.endDate);
    // ✅ 修正: 無限ループを防ぐため、最大日数を制限（例: 10年）
    const maxDays = 3650;
    let dayCount = 0;
    while (current <= end && dayCount < maxDays) {
      this.dateRange.push(new Date(current));
      current.setDate(current.getDate() + 1);
      dayCount++;
    }
  }

  private observeUserProjects(): void {
    // ✅ 修正: roomIdが設定されるまで待ってから処理を進める（PCとスマホのタイミング差を解消）
    combineLatest([
      this.authService.currentUserEmail$,
      this.authService.currentRoomId$,
    ])
      .pipe(
        filter(([userEmail, roomId]) => {
          return !userEmail || !!roomId; // roomIdがnullの場合は処理をスキップ
        }),
        take(1), // 最初の有効な値のみを使用
        switchMap(([userEmail, roomId]) => {
          console.log('🔑 現在のユーザー情報(ガント):', { userEmail, roomId });
          if (!userEmail || !roomId) {
            this.resetProjectState(true);
            return of([]);
          }
          return this.projectService.getProjects();
        }),
        takeUntil(this.destroy$) // ✅ 追加: メモリリーク防止
      )
      .subscribe({
        next: (projects) => {
          // ✅ 修正: コンポーネントが破棄されていないかチェック
          if (this.destroy$.closed) {
            return;
          }
          console.log('🎯 ガント用ルーム内全プロジェクト一覧:', projects);
          if (projects.length === 0) {
            this.resetProjectState();
            this.projectSelectionService.clearSelection();
            return;
          }

          this.applyProjectList(projects);
        },
        error: (error) => {
          // ✅ 修正: コンポーネントが破棄されていないかチェック
          if (this.destroy$.closed) {
            return;
          }
          console.error('❌ プロジェクト取得エラー（オフライン等）:', error);
          // ✅ 修正: オフライン時などエラーが発生した場合でも、既存のプロジェクトデータを保持
          if (this.projects.length === 0) {
            this.resetProjectState();
            this.projectSelectionService.clearSelection();
          }
        },
      });
  }

  private applyProjectList(projects: IProject[]): void {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    // ✅ 修正: projectsが配列でない場合の処理を追加
    if (!Array.isArray(projects)) {
      console.error('projectsが配列ではありません:', projects);
      return;
    }
    this.projects = projects.filter((project) => project != null); // ✅ 修正: null/undefinedのプロジェクトをフィルタリング
    this.updateThemeColorMap();

    const storedSelection =
      this.projectSelectionService.getSelectedProjectIdsSync();
    const availableIds = new Set(
      this.projects.map((project) => project.id).filter((id): id is string => !!id)
    );
    // ✅ 修正: storedSelectionが配列でない場合の処理を追加
    const validStoredSelection = Array.isArray(storedSelection) ? storedSelection : [];
    let nextSelection = validStoredSelection.filter((id) => availableIds.has(id));

    // 初回起動時（ストレージに保存がない場合）のみ、すべてのプロジェクトを選択
    // ユーザーが意図的にすべてのチェックを外した場合は、空配列のまま保持
    if (
      nextSelection.length === 0 &&
      !this.projectSelectionService.hasStoredSelection()
    ) {
      // 初回起動時のみ、すべてのプロジェクトを選択
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
    // ✅ 修正: loadAllTasks()は非同期処理なので、filterTasksBySelectedProjects()は各タスク読み込み後に呼ばれるため、ここでは呼ばない
  }

  /** 全プロジェクトのタスクを読み込み */
  loadAllTasks() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    // ✅ 修正: projectsが配列でない場合の処理を追加
    if (!Array.isArray(this.projects)) {
      console.error('projectsが配列ではありません:', this.projects);
      return;
    }
    this.allTasks = [];
    this.projects.forEach((project) => {
      if (!project || !project.id) {
        return; // ✅ 修正: null/undefinedのプロジェクトをスキップ
      }
      this.projectService
        .getTasksByProjectId(project.id)
        .pipe(takeUntil(this.destroy$)) // ✅ 追加: メモリリーク防止
        .subscribe({
          next: (tasks) => {
            // ✅ 修正: コンポーネントが破棄されていないかチェック
            if (this.destroy$.closed) {
              return;
            }
            // ✅ 修正: tasksが配列でない場合の処理を追加
            if (!Array.isArray(tasks)) {
              console.error(
                `プロジェクト ${project.id} のタスクが配列ではありません:`,
                tasks
              );
              return;
            }
            const themeColor = this.getProjectThemeColor(project.id);
            const tasksWithProject = tasks
              .filter((task) => task != null) // ✅ 修正: null/undefinedのタスクをフィルタリング
              .map((task) => ({
                ...task,
                projectId: task.projectId || project.id,
                projectName: task.projectName || project.projectName || '',
                projectThemeColor: task.projectThemeColor || themeColor,
              }));

            // ✅ 修正: 競合状態を防ぐため、現在のallTasksのコピーを作成してから操作
            const currentAllTasks = [...this.allTasks];
            const filteredTasks = currentAllTasks.filter(
              (t) => t && t.projectId !== project.id
            );
            const normalizedTasks = tasksWithProject.map((task) =>
              this.withTaskTheme(task)
            );
            // ✅ 修正: 一度に更新することで競合状態を防ぐ
            this.allTasks = [...filteredTasks, ...normalizedTasks];
            this.filterTasksBySelectedProjects();
          },
          error: (error) => {
            // ✅ 修正: コンポーネントが破棄されていないかチェック
            if (this.destroy$.closed) {
              return;
            }
            console.error(
              `プロジェクト ${project.id} のタスク読み込みエラー:`,
              error
            );
          },
        });
    });
  }

  /** 全プロジェクトのマイルストーンを読み込み */
  loadAllMilestones() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    // ✅ 修正: projectsが配列でない場合の処理を追加
    if (!Array.isArray(this.projects)) {
      console.error('projectsが配列ではありません:', this.projects);
      this.allMilestones = [];
      return;
    }
    this.allMilestones = [];
    this.projects.forEach((project) => {
      if (!project) {
        return; // ✅ 修正: null/undefinedのプロジェクトをスキップ
      }
      // ✅ 修正: milestonesが配列でない場合の処理を追加
      if (Array.isArray(project.milestones) && project.milestones.length > 0) {
        project.milestones.forEach((milestone) => {
          if (!milestone) {
            return; // ✅ 修正: null/undefinedのマイルストーンをスキップ
          }
          this.allMilestones.push({
            ...milestone,
            projectId: project.id || '',
            projectName: project.projectName || '',
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
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    // ✅ 修正: allTasksが配列でない場合の処理を追加
    if (!Array.isArray(this.allTasks)) {
      console.error('allTasksが配列ではありません:', this.allTasks);
      this.tasks = [];
      return;
    }
    let filteredTasks = [...this.allTasks].filter((task) => task != null); // ✅ 修正: null/undefinedのタスクをフィルタリング

    // プロジェクトフィルター
    if (this.selectedProjectIds.length > 0) {
      filteredTasks = filteredTasks.filter(
        (task) =>
          task &&
          task.projectId &&
          this.selectedProjectIds.includes(task.projectId)
      );
    } else {
      // プロジェクトが選択されていない場合は空配列
      filteredTasks = [];
    }

    // 優先度フィルター
    if (this.filterPriority.length > 0) {
      filteredTasks = filteredTasks.filter(
        (task) =>
          task && task.priority && this.filterPriority.includes(task.priority)
      );
    }

    // 担当者フィルター（assignedMembers（メンバーID配列）から取得）
    if (this.filterAssignee.length > 0) {
      filteredTasks = filteredTasks.filter((task) => {
        if (!task) {
          return false;
        }
        const assignees: string[] = [];

        // assignedMembers から取得（メンバーIDをメンバー名に変換）
        if (
          Array.isArray(task.assignedMembers) &&
          task.assignedMembers.length > 0
        ) {
          const memberNames = getMemberNames(
            task.assignedMembers,
            this.members
          );
          // ✅ 修正: memberNamesが配列であることを確認
          if (Array.isArray(memberNames)) {
            assignees.push(...memberNames.filter((name) => name != null));
          }
        }

        // 担当者がいない場合はフィルターにマッチしない
        if (assignees.length === 0) {
          return false;
        }

        // フィルター値とマッチするか確認（いずれかの担当者がフィルターに含まれていればOK）
        return assignees.some(
          (assignee) => assignee && this.filterAssignee.includes(assignee)
        );
      });
    }

    // ステータスフィルター
    if (this.filterStatus.length > 0) {
      filteredTasks = filteredTasks.filter(
        (task) => task && task.status && this.filterStatus.includes(task.status)
      );
    }

    // ✅ 修正: filteredTasksが配列でない場合の処理を追加
    if (!Array.isArray(filteredTasks)) {
      console.error('filteredTasksが配列ではありません:', filteredTasks);
      this.tasks = [];
      return;
    }

    // フィルター後の結果を表示
    this.tasks = filteredTasks
      .filter((task) => task != null)
      .map((task) => this.withTaskTheme(task));
    this.calculateAssigneeColumnWidth(); // フィルター適用後も担当者列の幅を計算
    this.updateTimelineRange(this.tasks);
  }

  /** プロジェクト選択をトグル */
  toggleProjectSelection(projectId: string) {
    // ✅ 修正: projectIdがundefinedやnullの場合の処理を追加
    if (!projectId) {
      console.error('プロジェクトIDが指定されていません');
      return;
    }
    this.projectSelectionService.toggleProjectSelection(projectId);
  }

  getProjectNameStyle(task: Task) {
    // ✅ 修正: taskがnull/undefinedの場合のチェックを追加
    if (!task) {
      return {
        backgroundColor: this.defaultThemeColor,
        color: '#1f2933',
      };
    }
    const color = this.getProjectThemeColor(task.projectId);
    return {
      backgroundColor: color,
      color: '#1f2933',
    };
  }

  getTaskBarBackground(task: Task): string {
    // ✅ 修正: taskがnull/undefinedの場合のチェックを追加
    if (!task || !task.status) {
      return '#fdd6d5';
    }
    return this.statusColors[task.status] || '#fdd6d5';
  }

  getTaskBarTextColor(task: Task): string {
    // ✅ 修正: taskがnull/undefinedの場合のチェックを追加
    if (!task || !task.status) {
      return '#000000';
    }
    return this.statusTextColors[task.status] || '#000000';
  }

  /** プロジェクトをすべて選択 */
  selectAllProjects() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    // ✅ 修正: projectsが配列でない場合の処理
    if (!Array.isArray(this.projects)) {
      console.error('projectsが配列ではありません:', this.projects);
      return;
    }
    const allIds = this.projects
      .filter((project) => project != null) // ✅ 修正: null/undefinedのプロジェクトをフィルタリング
      .map((project) => project.id)
      .filter((id): id is string => !!id);
    this.selectedProjectIds = allIds;
    this.projectSelectionService.setSelectedProjectIds(allIds);
  }

  /** プロジェクト選択を全て解除 */
  clearProjectSelection() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    this.selectedProjectIds = [];
    this.projectSelectionService.clearSelection();
  }

  /** プロジェクトが選択されているかチェック */
  isProjectSelected(projectId: string): boolean {
    // ✅ 修正: projectIdがnull/undefinedの場合の処理
    if (!projectId) {
      return false;
    }
    return this.selectedProjectIds.includes(projectId);
  }

  /** プロジェクトIDからプロジェクト名を取得 */
  getProjectName(projectId: string): string {
    // ✅ 修正: projectIdがnull/undefinedの場合の処理
    if (!projectId) {
      return '';
    }
    // ✅ 修正: projectsが配列でない場合の処理
    if (!Array.isArray(this.projects)) {
      return '';
    }
    const project = this.projects.find((p) => p && p.id === projectId);
    return project ? project.projectName || '' : '';
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
  getTaskStartDate(task: Task): Date | null {
    if (!task || !task.startDate) {
      return null;
    }
    const date = new Date(task.startDate);
    // ✅ 修正: 無効な日付の場合はnullを返す
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  /** タスクの終了日を取得 */
  getTaskEndDate(task: Task): Date | null {
    if (!task || !task.dueDate) {
      return null;
    }
    const date = new Date(task.dueDate);
    // ✅ 修正: 無効な日付の場合はnullを返す
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  /** タスクの期間を計算 */
  getTaskDuration(task: Task): number {
    const start = this.getTaskStartDate(task);
    const end = this.getTaskEndDate(task);
    // ✅ 修正: 日付が無効な場合は0を返す
    if (!start || !end) {
      return 0;
    }
    // ✅ 修正: 日付が逆転している場合（開始日 > 終了日）の処理
    // 日付が逆転している場合は、開始日と終了日を入れ替えて計算
    const taskStart = start <= end ? start : end;
    const taskEnd = start <= end ? end : start;
    return (
      Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
  }

  /** タスクの開始位置を計算 */
  getTaskStartPosition(task: Task): number {
    const start = this.getTaskStartDate(task);
    // ✅ 修正: 日付が無効な場合は0を返す
    if (!start) {
      return 0;
    }
    // ✅ 修正: this.startDateが無効な場合のチェックを追加
    if (!this.startDate || isNaN(this.startDate.getTime())) {
      return 0;
    }
    const daysDiff = Math.floor(
      (start.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, daysDiff);
  }

  /** 日付をフォーマット */
  formatDate(date: Date): string {
    // ✅ 修正: 無効な日付のチェックを追加
    if (!date || isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  }

  /** 年月をフォーマット */
  formatYearMonth(date: Date): string {
    // ✅ 修正: 無効な日付のチェックを追加
    if (!date || isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
    });
  }

  /** 日付のみをフォーマット */
  formatDay(date: Date): string {
    // ✅ 修正: 無効な日付のチェックを追加
    if (!date || isNaN(date.getTime())) {
      return '';
    }
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
    // ✅ 修正: 無効な日付のチェックを追加
    if (isNaN(milestoneDate.getTime())) {
      return 0;
    }
    // ✅ 修正: this.startDateが無効な場合のチェックを追加
    if (!this.startDate || isNaN(this.startDate.getTime())) {
      return 0;
    }
    const startDate = new Date(this.startDate);
    const diffTime = milestoneDate.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays * 30); // 1日 = 30px、負の値の場合は0
  }

  /** 指定された日付にマイルストーンがあるかチェック */
  getMilestonesForDate(date: Date): any[] {
    // ✅ 修正: 無効な日付のチェックを追加
    if (!date || isNaN(date.getTime())) {
      return [];
    }
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
    this.removeTooltipClickOutsideListener();
  }

  /** マイルストーンツールチップの表示/非表示を切り替え */
  toggleMilestoneTooltip(event: MouseEvent | TouchEvent, milestones: any[]) {
    event.stopPropagation(); // 親要素のクリックイベントを防ぐ
    event.preventDefault(); // デフォルトの動作を防ぐ

    // 既に同じマイルストーンのツールチップが表示されている場合は閉じる
    if (this.tooltipVisible && this.tooltipMilestones === milestones) {
      this.hideMilestoneTooltip();
      return;
    }

    // ツールチップを表示
    const mouseEvent =
      event instanceof MouseEvent ? event : this.touchToMouseEvent(event);
    this.showMilestoneTooltip(mouseEvent, milestones);
    // ツールチップ外をクリックしたときに閉じるリスナーを設定
    this.setupTooltipClickOutsideListener();
  }

  /** TouchEventをMouseEventに変換 */
  private touchToMouseEvent(event: TouchEvent): MouseEvent {
    const touch = event.touches[0] || event.changedTouches[0];
    return {
      clientX: touch.clientX,
      clientY: touch.clientY,
    } as MouseEvent;
  }

  /** ツールチップ外をクリックしたときに閉じるリスナーを設定 */
  private setupTooltipClickOutsideListener(): void {
    // 既存のリスナーを削除
    this.removeTooltipClickOutsideListener();

    // 新しいリスナーを設定（次のイベントループで実行）
    setTimeout(() => {
      this.tooltipClickOutsideListener = (event: Event) => {
        const target = event.target as HTMLElement;
        // ツールチップ内またはマイルストーンフラッグをクリックした場合は何もしない
        if (
          this.tooltipElement?.nativeElement?.contains(target) ||
          target.closest('.milestone-flag')
        ) {
          return;
        }
        // ツールチップ外をクリックした場合は閉じる
        this.hideMilestoneTooltip();
      };
      document.addEventListener(
        'click',
        this.tooltipClickOutsideListener,
        true
      );
      document.addEventListener(
        'touchend',
        this.tooltipClickOutsideListener,
        true
      );
    }, 0);
  }

  /** ツールチップ外クリックリスナーを削除 */
  private removeTooltipClickOutsideListener(): void {
    if (this.tooltipClickOutsideListener) {
      document.removeEventListener(
        'click',
        this.tooltipClickOutsideListener,
        true
      );
      document.removeEventListener(
        'touchend',
        this.tooltipClickOutsideListener,
        true
      );
      this.tooltipClickOutsideListener = undefined;
    }
  }

  /** プロジェクト作成ダイアログを開く */
  openProjectDialog() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    this.router.navigate(['/project-form'], {
      state: { returnUrl: this.router.url },
    });
  }

  /** フィルターをリセット */
  resetFilters() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    this.filterPriority = [];
    this.filterAssignee = [];
    this.filterStatus = [];
    this.filterTasksBySelectedProjects();
  }

  /** ユニークな担当者一覧を取得（assignedMembers（メンバーID配列）から取得） */
  getUniqueAssignees(): string[] {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return [];
    }
    const assigneeSet = new Set<string>();

    // ✅ 修正: allTasksが配列でない場合の処理を追加
    if (!Array.isArray(this.allTasks)) {
      console.error('allTasksが配列ではありません:', this.allTasks);
      return [];
    }

    // 全タスクのassignedMembersからメンバー名を取得
    this.allTasks.forEach((task) => {
      if (!task) {
        return; // ✅ 修正: null/undefinedのタスクをスキップ
      }
      if (
        Array.isArray(task.assignedMembers) &&
        task.assignedMembers.length > 0
      ) {
        const memberNames = getMemberNames(task.assignedMembers, this.members);
        // ✅ 修正: memberNamesが配列であることを確認
        if (Array.isArray(memberNames)) {
          memberNames.forEach((name) => {
            if (name) {
              assigneeSet.add(name);
            }
          });
        }
      }
    });

    // ✅ 修正: membersが配列でない場合の処理を追加
    if (!Array.isArray(this.members)) {
      console.error('membersが配列ではありません:', this.members);
      return Array.from(assigneeSet).sort();
    }

    // メンバー管理画面のメンバー一覧からも取得（assignedMembersに含まれていないメンバーも選択肢に含める）
    this.members.forEach((member) => {
      if (!member) {
        return; // ✅ 修正: null/undefinedのメンバーをスキップ
      }
      if (member.name) {
        // メンバー名がカンマ区切りの場合も分割
        const names = member.name
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        names.forEach((name) => {
          if (name) {
            assigneeSet.add(name);
          }
        });
      }
    });

    return Array.from(assigneeSet).sort();
  }

  /** 日付がタスクの期間内かチェック */
  isDateInTaskRange(date: Date, task: Task): boolean {
    const taskStart = this.getTaskStartDate(task);
    const taskEnd = this.getTaskEndDate(task);
    // ✅ 修正: 日付が無効な場合はfalseを返す
    if (!taskStart || !taskEnd) {
      return false;
    }
    // ✅ 修正: 日付が逆転している場合（開始日 > 終了日）の処理
    if (taskStart > taskEnd) {
      // 日付が逆転している場合は、開始日と終了日を入れ替えてチェック
      return date >= taskEnd && date <= taskStart;
    }
    return date >= taskStart && date <= taskEnd;
  }

  /** タスクバーの開始位置を計算（ピクセル単位） */
  getTaskBarStartPosition(task: Task): number {
    const taskStart = this.getTaskStartDate(task);
    const taskEnd = this.getTaskEndDate(task);
    // ✅ 修正: 日付が無効な場合は0を返す
    if (!taskStart || !taskEnd) {
      return 0;
    }
    // ✅ 修正: this.startDateが無効な場合のチェックを追加
    if (!this.startDate || isNaN(this.startDate.getTime())) {
      return 0;
    }
    // ✅ 修正: 日付が逆転している場合（開始日 > 終了日）の処理
    // 日付が逆転している場合は、終了日を基準に開始位置を計算
    const startDate = taskStart <= taskEnd ? taskStart : taskEnd;
    const daysDiff = Math.floor(
      (startDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    // ✅ 修正: タスクが日付範囲外にある場合でも、負の値を返すことで
    // スクロールして見ることができるようにする（クリップはCSSで処理）
    return daysDiff * 30; // 1日 = 30px（負の値も許可）
  }

  /** タスクバーの幅を計算（ピクセル単位） */
  getTaskBarWidth(task: Task): number {
    const taskStart = this.getTaskStartDate(task);
    const taskEnd = this.getTaskEndDate(task);
    // ✅ 修正: 日付が無効な場合は0を返す
    if (!taskStart || !taskEnd) {
      return 0;
    }
    // ✅ 修正: 日付が逆転している場合（開始日 > 終了日）の処理
    // 日付が逆転している場合は、開始日と終了日を入れ替えて計算
    const start = taskStart <= taskEnd ? taskStart : taskEnd;
    const end = taskStart <= taskEnd ? taskEnd : taskStart;
    const totalDays =
      Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
    return Math.max(0, totalDays * 30); // 1日 = 30px、負の値の場合は0
  }

  private updateTimelineRange(tasks: Task[]): void {
    // タスクの日付範囲に関係なく、常に当月±3か月の範囲を使用
    this.setDefaultDateRange();
  }

  private scheduleScrollToDate(targetDate: Date, force = false): void {
    if (this.hasUserHorizontalScrolled && !force) {
      return;
    }

    // ✅ 修正: 無効な日付のチェックを追加
    if (!targetDate || !this.startDate || !this.endDate ||
        isNaN(targetDate.getTime()) || 
        isNaN(this.startDate.getTime()) || 
        isNaN(this.endDate.getTime())) {
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

    const maxScroll = Math.max(
      container.scrollWidth - container.clientWidth,
      0
    );
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

  /** タスクバーの垂直位置を計算（日付がないタスクを考慮） */
  getTaskBarTopPosition(taskIndex: number): number {
    // ✅ 修正: タスクバーの位置は、そのタスクがtasks配列内の何番目かで決まる
    // 日付がないタスクも含めて、全てのタスクが同じ行に表示されるため、
    // taskIndexをそのまま使用する
    const rowHeight = 40;
    return taskIndex * rowHeight + 4; // 4pxはタスクバーのマージン
  }

  /** タスク詳細画面に遷移 */
  openTaskDetail(task: Task) {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    // ✅ 修正: taskがnull/undefinedの場合のチェック
    if (!task) {
      console.error('タスクが指定されていません');
      return;
    }
    console.log('Navigating to task detail:', task);
    if (task.projectId && task.id) {
      this.router.navigate(['/project', task.projectId, 'task', task.id]);
    } else {
      console.error(
        this.languageService.translate('gantt.error.taskProjectIdMissing'),
        {
          projectId: task.projectId,
          id: task.id,
          task: task,
        }
      );
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
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    if (projectId) {
      this.router.navigate(['/project', projectId]);
    } else {
      console.error(
        this.languageService.translate('gantt.error.projectIdMissing')
      );
    }
  }

  /** スクロール同期を設定 */
  setupScrollSync() {
    // DOMが完全に読み込まれた後に実行
    setTimeout(() => {
      // ✅ 修正: 実際のHTML構造に合わせてセレクターを修正
      // 水平スクロールは #timelineContainer (.gantt-right-pane) で行われる
      // 日付ヘッダー (.gantt-header-right) は sticky で固定されているため、
      // 実際には timelineContainer のスクロールを追跡するだけで良い
      // このメソッドは現在の実装では不要だが、将来の拡張のために残す
      const timelineContainer = this.timelineContainer?.nativeElement;
      if (timelineContainer) {
        // initializeHorizontalScrollTracking() で既に処理されているため、
        // ここでは特に追加の処理は不要
        // ただし、エラーを防ぐために要素の存在確認のみ行う
        console.log('スクロール同期: timelineContainer が見つかりました');
      } else {
        console.warn('スクロール同期: timelineContainer が見つかりませんでした');
      }
    }, 100);
  }

  /** ステータスを表示（言語設定に応じて） */
  getStatusDisplay(status: string): string {
    const currentLanguage = this.languageService.getCurrentLanguage();
    const statusMap: Record<string, Record<'ja' | 'en', string>> = {
      未着手: { ja: '未着手', en: 'Not Started' },
      作業中: { ja: '作業中', en: 'In Progress' },
      完了: { ja: '完了', en: 'Completed' },
      notStarted: { ja: '未着手', en: 'Not Started' },
      inProgress: { ja: '作業中', en: 'In Progress' },
      completed: { ja: '完了', en: 'Completed' },
    };
    return statusMap[status]?.[currentLanguage] || status;
  }

  /** 優先度を表示（言語設定に応じて） */
  getPriorityDisplay(priority: string): string {
    const currentLanguage = this.languageService.getCurrentLanguage();
    const priorityMap: Record<string, Record<'ja' | 'en', string>> = {
      高: { ja: '高', en: 'High' },
      中: { ja: '中', en: 'Medium' },
      低: { ja: '低', en: 'Low' },
      high: { ja: '高', en: 'High' },
      medium: { ja: '中', en: 'Medium' },
      low: { ja: '低', en: 'Low' },
    };
    return priorityMap[priority]?.[currentLanguage] || priority;
  }

  /** 優先度の短縮形を表示（言語設定に応じて） */
  getPriorityShortDisplay(priority: string): string {
    // ✅ 修正: priorityがnull/undefinedの場合のチェックを追加
    if (!priority) {
      return '';
    }
    const currentLanguage = this.languageService.getCurrentLanguage();
    const priorityShortMap: Record<string, Record<'ja' | 'en', string>> = {
      高: { ja: '高', en: 'H' },
      中: { ja: '中', en: 'M' },
      低: { ja: '低', en: 'L' },
      high: { ja: '高', en: 'H' },
      medium: { ja: '中', en: 'M' },
      low: { ja: '低', en: 'L' },
    };
    return priorityShortMap[priority]?.[currentLanguage] || priority;
  }

  /** タスクの担当者を表示（カンマ区切り対応） */
  getTaskAssigneeDisplay(task: Task): string {
    // ✅ 修正: taskがnull/undefinedの場合のチェック
    if (!task) {
      return '—';
    }
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
    const assigneeNames = task.assignee.split(',').map((name) => name.trim());
    const updatedNames = assigneeNames
      .map((name) => {
        const member = this.members.find((m) => m.name === name);
        return member ? member.name : null;
      })
      .filter((name): name is string => name !== null);

    return updatedNames.length > 0 ? updatedNames.join(', ') : '—';
  }

  /** タスクバーのツールチップテキストを取得 */
  getTaskBarTooltip(task: Task): string {
    // ✅ 修正: taskがnull/undefinedの場合のチェック
    if (!task) {
      return '';
    }
    const statusDisplay = this.getStatusDisplay(task.status || '');
    const startDate = task.startDate || '';
    const dueDate = task.dueDate || '';
    const currentLanguage = this.languageService.getCurrentLanguage();
    const separator = currentLanguage === 'ja' ? ' ～ ' : ' - ';
    return `${
      task.taskName || ''
    } (${statusDisplay}) - ${startDate}${separator}${dueDate}`;
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
