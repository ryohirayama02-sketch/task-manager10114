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
import { Member } from '../../models/member.model';
import { getMemberNamesAsString } from '../../utils/member-utils';

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
  members: Member[] = []; // メンバー一覧

  private destroy$ = new Subject<void>();

  constructor(
    private taskService: TaskService,
    private router: Router,
    private authService: AuthService,
    private languageService: LanguageService,
    private memberService: MemberManagementService
  ) {}

  ngOnInit() {
    // メンバー一覧を読み込み
    this.memberService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
        console.log('メンバー一覧を読み込みました:', members.length, '件');
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
      },
    });

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

    // メンバー一覧が読み込まれていることを確認
    if (this.members.length === 0) {
      console.warn(
        '⚠️ メンバー一覧がまだ読み込まれていません。タスク取得を待機します...'
      );
      // メンバー一覧の読み込みを待つ
      this.memberService.getMembers().subscribe({
        next: (members) => {
          this.members = members;
          console.log(
            'メンバー一覧を読み込みました（タスク取得前）:',
            members.length,
            '件'
          );
          // メンバー一覧が読み込まれたらタスクを取得
          this.loadTasksAfterMembersLoaded(userEmail, memberName);
        },
        error: (error) => {
          console.error('メンバー一覧の読み込みエラー:', error);
          // エラーでもタスク取得は続行
          this.loadTasksAfterMembersLoaded(userEmail, memberName);
        },
      });
    } else {
      // メンバー一覧が既に読み込まれている場合はそのままタスク取得
      this.loadTasksAfterMembersLoaded(userEmail, memberName);
    }
  }

  /** メンバー一覧読み込み後のタスク取得 */
  private loadTasksAfterMembersLoaded(
    userEmail: string,
    memberName: string | undefined
  ) {
    this.taskService
      .getQuickTasks(this.daysFilter, userEmail, memberName)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks: Task[]) => {
          // デバッグ: 各タスクのassignedMembersを確認
          tasks.forEach((task) => {
            if (task.assignedMembers && task.assignedMembers.length > 0) {
              console.log('🔍 [loadQuickTasks] タスク:', task.taskName);
              console.log('   - assignedMembers:', task.assignedMembers);
              console.log('   - this.members.length:', this.members.length);
            }
          });

          this.tasks = tasks.sort((a, b) => {
            // まず期日でソート
            if (a.dueDate < b.dueDate) return -1;
            if (a.dueDate > b.dueDate) return 1;

            // 期日が同じ場合は優先度でソート（高、中、低の順）
            const priorityOrder: { [key: string]: number } = {
              高: 1,
              中: 2,
              低: 3,
            };
            const priorityA = priorityOrder[a.priority] || 999;
            const priorityB = priorityOrder[b.priority] || 999;

            return priorityA - priorityB;
          });
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

  /** 📝 プロジェクト名を30文字に制限 */
  formatProjectName(projectName?: string | null): string {
    if (!projectName) {
      return `（${this.languageService.translate('common.nameNotSet')}）`;
    }
    const name = projectName.trim();
    if (name.length <= 30) {
      return name;
    }
    return name.slice(0, 27) + '...';
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

    // 今日の日付をローカルタイムゾーンで取得（時刻を00:00:00に設定）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 期日をローカルタイムゾーンで取得
    let due: Date;
    if (typeof dueDate === 'string') {
      // 文字列形式（YYYY-MM-DD）の場合、ローカルタイムゾーンで日付を作成
      const [year, month, day] = dueDate.split('T')[0].split('-').map(Number);
      due = new Date(year, month - 1, day);
      due.setHours(0, 0, 0, 0);
    } else {
      // Dateオブジェクトの場合
      due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
    }

    // 日数の差分を計算（ミリ秒→日数）
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

  /** ステータスを翻訳 */
  translateStatus(status: string): string {
    switch (status) {
      case '完了':
        return this.languageService.translate('progress.status.completed');
      case '作業中':
        return this.languageService.translate('progress.status.inProgress');
      case '未着手':
        return this.languageService.translate('progress.status.notStarted');
      default:
        return status;
    }
  }

  /** 優先度を翻訳 */
  translatePriority(priority: string): string {
    switch (priority) {
      case '高':
        return this.languageService.translate('progress.priority.high');
      case '中':
        return this.languageService.translate('progress.priority.medium');
      case '低':
        return this.languageService.translate('progress.priority.low');
      default:
        return priority;
    }
  }

  /** タスクの担当者を表示（カンマ区切り対応） */
  getTaskAssigneeDisplay(task: Task): string {
    const displayNames: string[] = [];
    const foundMemberIds = new Set<string>();

    // assignedMembers がある場合はそれを使用
    if (task.assignedMembers && task.assignedMembers.length > 0) {
      // デバッグ: assignedMembersとmembersの内容を確認
      console.log(
        '🔍 [QuickTasks getTaskAssigneeDisplay] タスク:',
        task.taskName
      );
      console.log('   - assignedMembers:', task.assignedMembers);
      console.log('   - this.members.length:', this.members.length);
      console.log(
        '   - this.membersのID一覧:',
        this.members.map((m) => ({ id: m.id, name: m.name }))
      );

      // 各assignedMembersのIDがmembersに存在するか確認
      task.assignedMembers.forEach((memberId, index) => {
        const member = this.members.find((m) => m.id === memberId);

        console.log(
          `   - assignedMembers[${index}]: ${memberId} → ${
            member ? `${member.name} (id: ${member.id})` : '(見つからない)'
          }`
        );

        if (member && member.name) {
          // メンバーが見つかった場合、名前を追加（IDベースで1人として扱う）
          displayNames.push(member.name);
          foundMemberIds.add(memberId);
          console.log(`   ✅ メンバー "${member.name}" を追加しました`);
        } else {
          // メンバーが見つからない場合、デバッグ情報を出力
          console.warn(`⚠️ メンバーID "${memberId}" が見つかりません`);
          console.warn(
            `   - 検索対象のメンバーID一覧:`,
            this.members.map((m) => m.id)
          );

          // メンバーが見つからない場合でも、assigneeから補完を試みる
          // （ただし、assigneeが無効な値の場合はスキップ）
        }
      });

      // assignedMembersから取得できなかったメンバーIDがある場合、assigneeから補完を試みる
      const notFoundMemberIds = task.assignedMembers.filter(
        (id) => !foundMemberIds.has(id)
      );

      if (notFoundMemberIds.length > 0) {
        console.log(
          '   - assignedMembersから取得できなかったID:',
          notFoundMemberIds
        );
        console.log('   - assignee:', task.assignee);

        // assigneeがある場合、それを補完として使用
        if (task.assignee) {
          const assigneeNames = task.assignee
            .split(',')
            .map((n) => n.trim())
            .filter((n) => n.length > 0 && n !== '33333333333333333333'); // 明らかに無効な値は除外

          // assigneeの名前で、まだ表示されていないものを追加
          assigneeNames.forEach((name) => {
            // 既に表示されている名前と重複していない場合のみ追加
            if (
              !displayNames.some((n) => n.toLowerCase() === name.toLowerCase())
            ) {
              displayNames.push(name);
            }
          });
        }
      }

      // 結果を返す
      if (displayNames.length > 0) {
        const uniqueNames = [...new Set(displayNames)];
        console.log('   - assignedMembersから取得した名前:', uniqueNames);
        console.log('   - assignedMembersの総数:', task.assignedMembers.length);
        console.log('   - 取得できた名前の数:', uniqueNames.length);
        console.log('   - 最終的な表示名:', uniqueNames);
        return uniqueNames.join(', ');
      }
    }

    // assignedMembersがない、またはメンバーが見つからない場合は assignee を使用
    if (task.assignee) {
      const assigneeNames = task.assignee
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n.length > 0 && n !== '33333333333333333333'); // 明らかに無効な値は除外
      console.log('   - assigneeから取得:', assigneeNames);
      return assigneeNames.length > 0 ? assigneeNames.join(', ') : '—';
    }

    return '—';
  }
}
