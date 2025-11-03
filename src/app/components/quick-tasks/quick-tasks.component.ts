import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../services/auth.service';
import { Task } from '../../models/task.model';
import { DEFAULT_PROJECT_THEME_COLOR } from '../../constants/project-theme-colors';

@Component({
  selector: 'app-quick-tasks',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './quick-tasks.component.html',
  styleUrl: './quick-tasks.component.css',
})
export class QuickTasksComponent implements OnInit, OnDestroy {
  readonly defaultThemeColor = DEFAULT_PROJECT_THEME_COLOR;
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  loading = false;
  daysFilter = 7;
  daysOptions = [3, 7, 14, 30];
  debugMode = false;
  allTasks: any[] = [];
  currentUser: any = null;
  filteredTasksByUser: any[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private taskService: TaskService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // 認証状態を確認
    this.authService.user$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      if (user) {
        this.currentUser = user;
        console.log('🔐 認証されたユーザー:', {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        });
        this.loadQuickTasks();
      } else {
        this.currentUser = null;
        console.log('❌ ユーザーが認証されていません');
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadQuickTasks() {
    this.loading = true;
    const userEmail = this.currentUser?.email;

    if (!userEmail) {
      console.log('❌ ユーザーが認証されていないため、タスクを読み込めません');
      this.tasks = [];
      this.filteredTasks = [];
      this.loading = false;
      return;
    }

    this.taskService
      .getQuickTasks(this.daysFilter, userEmail)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks) => {
          // 期日順でソート（近い順）
          const sortedTasks = tasks.sort((a, b) => {
            if (a.dueDate < b.dueDate) return -1;
            if (a.dueDate > b.dueDate) return 1;
            return 0;
          });

          this.tasks = sortedTasks;
          this.filteredTasks = [...sortedTasks];
          this.loading = false;
          console.log(
            `✅ すぐやるタスクを読み込み完了: ${sortedTasks.length}件`
          );
          console.log(`👤 ユーザー: ${userEmail}`);
          console.log(`📅 期日設定: ${this.daysFilter}日以内`);
          console.log('📅 期日順でソート済み（近い順）');
        },
        error: (error) => {
          console.error('❌ すぐやるタスクの読み込みエラー:', error);
          this.loading = false;
        },
      });
  }

  onDaysFilterChange() {
    this.loadQuickTasks();
  }

  onTaskClick(task: Task) {
    if (task.id && task.projectId) {
      this.router.navigate(['/project', task.projectId, 'task', task.id]);
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case '高':
        return 'warn';
      case '中':
        return 'accent';
      case '低':
        return 'primary';
      default:
        return 'primary';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case '未着手':
        return 'primary';
      case '作業中':
        return 'accent';
      case '完了':
        return 'warn';
      default:
        return 'primary';
    }
  }

  getDaysUntilDue(dueDate: string): number {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  isOverdue(dueDate: string): boolean {
    return this.getDaysUntilDue(dueDate) < 0;
  }

  isDueSoon(dueDate: string): boolean {
    const daysUntil = this.getDaysUntilDue(dueDate);
    return daysUntil >= 2 && daysUntil <= 3;
  }

  getDueStatusClass(task: Task): string {
    const daysUntil = this.getDaysUntilDue(task.dueDate);
    if (daysUntil < 0) {
      return 'overdue';
    }
    if (daysUntil === 0) {
      return 'due-today';
    }
    if (daysUntil === 1) {
      return 'due-tomorrow';
    }
    if (daysUntil >= 2 && daysUntil <= 3) {
      return 'due-soon';
    }
    return '';
  }

  trackByTaskId(index: number, task: Task): string {
    return task.id || index.toString();
  }

  // テンプレート内でMath.abs()を使用するためのヘルパーメソッド
  getAbsoluteValue(value: number): number {
    return Math.abs(value);
  }

  getProjectNameStyle(task: Task) {
    const color = task.projectThemeColor || this.defaultThemeColor;
    return {
      backgroundColor: color,
      color: '#1f2933',
    };
  }

  // デバッグ用：すべてのタスクを取得
  loadAllTasksForDebug() {
    console.log('🔍 デバッグモード：すべてのタスクを取得中...');
    this.loading = true;
    this.taskService
      .getAllTasksForDebug()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks) => {
          this.allTasks = tasks;
          this.filterTasksByUser();
          this.loading = false;
          console.log(`✅ デバッグ用タスク取得完了: ${tasks.length}件`);
        },
        error: (error) => {
          console.error('❌ デバッグ用タスク取得エラー:', error);
          this.loading = false;
        },
      });
  }

  // 現在のユーザーに関連するタスクをフィルタリング
  filterTasksByUser() {
    if (!this.currentUser) {
      console.log(
        '❌ ユーザーが認証されていないため、フィルタリングをスキップ'
      );
      this.filteredTasksByUser = [];
      return;
    }

    console.log('🔍 ユーザーフィルタリング開始');
    console.log('🔐 現在のユーザー:', {
      uid: this.currentUser.uid,
      email: this.currentUser.email,
      displayName: this.currentUser.displayName,
    });

    const filteredTasks = this.allTasks.filter((task) => {
      // タスクの担当者情報を確認
      const assigneeEmail = task.assigneeEmail || task.assignee;
      const assigneeName = task.assignee;

      console.log(`📋 タスク「${task.taskName}」の担当者情報:`, {
        assigneeEmail,
        assigneeName,
        userEmail: this.currentUser.email,
        userDisplayName: this.currentUser.displayName,
      });

      // メールアドレスまたは表示名でマッチング
      const isAssignedToUser =
        assigneeEmail === this.currentUser.email ||
        assigneeName === this.currentUser.email ||
        assigneeName === this.currentUser.displayName ||
        assigneeEmail === this.currentUser.displayName;

      if (isAssignedToUser) {
        console.log(
          `✅ タスク「${task.taskName}」は現在のユーザーに割り当てられています`
        );
      } else {
        console.log(
          `❌ タスク「${task.taskName}」は現在のユーザーに割り当てられていません`
        );
      }

      return isAssignedToUser;
    });

    // 期日順でソート（近い順）
    this.filteredTasksByUser = filteredTasks.sort((a, b) => {
      if (a.dueDate < b.dueDate) return -1;
      if (a.dueDate > b.dueDate) return 1;
      return 0;
    });

    console.log(
      `📊 ユーザーフィルタリング結果: ${this.filteredTasksByUser.length}件`
    );
    console.log('📅 期日順でソート済み（近い順）');
  }

  // デバッグモードの切り替え
  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    if (this.debugMode) {
      this.loadAllTasksForDebug();
    }
  }
}
