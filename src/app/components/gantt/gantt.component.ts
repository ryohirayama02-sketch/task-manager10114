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
import { ProjectService } from '../../services/project.service';
import { ProjectFormDialogComponent } from '../project-form-dialog/project-form-dialog.component';

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
  tasks: any[] = [];
  projects: any[] = [];
  selectedProjectIds: string[] = [];
  allTasks: any[] = [];

  // フィルター用
  filterPriority: string = '';
  filterAssignee: string = '';
  filterStatus: string = '';

  // 日付範囲
  startDate: Date = new Date();
  endDate: Date = new Date();
  dateRange: Date[] = [];

  // ステータス色
  statusColors: { [key: string]: string } = {
    未着手: '#ffcdd2',
    作業中: '#bbdefb',
    完了: '#c8e6c9',
  };

  constructor(
    private projectService: ProjectService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.initializeDateRange();
    this.loadProjects();
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
      this.projectService.getTasksByProjectId(project.id).subscribe((tasks) => {
        const tasksWithProject = tasks.map((task) => ({
          ...task,
          projectId: project.id,
          projectName: project.projectName,
        }));

        this.allTasks = this.allTasks.filter((t) => t.projectId !== project.id);
        this.allTasks = [...this.allTasks, ...tasksWithProject];
        this.filterTasksBySelectedProjects();
      });
    });
  }

  /** 選択されたプロジェクトのタスクをフィルタリング */
  filterTasksBySelectedProjects() {
    if (this.selectedProjectIds.length === 0) {
      this.tasks = [];
    } else {
      this.tasks = this.allTasks.filter((task) =>
        this.selectedProjectIds.includes(task.projectId)
      );
    }
    this.applyFilters();
  }

  /** フィルターを適用 */
  applyFilters() {
    let filteredTasks = [...this.tasks];

    if (this.filterPriority) {
      filteredTasks = filteredTasks.filter(
        (task) => task.priority === this.filterPriority
      );
    }
    if (this.filterAssignee) {
      filteredTasks = filteredTasks.filter(
        (task) => task.assignee === this.filterAssignee
      );
    }
    if (this.filterStatus) {
      filteredTasks = filteredTasks.filter(
        (task) => task.status === this.filterStatus
      );
    }

    this.tasks = filteredTasks;
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
  getTaskStartDate(task: any): Date {
    return task.startDate ? new Date(task.startDate) : new Date();
  }

  /** タスクの終了日を取得 */
  getTaskEndDate(task: any): Date {
    return task.endDate ? new Date(task.endDate) : new Date();
  }

  /** タスクの期間を計算 */
  getTaskDuration(task: any): number {
    const start = this.getTaskStartDate(task);
    const end = this.getTaskEndDate(task);
    return (
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
  }

  /** タスクの開始位置を計算 */
  getTaskStartPosition(task: any): number {
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

  /** プロジェクト作成ダイアログを開く */
  openProjectDialog() {
    const ref = this.dialog.open(ProjectFormDialogComponent, {
      width: '450px',
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
  isDateInTaskRange(date: Date, task: any): boolean {
    const taskStart = this.getTaskStartDate(task);
    const taskEnd = this.getTaskEndDate(task);
    return date >= taskStart && date <= taskEnd;
  }

  /** タスクバーの位置を計算 */
  getTaskBarPosition(date: Date, task: any): number {
    const taskStart = this.getTaskStartDate(task);
    const daysDiff = Math.floor(
      (date.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, (daysDiff * 100) / this.dateRange.length);
  }

  /** タスクバーの幅を計算 */
  getTaskBarWidth(date: Date, task: any): number {
    const taskStart = this.getTaskStartDate(task);
    const taskEnd = this.getTaskEndDate(task);
    const totalDays =
      Math.ceil(
        (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
    return (totalDays * 100) / this.dateRange.length;
  }
}
