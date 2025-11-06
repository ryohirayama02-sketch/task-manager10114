import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { TaskService } from '../../services/task.service';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { MemberManagementService } from '../../services/member-management.service';
import { Task } from '../../models/task.model';
import { DEFAULT_PROJECT_THEME_COLOR } from '../../constants/project-theme-colors';
import { TranslatePipe } from '../../pipes/translate.pipe';

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
    MatCheckboxModule,
    MatSnackBarModule,
    FormsModule,
    TranslatePipe,
  ],
  templateUrl: './quick-tasks.component.html',
  styleUrl: './quick-tasks.component.css',
})
export class QuickTasksComponent implements OnInit, OnDestroy {
  readonly defaultThemeColor = DEFAULT_PROJECT_THEME_COLOR;
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  allTasks: Task[] = [];
  loading = false;
  daysFilter = 7;
  daysOptions = [3, 7, 14, 30];
  debugMode = false;
  currentUser: any = null;

  private destroy$ = new Subject<void>();

  constructor(
    private taskService: TaskService,
    private router: Router,
    private authService: AuthService,
    private languageService: LanguageService,
    private memberService: MemberManagementService
  ) {}

  ngOnInit() {
    this.authService.user$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      if (user) {
        this.currentUser = user;
        void this.loadQuickTasks();
      } else {
        this.currentUser = null;
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** 🔁 日数フィルター変更時 */
  onDaysFilterChange() {
    this.loadQuickTasks();
  }

  /** 📦 タスク取得 */
  async loadQuickTasks() {
    this.loading = true;
    const userEmail = this.currentUser?.email;
    if (!userEmail) return;

    let memberName: string | undefined;
    try {
      const member = await this.memberService.getMemberByEmail(userEmail);
      memberName = member?.name || undefined;
    } catch (error) {
      console.error('メンバー情報の取得に失敗しました', error);
    }

    this.taskService
      .getQuickTasks(this.daysFilter, userEmail, memberName)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks: Task[]) => {
          this.tasks = tasks.sort((a, b) =>
            a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0
          );
          this.filteredTasks = [...this.tasks];
          this.loading = false;
          console.log(`✅ すぐやるタスク取得完了: ${tasks.length}件`);
        },
        error: (err: any) => {
          console.error('❌ タスク読み込みエラー:', err);
          this.loading = false;
        },
      });
  }

  /** 🧩 デバッグモード切替 */
  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    console.log(`🧩 デバッグモード: ${this.debugMode ? 'ON' : 'OFF'}`);
    if (this.debugMode) {
      this.loadAllTasksForDebug();
    }
  }

  /** 🔍 全タスク取得（デバッグ用） */
  loadAllTasksForDebug() {
    // TaskService に getAllTasksForDebug() が未実装の場合、一時的にコメントアウト可
    if (!('getAllTasksForDebug' in this.taskService)) {
      console.warn('⚠️ getAllTasksForDebug() が TaskService に存在しません');
      return;
    }

    this.loading = true;
    (this.taskService as any)
      .getAllTasksForDebug()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks: Task[]) => {
          this.allTasks = tasks;
          this.loading = false;
          console.log(`✅ デバッグ用タスク取得完了: ${tasks.length}件`);
        },
        error: (error: any) => {
          console.error('❌ デバッグ用タスク取得エラー:', error);
          this.loading = false;
        },
      });
  }

  /** 🎨 プロジェクト名の背景色 */
  getProjectNameStyle(task: Task) {
    const color = task.projectThemeColor || this.defaultThemeColor;
    return {
      backgroundColor: color,
      color: '#1f2933',
    };
  }

  /** 📂 タスククリック時の遷移 */
  onTaskClick(task: Task) {
    if (task.id && task.projectId) {
      this.router.navigate(['/project', task.projectId, 'task', task.id]);
    }
  }

  /** 🔢 トラッキング用ID */
  trackByTaskId(index: number, task: Task): string {
    return task.id ?? ''; // undefined 対策
  }

  /** 🧮 期日までの日数 */
  getDaysUntilDue(dueDate: string): number {
    if (!dueDate) return 0;
    const today = new Date();
    const due = new Date(dueDate);
    const diff = due.getTime() - today.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /** ⚠️ 期限切れチェック */
  isOverdue(dueDate: string): boolean {
    return this.getDaysUntilDue(dueDate) < 0;
  }

  /** ⏰ 近日中（2〜3日以内） */
  isDueSoon(dueDate: string): boolean {
    const days = this.getDaysUntilDue(dueDate);
    return days >= 2 && days <= 3;
  }

  /** ➕ 日数絶対値 */
  getAbsoluteValue(value: number): number {
    return Math.abs(value);
  }

  /** 🧩 CSSクラス判定 */
  getDueStatusClass(task: Task): any {
    const days = this.getDaysUntilDue(task.dueDate);
    return {
      overdue: days < 0,
      'due-today': days === 0,
      'due-tomorrow': days === 1,
      'due-soon': days >= 2 && days <= 3,
    };
  }
}
