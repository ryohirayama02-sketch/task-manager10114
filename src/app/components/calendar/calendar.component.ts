import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Subject,
  combineLatest,
  of,
  takeUntil,
  switchMap,
  filter,
  take,
} from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ProjectSelectionService } from '../../services/project-selection.service';
import { Task } from '../../models/task.model';
import { IProject } from '../../models/project.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AuthService } from '../../services/auth.service';
import { MemberManagementService } from '../../services/member-management.service';
import { Member } from '../../models/member.model';
import {
  getMemberNamesAsString,
  getMemberNames,
} from '../../utils/member-utils';
import { LanguageService } from '../../services/language.service';

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
    TranslatePipe,
  ],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css'],
})
export class CalendarComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  projects: IProject[] = [];
  selectedProjectIds: string[] = [];
  allTasks: Task[] = [];
  private destroy$ = new Subject<void>();

  // カレンダー表示用
  currentDate: Date = new Date();
  calendarDays: Date[] = [];
  weekDays = ['日', '月', '火', '水', '木', '金', '土']; // 初期値（後でgetWeekDays()で上書き）

  // 表示モード
  viewMode: 'day' | 'week' | 'month' = 'month';
  selectedDate: Date | null = null;

  // 表示可能な月の範囲
  minAvailableDate: Date | null = null;
  maxAvailableDate: Date | null = null;

  // フィルター用
  filterPriority: string[] = [];
  filterAssignee: string[] = [];
  filterStatus: string[] = [];
  members: Member[] = []; // メンバー一覧

  // メンバー数チェック
  get hasMembers(): boolean {
    return this.members.length > 0;
  }

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
  getStatusValue(key: string | null | undefined): string {
    // ✅ 修正: keyがnull/undefinedの場合のチェックを追加
    if (!key) {
      return '未着手'; // デフォルト値
    }
    const statusMap: Record<string, string> = {
      notStarted: '未着手',
      inProgress: '作業中',
      completed: '完了',
      // 日本語キーもサポート（後方互換性のため）
      未着手: '未着手',
      作業中: '作業中',
      完了: '完了',
    };
    return statusMap[key] || '未着手'; // デフォルト値を返す
  }

  /** 優先度の値を取得（日本語キーを返す） */
  getPriorityValue(key: string | null | undefined): string {
    // ✅ 修正: keyがnull/undefinedの場合のチェックを追加
    if (!key) {
      return '中'; // デフォルト値
    }
    const priorityMap: Record<string, string> = {
      high: '高',
      medium: '中',
      low: '低',
      // 日本語キーもサポート（後方互換性のため）
      高: '高',
      中: '中',
      低: '低',
    };
    return priorityMap[key] || '中'; // デフォルト値を返す
  }

  // マイルストーン
  allMilestones: any[] = [];

  // ツールチップ
  tooltipVisible: boolean = false;
  tooltipPosition: { x: number; y: number } = { x: 0, y: 0 };
  tooltipMilestones: any[] = [];
  @ViewChild('tooltip', { static: false }) tooltipElement?: ElementRef;
  private tooltipClickOutsideListener?: (event: Event) => void;
  private isTouchDevice: boolean = false;

  constructor(
    private projectService: ProjectService,
    private projectSelectionService: ProjectSelectionService,
    private router: Router,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    private memberManagementService: MemberManagementService,
    private languageService: LanguageService
  ) {}

  ngOnInit(): void {
    // タッチデバイスかどうかを判定
    this.isTouchDevice =
      'ontouchstart' in window || navigator.maxTouchPoints > 0;

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

    // 日付選択範囲を初期化（当月±3か月）
    this.updateAvailableDateRange();

    this.generateCalendarDays();
    this.observeUserProjects();

    this.projectSelectionService
      .getSelectedProjectIds()
      .pipe(takeUntil(this.destroy$))
      .subscribe((projectIds: string[]) => {
        this.selectedProjectIds = projectIds;
        this.filterTasksBySelectedProjects();
      });
  }

  ngOnDestroy(): void {
    // ✅ 修正: ツールチップのイベントリスナーを削除
    this.removeTooltipClickOutsideListener();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** カレンダーの日付を生成 */
  generateCalendarDays() {
    this.calendarDays = [];

    // ✅ 修正: currentDateが無効な日付の場合のチェックを追加
    if (!this.currentDate || isNaN(this.currentDate.getTime())) {
      console.error('currentDateが無効です:', this.currentDate);
      // 無効な場合は今日の日付を使用
      this.currentDate = new Date();
    }

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

      // ✅ 修正: 無限ループを防ぐため、最大日数を制限
      const maxDays = 50; // 6週間分 + 余裕を持たせて50日
      let dayCount = 0;
      const current = new Date(startDate);
      while (current <= endDate && dayCount < maxDays) {
        this.calendarDays.push(new Date(current));
        current.setDate(current.getDate() + 1);
        dayCount++;
      }
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
          console.log('🔑 Current user info (Calendar):', {
            userEmail,
            roomId,
          });
          if (!userEmail || !roomId) {
            this.resetProjectState(true);
            return of([]);
          }
          return this.projectService.getProjects();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (projects) => {
          console.log('🎯 All projects for calendar:', projects);
          if (projects.length === 0) {
            this.resetProjectState();
            this.projectSelectionService.clearSelection();
            return;
          }

          this.applyProjectList(projects);
        },
        error: (error) => {
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

    const storedSelection =
      this.projectSelectionService.getSelectedProjectIdsSync();
    const availableIds = new Set(
      this.projects
        .map((project) => project.id)
        .filter((id): id is string => !!id)
    );
    // ✅ 修正: storedSelectionが配列でない場合の処理を追加
    const validStoredSelection = Array.isArray(storedSelection)
      ? storedSelection
      : [];
    let nextSelection = validStoredSelection.filter((id) =>
      availableIds.has(id)
    );

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
    this.updateAvailableDateRange();
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
      this.allTasks = [];
      return;
    }
    this.allTasks = [];
    this.projects.forEach((project) => {
      // ✅ 修正: projectがnull/undefinedの場合のチェックを追加
      if (!project || !project.id) {
        return;
      }
      this.projectService
        .getTasksByProjectId(project.id)
        .pipe(takeUntil(this.destroy$)) // ✅ 修正: メモリリーク防止
        .subscribe({
          next: (tasks: Task[]) => {
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
            const tasksWithProject = tasks
              .filter((task) => task != null) // ✅ 修正: null/undefinedのタスクをフィルタリング
              .map((task) => ({
                ...task,
                projectId: task.projectId || project.id!,
                projectName: task.projectName || project.projectName || '',
              }));

            // ✅ 修正: 競合状態を防ぐため、現在のallTasksのコピーを作成してから操作
            const currentAllTasks = [...this.allTasks];
            const filteredTasks = currentAllTasks.filter(
              (t) => t && t.projectId !== project.id
            );
            // ✅ 修正: 一度に更新することで競合状態を防ぐ
            this.allTasks = [...filteredTasks, ...tasksWithProject];
            this.filterTasksBySelectedProjects();
            this.updateAvailableDateRange();
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
      // ✅ 修正: projectがnull/undefinedの場合のチェックを追加
      if (!project) {
        return;
      }
      // ✅ 修正: milestonesが配列でない場合の処理を追加
      if (Array.isArray(project.milestones) && project.milestones.length > 0) {
        project.milestones.forEach((milestone) => {
          // ✅ 修正: milestoneがnull/undefinedの場合のチェックを追加
          if (!milestone) {
            return;
          }
          // ✅ 修正: milestone.dateが有効な日付文字列かどうかをチェック
          // milestone.dateは文字列形式（YYYY-MM-DD）で保存されている
          if (milestone.date) {
            // 日付文字列をDateオブジェクトに変換して検証
            const dateObj = new Date(milestone.date);
            if (isNaN(dateObj.getTime())) {
              // 無効な日付の場合はスキップ
              console.warn(
                `無効なマイルストーン日付をスキップしました: ${milestone.date} (プロジェクト: ${project.projectName})`
              );
              return;
            }
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
    this.applyFilters();
  }

  /** フィルターを適用 */
  applyFilters() {
    // ✅ 修正: allTasksが配列でない場合の処理を追加
    if (!Array.isArray(this.allTasks)) {
      console.error('allTasksが配列ではありません:', this.allTasks);
      this.tasks = [];
      this.updateAvailableDateRange();
      return;
    }

    // ✅ 修正: selectedProjectIdsが配列でない場合の処理を追加
    const validSelectedProjectIds = Array.isArray(this.selectedProjectIds)
      ? this.selectedProjectIds
      : [];
    // ✅ 修正: filterPriority, filterAssignee, filterStatusが配列でない場合の処理を追加
    const validFilterPriority = Array.isArray(this.filterPriority)
      ? this.filterPriority
      : [];
    const validFilterAssignee = Array.isArray(this.filterAssignee)
      ? this.filterAssignee
      : [];
    const validFilterStatus = Array.isArray(this.filterStatus)
      ? this.filterStatus
      : [];

    let filteredTasks = validSelectedProjectIds.length
      ? this.allTasks.filter(
          (task) =>
            task &&
            task.projectId &&
            validSelectedProjectIds.includes(task.projectId)
        )
      : [];

    if (validFilterPriority.length > 0) {
      filteredTasks = filteredTasks.filter(
        (task) =>
          task && task.priority && validFilterPriority.includes(task.priority)
      );
    }
    // 担当者フィルター（assignedMembers（メンバーID配列）から取得）
    if (validFilterAssignee.length > 0) {
      filteredTasks = filteredTasks.filter((task) => {
        // ✅ 修正: taskがnull/undefinedの場合のチェックを追加
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
          (assignee) => assignee && validFilterAssignee.includes(assignee)
        );
      });
    }
    if (validFilterStatus.length > 0) {
      filteredTasks = filteredTasks.filter(
        (task) => task && task.status && validFilterStatus.includes(task.status)
      );
    }

    // ✅ 修正: filteredTasksが配列でない場合の処理を追加
    if (!Array.isArray(filteredTasks)) {
      console.error('filteredTasksが配列ではありません:', filteredTasks);
      this.tasks = [];
      this.updateAvailableDateRange();
      return;
    }

    this.tasks = filteredTasks;
    this.updateAvailableDateRange();
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

  /** プロジェクトをすべて選択 */
  selectAllProjects() {
    // ✅ 修正: projectsが配列でない場合の処理を追加
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
    this.selectedProjectIds = [];
    this.projectSelectionService.clearSelection();
  }

  /** プロジェクトが選択されているかチェック */
  isProjectSelected(projectId: string): boolean {
    // ✅ 修正: projectIdがnull/undefinedの場合の処理を追加
    if (!projectId) {
      return false;
    }
    return this.selectedProjectIds.includes(projectId);
  }

  /** プロジェクトIDからプロジェクト名を取得 */
  getProjectName(projectId: string): string {
    // ✅ 修正: projectIdがnull/undefinedの場合の処理を追加
    if (!projectId) {
      return '';
    }
    // ✅ 修正: projectsが配列でない場合の処理を追加
    if (!Array.isArray(this.projects)) {
      return '';
    }
    const project = this.projects.find((p) => p && p.id === projectId);
    return project ? project.projectName || '' : '';
  }

  /** 表示モードに応じた最大タスク表示数を取得 */
  getMaxTasksForViewMode(): number {
    switch (this.viewMode) {
      case 'day':
        return 12;
      case 'week':
        return 12;
      case 'month':
        return 5;
      default:
        return 12;
    }
  }

  /** 指定された日付のタスクを取得（期限ベース） */
  getTasksForDate(date: Date): Task[] {
    // ✅ 修正: 無効な日付のチェックを追加
    if (!date || isNaN(date.getTime())) {
      return [];
    }
    // ✅ 修正: tasksが配列でない場合の処理を追加
    if (!Array.isArray(this.tasks)) {
      console.error('tasksが配列ではありません:', this.tasks);
      return [];
    }
    return this.tasks.filter((task) => {
      // 期限日でフィルタリング
      if (!task || !task.dueDate) return false;

      // ローカルタイムゾーンで日付文字列を生成（YYYY-MM-DD形式）
      const dateYear = date.getFullYear();
      const dateMonth = String(date.getMonth() + 1).padStart(2, '0');
      const dateDay = String(date.getDate()).padStart(2, '0');
      const dateStr = `${dateYear}-${dateMonth}-${dateDay}`;

      // dueDateが文字列形式（YYYY-MM-DD）の場合
      if (typeof task.dueDate === 'string') {
        // ✅ 修正: 空文字列や無効な形式の場合のチェックを追加
        if (!task.dueDate || task.dueDate.trim().length === 0) {
          return false;
        }
        // 時刻部分を除去
        const dueDateStr = task.dueDate.split('T')[0];
        // ✅ 修正: 分割後の文字列が有効かチェック
        if (!dueDateStr || dueDateStr.length !== 10) {
          return false;
        }
        return dueDateStr === dateStr;
      }

      // dueDateがDateオブジェクトの場合
      const dueDate = new Date(task.dueDate);
      // ✅ 修正: 無効な日付のチェックを追加
      if (isNaN(dueDate.getTime())) {
        return false;
      }
      const dueYear = dueDate.getFullYear();
      const dueMonth = String(dueDate.getMonth() + 1).padStart(2, '0');
      const dueDay = String(dueDate.getDate()).padStart(2, '0');
      const dueDateStr = `${dueYear}-${dueMonth}-${dueDay}`;

      return dueDateStr === dateStr;
    });
  }

  /** 指定された日付のタスクの表示用リストを取得（最大件数制限付き） */
  getDisplayTasksForDate(date: Date): Task[] {
    // ✅ 修正: 無効な日付のチェックを追加
    if (!date || isNaN(date.getTime())) {
      return [];
    }
    const allTasks = this.getTasksForDate(date);
    // ✅ 修正: allTasksが配列でない場合の処理を追加
    if (!Array.isArray(allTasks)) {
      console.error('allTasksが配列ではありません:', allTasks);
      return [];
    }
    // ✅ 修正: null/undefinedのタスクをフィルタリング
    const validTasks = allTasks.filter((task) => task != null);
    const maxTasks = this.getMaxTasksForViewMode();
    return validTasks.slice(0, maxTasks);
  }

  /** 指定された日付の残りのタスク数を取得 */
  getRemainingTasksCount(date: Date): number {
    // ✅ 修正: 無効な日付のチェックを追加
    if (!date || isNaN(date.getTime())) {
      return 0;
    }
    const allTasks = this.getTasksForDate(date);
    const maxTasks = this.getMaxTasksForViewMode();
    return Math.max(0, allTasks.length - maxTasks);
  }

  /** 日付が今日かチェック */
  isToday(date: Date): boolean {
    // ✅ 修正: 無効な日付のチェックを追加
    if (!date || isNaN(date.getTime())) {
      return false;
    }
    const today = new Date();
    // ✅ 修正: todayが無効な日付の場合のチェックを追加
    if (isNaN(today.getTime())) {
      console.error('今日の日付が無効です');
      return false;
    }
    // ローカルタイムゾーンで日付を比較
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  /** 日付が現在の月かチェック */
  isCurrentMonth(date: Date): boolean {
    // ✅ 修正: 無効な日付のチェックを追加
    if (
      !date ||
      isNaN(date.getTime()) ||
      !this.currentDate ||
      isNaN(this.currentDate.getTime())
    ) {
      return false;
    }
    return date.getMonth() === this.currentDate.getMonth();
  }

  /** 日付を変更 */
  changeDate(direction: number) {
    // ✅ 修正: currentDateが無効な日付の場合のチェックを追加
    if (!this.currentDate || isNaN(this.currentDate.getTime())) {
      console.error('currentDateが無効です:', this.currentDate);
      this.currentDate = new Date();
    }
    const newDate = new Date(this.currentDate);

    if (this.viewMode === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (this.viewMode === 'week') {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }

    // ✅ 修正: 新しい日付が無効な場合のチェックを追加
    if (isNaN(newDate.getTime())) {
      console.error('新しい日付が無効です:', newDate);
      return;
    }

    // 表示可能な範囲内かチェック
    if (this.isDateInAvailableRange(newDate)) {
      this.currentDate = newDate;
      if (this.selectedDate) {
        this.selectedDate = new Date(this.currentDate);
      }
      this.generateCalendarDays();
    }
  }

  /** 現在の日付に戻る */
  goToCurrentDate() {
    const today = new Date();
    // ✅ 修正: todayが無効な日付の場合のチェックを追加
    if (isNaN(today.getTime())) {
      console.error('今日の日付が無効です');
      return;
    }
    // 表示可能な範囲内かチェック
    if (this.isDateInAvailableRange(today)) {
      this.currentDate = today;
      if (this.selectedDate) {
        this.selectedDate = new Date(this.currentDate);
      }
      this.generateCalendarDays();
    } else {
      // 範囲外の場合は、範囲内の最も近い日付に移動
      if (
        this.minAvailableDate &&
        !isNaN(this.minAvailableDate.getTime()) &&
        today < this.minAvailableDate
      ) {
        this.currentDate = new Date(this.minAvailableDate);
      } else if (
        this.maxAvailableDate &&
        !isNaN(this.maxAvailableDate.getTime()) &&
        today > this.maxAvailableDate
      ) {
        this.currentDate = new Date(this.maxAvailableDate);
      } else {
        this.currentDate = today;
      }
      // ✅ 修正: 新しいcurrentDateが無効な日付の場合のチェックを追加
      if (isNaN(this.currentDate.getTime())) {
        console.error('新しいcurrentDateが無効です');
        this.currentDate = new Date(); // フォールバックとして今日の日付を使用
      }
      if (this.selectedDate) {
        this.selectedDate = new Date(this.currentDate);
      }
      this.generateCalendarDays();
    }
  }

  /** 表示モードを変更 */
  changeViewMode(mode: 'day' | 'week' | 'month' | null | undefined) {
    // ✅ 修正: modeがnull/undefinedの場合のチェックを追加
    if (!mode || (mode !== 'day' && mode !== 'week' && mode !== 'month')) {
      console.error('無効な表示モード:', mode);
      return;
    }
    this.viewMode = mode;
    // ✅ 修正: selectedDateが無効な日付の場合のチェックを追加
    if (this.selectedDate && !isNaN(this.selectedDate.getTime())) {
      this.currentDate = new Date(this.selectedDate);
    } else if (!this.currentDate || isNaN(this.currentDate.getTime())) {
      // currentDateも無効な場合は今日の日付を使用
      this.currentDate = new Date();
    }
    this.generateCalendarDays();
  }

  /** 日付が選択中かチェック */
  isSelectedDate(date: Date): boolean {
    // ✅ 修正: 無効な日付のチェックを追加
    if (!date || isNaN(date.getTime())) {
      return false;
    }
    if (!this.selectedDate || isNaN(this.selectedDate.getTime())) {
      return false;
    }
    return date.toDateString() === this.selectedDate.toDateString();
  }

  /** 日付を選択 */
  onDateSelected(date: Date) {
    // ✅ 修正: 無効な日付のチェックを追加
    if (!date || isNaN(date.getTime())) {
      console.error('無効な日付が選択されました:', date);
      return;
    }
    // ✅ 修正: 表示可能な範囲内かチェック
    if (!this.isDateInAvailableRange(date)) {
      console.warn('選択された日付は表示可能な範囲外です:', date);
      // 範囲外の場合は、範囲内の最も近い日付に移動
      if (
        this.minAvailableDate &&
        !isNaN(this.minAvailableDate.getTime()) &&
        date < this.minAvailableDate
      ) {
        this.selectedDate = new Date(this.minAvailableDate);
        this.currentDate = new Date(this.minAvailableDate);
      } else if (
        this.maxAvailableDate &&
        !isNaN(this.maxAvailableDate.getTime()) &&
        date > this.maxAvailableDate
      ) {
        this.selectedDate = new Date(this.maxAvailableDate);
        this.currentDate = new Date(this.maxAvailableDate);
      } else {
        return; // 範囲外の場合は何もしない
      }
    } else {
      this.selectedDate = new Date(date);
      this.currentDate = new Date(date);
    }
    this.generateCalendarDays();
  }

  private resetProjectState(includeSelection = false): void {
    this.projects = [];
    this.selectedProjectIds = [];
    this.allTasks = [];
    this.tasks = [];
    this.allMilestones = [];
    if (includeSelection) {
      this.projectSelectionService.clearSelection();
    }
  }

  /** 表示名を取得 */
  getDisplayName(): string {
    // ✅ 修正: currentDateが無効な日付の場合のチェックを追加
    if (!this.currentDate || isNaN(this.currentDate.getTime())) {
      return '';
    }
    const currentLanguage = this.languageService.getCurrentLanguage();
    const locale = currentLanguage === 'en' ? 'en-US' : 'ja-JP';

    if (this.viewMode === 'day') {
      return this.currentDate.toLocaleDateString(locale, {
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

      return `${startOfWeek.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
      })} - ${endOfWeek.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
      })}`;
    } else {
      return this.currentDate.toLocaleDateString(locale, {
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

  /** ユニークな担当者一覧を取得（assignedMembers（メンバーID配列）から取得） */
  getUniqueAssignees(): string[] {
    const assigneeSet = new Set<string>();

    // ✅ 修正: allTasksが配列でない場合の処理を追加
    if (!Array.isArray(this.allTasks)) {
      console.error('allTasksが配列ではありません:', this.allTasks);
      return [];
    }

    // 全タスクのassignedMembersからメンバー名を取得
    this.allTasks.forEach((task) => {
      // ✅ 修正: taskがnull/undefinedの場合のチェックを追加
      if (!task) {
        return;
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
      // ✅ 修正: memberがnull/undefinedの場合のチェックを追加
      if (!member) {
        return;
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

  /** タスク詳細画面に遷移 */
  openTaskDetail(task: Task) {
    // ✅ 修正: taskがnull/undefinedの場合のチェックを追加
    if (!task) {
      console.error('タスクが指定されていません');
      return;
    }
    console.log('Navigating to task detail:', task);
    if (task.projectId && task.id) {
      this.router.navigate(['/project', task.projectId, 'task', task.id]);
    } else {
      console.error(
        this.languageService.translate('calendar.error.taskProjectIdMissing'),
        {
          projectId: task.projectId,
          id: task.id,
          task: task,
        }
      );
    }
  }

  /** 指定された日付にマイルストーンがあるかチェック */
  getMilestonesForDate(date: Date): any[] {
    // ✅ 修正: 無効な日付のチェックを追加
    if (!date || isNaN(date.getTime())) {
      return [];
    }
    // ✅ 修正: allMilestonesが配列でない場合の処理を追加
    if (!Array.isArray(this.allMilestones)) {
      console.error('allMilestonesが配列ではありません:', this.allMilestones);
      return [];
    }
    // ローカルタイムゾーンで日付文字列を生成（YYYY-MM-DD形式）
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return this.allMilestones.filter(
      (milestone) => milestone && milestone.date === dateStr
    );
  }

  /** マイルストーンツールチップを表示 */
  showMilestoneTooltip(event: MouseEvent, milestones: any[]) {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    // ✅ 修正: milestonesが配列でない場合の処理を追加
    if (!Array.isArray(milestones) || milestones.length === 0) {
      return;
    }
    // ✅ 修正: eventがnull/undefinedの場合のチェックを追加
    if (!event) {
      console.error('MouseEventが指定されていません');
      return;
    }
    // ✅ 修正: event.clientX/clientYが無効な値の場合のチェックを追加
    const clientX =
      typeof event.clientX === 'number' && !isNaN(event.clientX)
        ? event.clientX
        : 0;
    const clientY =
      typeof event.clientY === 'number' && !isNaN(event.clientY)
        ? event.clientY
        : 0;

    // 既に表示されている場合は一旦閉じる（新しい位置で表示するため）
    if (this.tooltipVisible) {
      this.tooltipVisible = false;
    }
    this.tooltipMilestones = milestones;

    // 初期位置を設定
    const tooltipWidth = 250; // max-width
    const padding = 10;
    const margin = 10;

    let x = clientX + margin;
    let y = clientY - margin;

    // ウィンドウの境界を取得
    const windowWidth = window.innerWidth || 0;
    const windowHeight = window.innerHeight || 0;

    // ✅ 修正: ウィンドウサイズが無効な場合のチェックを追加
    if (windowWidth <= 0 || windowHeight <= 0) {
      console.warn('ウィンドウサイズが無効です:', {
        windowWidth,
        windowHeight,
      });
      // デフォルト位置を使用
      x = padding;
      y = padding;
    } else {
      // 右側にはみ出る場合は左側に表示
      if (x + tooltipWidth > windowWidth - padding) {
        x = clientX - tooltipWidth - margin;
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
        y = clientY - estimatedHeight - margin;
      }

      // 上側にはみ出る場合は下側に表示
      if (y < padding) {
        y = clientY + margin;
      }
    }

    this.tooltipPosition = { x, y };
    this.tooltipVisible = true;

    // DOMが更新された後に実際のサイズで再調整
    setTimeout(() => {
      // ✅ 修正: コンポーネントが破棄されていないかチェック
      if (!this.destroy$.closed) {
        this.adjustTooltipPosition(event);
      }
    }, 0);
  }

  /** ツールチップの位置を実際のサイズに基づいて調整 */
  adjustTooltipPosition(event: MouseEvent) {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      return;
    }
    if (!this.tooltipElement?.nativeElement) {
      return;
    }
    // ✅ 修正: eventがnull/undefinedの場合のチェックを追加
    if (!event) {
      console.error('MouseEventが指定されていません');
      return;
    }

    const tooltip = this.tooltipElement.nativeElement;
    const tooltipRect = tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth || 0;
    const windowHeight = window.innerHeight || 0;
    const padding = 10;
    const margin = 10;

    // ✅ 修正: ウィンドウサイズが無効な場合のチェックを追加
    if (windowWidth <= 0 || windowHeight <= 0) {
      console.warn('ウィンドウサイズが無効です:', {
        windowWidth,
        windowHeight,
      });
      return;
    }

    // ✅ 修正: tooltipRectが無効な場合のチェックを追加
    if (!tooltipRect || tooltipRect.width <= 0 || tooltipRect.height <= 0) {
      console.warn('ツールチップのサイズが無効です:', tooltipRect);
      return;
    }

    // ✅ 修正: event.clientX/clientYが無効な値の場合のチェックを追加
    const clientX =
      typeof event.clientX === 'number' && !isNaN(event.clientX)
        ? event.clientX
        : 0;
    const clientY =
      typeof event.clientY === 'number' && !isNaN(event.clientY)
        ? event.clientY
        : 0;

    let x = this.tooltipPosition.x;
    let y = this.tooltipPosition.y;

    // 右側にはみ出る場合は左側に表示
    if (tooltipRect.right > windowWidth - padding) {
      x = clientX - tooltipRect.width - margin;
    }

    // 左側にはみ出る場合は右側に表示
    if (tooltipRect.left < padding) {
      x = padding;
    }

    // 下側にはみ出る場合は上側に表示
    if (tooltipRect.bottom > windowHeight - padding) {
      y = clientY - tooltipRect.height - margin;
    }

    // 上側にはみ出る場合は下側に表示
    if (tooltipRect.top < padding) {
      y = clientY + margin;
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

  /** マイルストーンツールチップの表示/非表示を切り替え（スマホ対応） */
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
    // ✅ 修正: touchesまたはchangedTouchesが空の場合のエラーハンドリング
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (!touch) {
      // タッチ情報が取得できない場合は、デフォルト値を使用
      console.warn('TouchEventからタッチ情報を取得できませんでした');
      return {
        clientX: 0,
        clientY: 0,
      } as MouseEvent;
    }
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

  /** マウスエンター時の処理（タッチデバイスでは無視） */
  onMilestoneMouseEnter(event: MouseEvent, milestones: any[]): void {
    // タッチデバイスではマウスイベントを無視（クリックイベントで処理）
    if (this.isTouchDevice) {
      return;
    }
    this.showMilestoneTooltip(event, milestones);
  }

  /** マウスリーブ時の処理（タッチデバイスでは無視） */
  onMilestoneMouseLeave(): void {
    // タッチデバイスではマウスイベントを無視（クリックイベントで処理）
    if (this.isTouchDevice) {
      return;
    }
    this.hideMilestoneTooltip();
  }

  /** タスクの担当者を表示（カンマ区切り対応） */
  getTaskAssigneeDisplay(task: Task): string {
    // assignedMembers がある場合はそれを使用
    if (task.assignedMembers && task.assignedMembers.length > 0) {
      // デバッグ: assignedMembersとmembersの内容を確認
      console.log('🔍 [Calendar getTaskAssigneeDisplay] Task:', task.taskName);
      console.log('   - assignedMembers:', task.assignedMembers);
      console.log('   - this.members:', this.members);
      console.log('   - this.members.length:', this.members.length);

      // 各assignedMembersのUIDがmembersに存在するか確認
      task.assignedMembers.forEach((memberId, index) => {
        const member = this.members.find((m) => m.id === memberId);
        console.log(
          `   - assignedMembers[${index}]: ${memberId} → ${
            member ? member.name : '(not found)'
          }`
        );
      });

      const display = getMemberNamesAsString(
        task.assignedMembers,
        this.members,
        ', '
      );
      console.log('   - Display result:', display);
      const notSetText = this.languageService.translate('common.notSet');
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

  /** タスクの日付範囲を計算して表示可能な月の範囲を更新（当月±3か月に制限） */
  private updateAvailableDateRange(): void {
    // 日付選択範囲を設定（当月±3か月）
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // 3か月前の1日
    this.minAvailableDate = new Date(currentYear, currentMonth - 3, 1);

    // 3か月後の月末日
    this.maxAvailableDate = new Date(currentYear, currentMonth + 4, 0); // 翌月の0日 = 今月の月末
  }

  /** 指定された日付が表示可能な範囲内かチェック */
  private isDateInAvailableRange(date: Date): boolean {
    // ✅ 修正: 無効な日付のチェックを追加
    if (!date || isNaN(date.getTime())) {
      return false;
    }
    if (!this.minAvailableDate || !this.maxAvailableDate) {
      return true; // 制限がない場合は常にtrue
    }

    // ✅ 修正: minAvailableDateとmaxAvailableDateが無効な日付の場合のチェックを追加
    if (
      isNaN(this.minAvailableDate.getTime()) ||
      isNaN(this.maxAvailableDate.getTime())
    ) {
      return true; // 無効な範囲の場合は制限なしとして扱う
    }

    // 月単位で比較（日付の詳細は無視）
    const dateYear = date.getFullYear();
    const dateMonth = date.getMonth();
    const minYear = this.minAvailableDate.getFullYear();
    const minMonth = this.minAvailableDate.getMonth();
    const maxYear = this.maxAvailableDate.getFullYear();
    const maxMonth = this.maxAvailableDate.getMonth();

    const dateValue = dateYear * 12 + dateMonth;
    const minValue = minYear * 12 + minMonth;
    const maxValue = maxYear * 12 + maxMonth;

    return dateValue >= minValue && dateValue <= maxValue;
  }

  /** 前の月に移動できるかチェック */
  canMoveToPreviousMonth(): boolean {
    // ✅ 修正: currentDateが無効な日付の場合のチェックを追加
    if (!this.currentDate || isNaN(this.currentDate.getTime())) {
      return false;
    }
    if (!this.minAvailableDate) {
      return true;
    }
    const prevDate = new Date(this.currentDate);
    prevDate.setMonth(prevDate.getMonth() - 1);
    // ✅ 修正: 新しい日付が無効な場合のチェックを追加
    if (isNaN(prevDate.getTime())) {
      return false;
    }
    return this.isDateInAvailableRange(prevDate);
  }

  /** 次の月に移動できるかチェック */
  canMoveToNextMonth(): boolean {
    // ✅ 修正: currentDateが無効な日付の場合のチェックを追加
    if (!this.currentDate || isNaN(this.currentDate.getTime())) {
      return false;
    }
    if (!this.maxAvailableDate) {
      return true;
    }
    const nextDate = new Date(this.currentDate);
    nextDate.setMonth(nextDate.getMonth() + 1);
    // ✅ 修正: 新しい日付が無効な場合のチェックを追加
    if (isNaN(nextDate.getTime())) {
      return false;
    }
    return this.isDateInAvailableRange(nextDate);
  }

  /** ステータスを表示（言語設定に応じて） */
  getStatusDisplay(status: string | null | undefined): string {
    // ✅ 修正: statusがnull/undefinedの場合のチェックを追加
    if (!status) {
      return '未着手'; // デフォルト値
    }
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
  getPriorityDisplay(priority: string | null | undefined): string {
    // ✅ 修正: priorityがnull/undefinedの場合のチェックを追加
    if (!priority) {
      return '中'; // デフォルト値
    }
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

  /** 曜日を取得（言語設定に応じて） */
  getWeekDays(): string[] {
    const currentLanguage = this.languageService.getCurrentLanguage();
    if (currentLanguage === 'en') {
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    }
    return ['日', '月', '火', '水', '木', '金', '土'];
  }

  /** 日付から曜日を安全に取得 */
  getWeekDay(date: Date): string {
    // ✅ 修正: 無効な日付のチェックを追加
    if (!date || isNaN(date.getTime())) {
      return '';
    }
    const dayIndex = date.getDay();
    // ✅ 修正: 範囲チェックを追加（0-6の範囲外の場合は空文字列を返す）
    if (dayIndex < 0 || dayIndex > 6) {
      return '';
    }
    const weekDays = this.getWeekDays();
    return weekDays[dayIndex] || '';
  }

  /** 日付から日を安全に取得 */
  getDayNumber(date: Date): number {
    // ✅ 修正: 無効な日付のチェックを追加
    if (!date || isNaN(date.getTime())) {
      return 0;
    }
    return date.getDate();
  }

  /** 表示モードのラベルを取得（言語設定に応じて） */
  getViewModeLabel(mode: 'day' | 'week' | 'month' | null | undefined): string {
    // ✅ 修正: modeがnull/undefinedの場合のチェックを追加
    if (!mode || (mode !== 'day' && mode !== 'week' && mode !== 'month')) {
      return '月'; // デフォルト値
    }
    const currentLanguage = this.languageService.getCurrentLanguage();
    const labelMap: Record<string, Record<'ja' | 'en', string>> = {
      day: { ja: '日', en: 'Day' },
      week: { ja: '週', en: 'Week' },
      month: { ja: '月', en: 'Month' },
    };
    return labelMap[mode]?.[currentLanguage] || mode;
  }

  /** 残りのタスク数の表示テキストを取得（言語設定に応じて） */
  getRemainingTasksText(count: number): string {
    // ✅ 修正: countが無効な値（負の値やNaN）の場合のチェックを追加
    const validCount =
      typeof count === 'number' && !isNaN(count) && count >= 0 ? count : 0;
    const currentLanguage = this.languageService.getCurrentLanguage();
    if (currentLanguage === 'en') {
      return `+${validCount} more`;
    }
    return `他${validCount}件`;
  }

  /** タスクのツールチップテキストを取得 */
  getTaskTooltip(task: Task): string {
    // ✅ 修正: taskがnull/undefinedの場合のチェックを追加
    if (!task) {
      return '';
    }
    const statusDisplay = this.getStatusDisplay(task.status || '');
    const dueDateLabel = this.languageService.translate(
      'calendar.taskTooltip.dueDate'
    );
    const dueDate = task.dueDate || '';
    return `${
      task.taskName || ''
    } (${statusDisplay}) - ${dueDateLabel}${dueDate}`;
  }
}
