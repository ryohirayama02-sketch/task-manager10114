import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
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
import { Subject, combineLatest, of, takeUntil, switchMap } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ProjectSelectionService } from '../../services/project-selection.service';
import { OfflineService } from '../../services/offline.service';
import { Task } from '../../models/task.model';
import { IProject } from '../../models/project.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AuthService } from '../../services/auth.service';
import { MemberManagementService } from '../../services/member-management.service';
import { Member } from '../../models/member.model';
import { getMemberNamesAsString } from '../../utils/member-utils';

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
  members: Member[] = []; // メンバー一覧

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
  tooltipMilestones: any[] = [];
  @ViewChild('tooltip', { static: false }) tooltipElement?: ElementRef;

  constructor(
    private projectService: ProjectService,
    private projectSelectionService: ProjectSelectionService,
    private router: Router,
    private offlineService: OfflineService,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    private memberManagementService: MemberManagementService
  ) {}

  ngOnInit(): void {
    // メンバー一覧を読み込み
    this.memberManagementService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
        console.log('メンバー一覧を読み込みました:', members.length, '件');
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
      },
    });

    this.generateCalendarDays();
    this.observeUserProjects();

    this.projectSelectionService
      .getSelectedProjectIds()
      .pipe(takeUntil(this.destroy$))
      .subscribe((projectIds: string[]) => {
        this.selectedProjectIds = projectIds;
        this.filterTasksBySelectedProjects();
      });

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

  private observeUserProjects(): void {
    this.authService.currentUserEmail$
      .pipe(
        switchMap((userEmail) => {
          console.log('🔑 現在のユーザー情報(カレンダー):', { userEmail });
          if (!userEmail) {
            this.resetProjectState(true);
            return of([]);
          }
          return this.projectService.getProjects();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((projects) => {
        console.log('🎯 カレンダー用ルーム内全プロジェクト一覧:', projects);
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
          .subscribe((tasks: Task[]) => {
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
    // 担当者フィルター（カンマ区切り対応）
    if (this.filterAssignee.length > 0) {
      filteredTasks = filteredTasks.filter((task) => {
        if (!task.assignee) {
          return false;
        }
        // assignee をカンマで分割
        const assignees = task.assignee
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name.length > 0);
        
        // assignedMembers も含める
        if (Array.isArray((task as any).assignedMembers)) {
          assignees.push(
            ...(task as any).assignedMembers.map((m: string) => String(m).trim())
          );
        }
        
        // フィルター値とマッチするか確認
        return assignees.some((assignee) =>
          this.filterAssignee.includes(assignee)
        );
      });
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
      if (!task.dueDate) return false;

      // ローカルタイムゾーンで日付文字列を生成（YYYY-MM-DD形式）
      const dateYear = date.getFullYear();
      const dateMonth = String(date.getMonth() + 1).padStart(2, '0');
      const dateDay = String(date.getDate()).padStart(2, '0');
      const dateStr = `${dateYear}-${dateMonth}-${dateDay}`;

      // dueDateが文字列形式（YYYY-MM-DD）の場合
      if (typeof task.dueDate === 'string') {
        // 時刻部分を除去
        const dueDateStr = task.dueDate.split('T')[0];
        return dueDateStr === dateStr;
      }

      // dueDateがDateオブジェクトの場合
      const dueDate = new Date(task.dueDate);
      const dueYear = dueDate.getFullYear();
      const dueMonth = String(dueDate.getMonth() + 1).padStart(2, '0');
      const dueDay = String(dueDate.getDate()).padStart(2, '0');
      const dueDateStr = `${dueYear}-${dueMonth}-${dueDay}`;

      return dueDateStr === dateStr;
    });
  }

  /** 日付が今日かチェック */
  isToday(date: Date): boolean {
    const today = new Date();
    // ローカルタイムゾーンで日付を比較
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
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

  /** タスクの担当者を表示（カンマ区切り対応） */
  getTaskAssigneeDisplay(task: Task): string {
    // assignedMembers がある場合はそれを使用
    if (task.assignedMembers && task.assignedMembers.length > 0) {
      // デバッグ: assignedMembersとmembersの内容を確認
      console.log('🔍 [Calendar getTaskAssigneeDisplay] タスク:', task.taskName);
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
      console.log('   - 表示結果:', display);
      return display === '未設定' ? '—' : display;
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
}
