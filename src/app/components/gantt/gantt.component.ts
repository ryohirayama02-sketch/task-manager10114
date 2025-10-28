import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { ProjectFormDialogComponent } from '../project-form-dialog/project-form-dialog.component';
import { Task, Project } from '../../models/task.model';

@Component({
  selector: 'app-gantt',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatChipsModule,
    MatMenuModule,
    FormsModule,
  ],
  templateUrl: './gantt.component.html',
  styleUrls: ['./gantt.component.css'],
})
export class GanttComponent implements OnInit {
  tasks: Task[] = [];
  projects: Project[] = [];
  selectedProjectIds: string[] = [];
  allTasks: Task[] = [];

  // フィルター用
  filterPriority: string = '';
  filterAssignee: string = '';
  filterStatus: string = '';

  // 日付範囲
  startDate: Date = new Date();
  endDate: Date = new Date();
  dateRange: Date[] = [];

  // スクロール位置追跡
  currentScrollLeft: number = 0;

  // 担当者列の動的幅
  assigneeColumnWidth: number = 118;

  // 全体の動的幅
  totalInfoWidth: number = 525;

  // マイルストーン
  allMilestones: any[] = [];

  // ツールチップ
  tooltipVisible: boolean = false;
  tooltipPosition: { x: number; y: number } = { x: 0, y: 0 };
  tooltipMilestone: any = null;

  // ステータス色
  statusColors: { [key: string]: string } = {
    未着手: '#ffcdd2',
    作業中: '#bbdefb',
    完了: '#c8e6c9',
  };

  constructor(
    private projectService: ProjectService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeDateRange();
    this.loadProjects();
    this.setupScrollSync();
  }

  /** 日付範囲を初期化 */
  initializeDateRange() {
    const today = new Date();
    this.startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    this.endDate = new Date(today.getFullYear(), today.getMonth() + 3, 0);
    this.generateDateRange();
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
      this.loadAllTasks();
      this.loadAllMilestones();

      // 最初のプロジェクトを選択
      const appProject = projects.find(
        (p) => p.projectName === 'アプリ A改善プロジェクト'
      );
      if (appProject) {
        this.selectedProjectIds = [appProject.id];
        this.filterTasksBySelectedProjects();
      }
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
              projectId: project.id!,
              projectName: project.projectName,
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
    if (this.filterPriority) {
      filteredTasks = filteredTasks.filter(
        (task) => task.priority === this.filterPriority
      );
    }

    // 担当者フィルター
    if (this.filterAssignee) {
      filteredTasks = filteredTasks.filter(
        (task) => task.assignee === this.filterAssignee
      );
    }

    // ステータスフィルター
    if (this.filterStatus) {
      filteredTasks = filteredTasks.filter(
        (task) => task.status === this.filterStatus
      );
    }

    // フィルター後の結果を表示
    this.tasks = filteredTasks;
    this.calculateAssigneeColumnWidth(); // フィルター適用後も担当者列の幅を計算
  }

  /** プロジェクト選択をトグル */
  toggleProjectSelection(projectId: string) {
    const index = this.selectedProjectIds.indexOf(projectId);
    if (index > -1) {
      this.selectedProjectIds.splice(index, 1);
    } else {
      this.selectedProjectIds.push(projectId);
    }
    this.filterTasksBySelectedProjects();
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

  /** 現在表示されている年月を取得 */
  getVisibleYearMonth(): string {
    // 現在のスクロール位置を取得（簡易実装）
    // 実際のスクロール位置に基づいて表示する年月を決定
    const scrollLeft = this.getCurrentScrollLeft();
    const cellWidth = 30;
    const visibleStartIndex = Math.floor(scrollLeft / cellWidth);

    // 表示開始位置を含む年月グループを検索
    const groups = this.getGroupedDates();
    for (const group of groups) {
      if (
        visibleStartIndex >= group.startIndex &&
        visibleStartIndex <= group.endIndex
      ) {
        return group.yearMonth;
      }
    }

    // フォールバック：最初のグループを返す
    return groups.length > 0 ? groups[0].yearMonth : '';
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
    if (!this.tasks || this.tasks.length === 0) {
      this.assigneeColumnWidth = 118; // デフォルト幅
      this.calculateTotalInfoWidth();
      return;
    }

    // 担当者名の最大長を計算
    const maxLength = Math.max(
      ...this.tasks.map((task) => (task.assignee ? task.assignee.length : 0)),
      3 // 最小値は「担当者」の3文字
    );

    // より正確な幅計算（日本語文字は約14px、英数字は約8px、パディング16px + ボーダー1px）
    const calculatedWidth = Math.max(
      maxLength * 14 + 16 + 1, // 日本語文字を考慮して14px/文字
      118 // 最小幅
    );

    this.assigneeColumnWidth = Math.min(calculatedWidth, 300); // 最大300pxに拡張
    this.calculateTotalInfoWidth();
  }

  /** 全体の情報列幅を計算 */
  calculateTotalInfoWidth(): void {
    // プロジェクト名(148) + タスク名(198) + 優先度(58) + 担当者(動的) + ボーダー(3)
    this.totalInfoWidth = 148 + 198 + 58 + this.assigneeColumnWidth + 3;
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

  /** プロジェクト作成ダイアログを開く */
  openProjectDialog() {
    const ref = this.dialog.open(ProjectFormDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
      disableClose: false,
      autoFocus: true,
    });
    ref.afterClosed().subscribe((result) => {
      if (result === 'success') {
        console.log('新しいプロジェクトが登録されました');
        this.loadProjects();
      }
    });
  }

  /** フィルターをリセット */
  resetFilters() {
    this.filterPriority = '';
    this.filterAssignee = '';
    this.filterStatus = '';
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
        });

        // ガントバー列のスクロールを日付ヘッダーに同期
        ganttBarsColumn.addEventListener('scroll', () => {
          dateHeader.scrollLeft = ganttBarsColumn.scrollLeft;
          this.updateScrollPosition(ganttBarsColumn.scrollLeft);
        });
      }
    }, 100);
  }
}
