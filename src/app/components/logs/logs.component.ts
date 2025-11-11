import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditLogService } from '../../services/edit-log.service';
import { EditLog } from '../../models/task.model';
import { DocumentSnapshot, Firestore, collection, query, where, collectionData } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PeriodFilterDialogComponent } from '../progress/period-filter-dialog/period-filter-dialog.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ProjectService } from '../../services/project.service';
import { MemberManagementService } from '../../services/member-management.service';
import { Member } from '../../models/member.model';
import { AuthService } from '../../services/auth.service';
import { take } from 'rxjs';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { getMemberName } from '../../utils/member-utils';
import { Auth, getAuth } from '@angular/fire/auth';
import { Router, NavigationEnd } from '@angular/router';
import { filter, switchMap } from 'rxjs/operators';
import { Subject, Observable, of } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { IProject } from '../../models/project.model';
import { ProjectThemeColor } from '../../constants/project-theme-colors';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.css',
})
export class LogsComponent implements OnInit, OnDestroy {
  private readonly dialog = inject(MatDialog);
  private readonly projectService = inject(ProjectService);
  private readonly editLogService = inject(EditLogService);
  private readonly memberManagementService = inject(MemberManagementService);
  private readonly authService = inject(AuthService);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly firestore = inject(Firestore);
  private readonly destroy$ = new Subject<void>();

  editLogs: EditLog[] = [];
  private allLogs: EditLog[] = [];
  loading = false;
  hasMoreLogs = true;
  lastDocument: DocumentSnapshot | null = null;
  filterProjects: string[] = [];
  filterTasks: string[] = [];
  filterMembers: string[] = [];
  projectOptions: string[] = [];
  taskOptions: string[] = [];
  memberOptions: string[] = [];
  periodStartDate: Date | null = null;
  periodEndDate: Date | null = null;
  private projectNameMap = new Map<string, string>();
  private allMembers: Member[] = []; // メンバー一覧
  private currentProjectNames = new Set<string>(); // 現在存在するプロジェクト名のセット
  private currentTaskNames = new Set<string>(); // 現在存在するタスク名のセット
  
  // プロジェクトテーマカラーの16進表記から色名へのマッピング
  private readonly themeColorLabelMap: Record<string, string> = {
    // 現在のカラー
    '#fde4ec': 'ピンク',
    '#ffe6dc': 'ピーチ',
    '#ffedd6': 'アプリコット',
    '#fff8e4': 'イエロー',
    '#eef6da': 'ライム',
    '#e4f4e8': 'ミント',
    '#dcf3f0': 'ブルーグリーン',
    '#def3ff': 'スカイブルー',
    '#e6e9f9': 'ラベンダーブルー',
    '#ece6f8': 'パープル',
    // レガシーカラー（古いカラーコードも対応）
    '#f8bbd0': 'ピンク',
    '#ffccbc': 'ピーチ',
    '#ffe0b2': 'アプリコット',
    '#fff9c4': 'イエロー',
    '#dcedc8': 'ライム',
    '#c8e6c9': 'ミント',
    '#b2dfdb': 'ブルーグリーン',
    '#b3e5fc': 'スカイブルー',
    '#c5cae9': 'ラベンダーブルー',
    '#d1c4e9': 'パープル',
  };

  ngOnInit() {
    // メンバー一覧を読み込み
    this.memberManagementService.getMembers().subscribe({
      next: (members) => {
        this.allMembers = members;
        console.log('メンバー一覧を読み込みました:', members.length, '件');
        this.updateMemberOptions();
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
      },
    });

    // ルーターイベントを監視して、編集ログ画面に戻ってきた時にプロジェクト一覧を再読み込み
    let isInitialLoad = true;
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => {
        const navigationEnd = event as NavigationEnd;
        // 編集ログ画面に戻ってきた時（URLが /logs の場合）
        // ただし、初回の読み込み時は除外（ngOnInitで既に呼ばれるため）
        if (navigationEnd.urlAfterRedirects.includes('/logs')) {
          if (isInitialLoad) {
            isInitialLoad = false;
          } else {
            console.log('編集ログ画面に戻ってきました。プロジェクト一覧を再読み込みします。');
            this.loadProjectNames();
          }
        }
      });

    this.loadProjectNames();
    this.loadRecentLogs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** 直近の編集ログを読み込み */
  async loadRecentLogs(): Promise<void> {
    this.loading = true;
    try {
      const result = await this.editLogService.getRecentEditLogs();
      this.allLogs = result.logs.map((log) => ({ ...log }));
      this.lastDocument = result.lastDocument;
      this.hasMoreLogs = result.logs.length === 30 && !!this.lastDocument;
      this.applyProjectNameFallback();
      this.updateFilterOptions();
      this.applyFilters();
      console.log('編集ログを読み込みました:', this.allLogs.length, '件');
    } catch (error) {
      console.error('編集ログの読み込みエラー:', error);
    } finally {
      this.loading = false;
    }
  }

  /** さらに編集ログを読み込み */
  async loadMoreLogs(): Promise<void> {
    if (!this.hasMoreLogs || !this.lastDocument) {
      return;
    }

    this.loading = true;
    try {
      const result = await this.editLogService.getMoreEditLogs(
        this.lastDocument
      );
      this.allLogs = [
        ...this.allLogs,
        ...result.logs.map((log) => ({ ...log })),
      ];
      this.lastDocument = result.lastDocument;
      this.hasMoreLogs = result.logs.length === 30 && !!this.lastDocument;
      this.applyProjectNameFallback();
      this.updateFilterOptions();
      this.applyFilters();
      console.log('追加で編集ログを読み込みました:', result.logs.length, '件');
    } catch (error) {
      console.error('追加編集ログの読み込みエラー:', error);
    } finally {
      this.loading = false;
    }
  }

  /** CSV出力 */
  exportToCSV(): void {
    this.editLogService.exportToCSV(this.editLogs, (log) => this.getUserNameDisplay(log));
  }

  /** アクション名を取得 */
  getActionLabel(action: string): string {
    return this.editLogService.getActionLabel(action);
  }

  /** 変更内容を整形 */
  formatChangeDescription(log: EditLog): string {
    // 個別の変更詳細がある場合はそれを使用
    if (log.changes && log.changes.length > 0) {
      const changeDescriptions = log.changes
        .map((change) => this.formatChangeDetail(change))
        .filter((desc) => desc.length > 0);
      
      if (changeDescriptions.length > 0) {
        // アクションラベルを取得
        let actionLabel = '';
        if (log.action === 'update') {
          // タスク名がある場合は「タスクを更新しました」、ない場合は「プロジェクトを更新しました」
          actionLabel = log.taskName ? 'タスクを更新しました' : 'プロジェクトを更新しました';
        } else if (log.action === 'create') {
          actionLabel = log.taskName ? 'タスクを作成しました' : 'プロジェクトを作成しました';
        } else if (log.action === 'delete') {
          actionLabel = log.taskName ? 'タスクを削除しました' : 'プロジェクトを削除しました';
        } else {
          actionLabel = this.getActionLabel(log.action);
        }
        // 変更内容を括弧で囲む
        return `${actionLabel} 。(${changeDescriptions.join(', ')})`;
      }
    }

    // フォールバック：従来の方法
    const baseLabel = log.changeDescription?.trim() || '';
    const oldValue = log.oldValue?.toString().trim();
    const newValue = log.newValue?.toString().trim();
    const hasOld = !!oldValue;
    const hasNew = !!newValue;

    if (!hasOld && !hasNew) {
      return baseLabel || '';
    }

    if (hasOld && hasNew) {
      return baseLabel
        ? `${baseLabel} (${oldValue}→${newValue})`
        : `${oldValue}→${newValue}`;
    }

    if (hasNew) {
      return baseLabel
        ? `${baseLabel} (${newValue}が追加)`
        : `${newValue}が追加`;
    }

    return baseLabel
      ? `${baseLabel} (${oldValue}が削除)`
      : `${oldValue}が削除`;
  }

  /** 個別の変更詳細を整形 */
  formatChangeDetail(change: any): string {
    const field = change.field || '';
    let oldValue = change.oldValue?.toString().trim();
    let newValue = change.newValue?.toString().trim();
    const hasOld = !!oldValue;
    const hasNew = !!newValue;

    // プロジェクトテーマ色の場合は16進表記を色名に変換
    if (field === 'テーマ色' || field === 'themeColor') {
      if (oldValue) {
        oldValue = this.getThemeColorLabel(oldValue);
      }
      if (newValue) {
        newValue = this.getThemeColorLabel(newValue);
      }
    }

    if (!hasOld && !hasNew) {
      return '';
    }

    if (hasOld && hasNew) {
      return `${field}: ${oldValue}→${newValue}`;
    }

    if (hasNew) {
      return `${field}: ${newValue}が追加`;
    }

    return `${field}: ${oldValue}が削除`;
  }

  /** プロジェクトテーマカラーの16進表記を色名に変換 */
  private getThemeColorLabel(color: string): string {
    // #ffffffの場合は「なし」に変換
    if (color.toLowerCase() === '#ffffff') {
      return 'なし';
    }
    // 大文字小文字を区別しないように、小文字に変換してから検索
    const normalizedColor = color.toLowerCase();
    return this.themeColorLabelMap[normalizedColor] ?? color;
  }

  /** 日付をフォーマット */
  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** trackBy関数 */
  trackByLogId(index: number, log: EditLog): string {
    return log.id || index.toString();
  }

  private updateFilterOptions(): void {
    console.log('updateFilterOptions() が呼ばれました');
    console.log('currentProjectNames:', Array.from(this.currentProjectNames));
    console.log('currentTaskNames:', Array.from(this.currentTaskNames));
    
    // プロジェクト名：現在存在するすべてのプロジェクト名を選択肢に表示
    this.projectOptions = Array.from(this.currentProjectNames).sort((a, b) =>
      a.localeCompare(b, 'ja')
    );
    console.log('projectOptions:', this.projectOptions);

    // タスク名：現在存在するすべてのタスク名を選択肢に表示
    this.taskOptions = Array.from(this.currentTaskNames).sort((a, b) =>
      a.localeCompare(b, 'ja')
    );
    console.log('taskOptions:', this.taskOptions);

    // メンバーオプションは updateMemberOptions() で更新
    this.updateMemberOptions();
  }

  /** メンバーオプションを更新（メンバー管理画面のメンバー一覧から取得、カンマ区切り対応） */
  private updateMemberOptions(): void {
    const memberSet = new Set<string>();

    // メンバー管理画面のメンバー一覧から取得（現在存在するすべてのメンバー名を選択肢に表示）
    this.allMembers.forEach((member) => {
      if (member.name) {
        // メンバー名がカンマ区切りの場合も分割
        const names = member.name
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        names.forEach((name) => memberSet.add(name));
      }
    });

    this.memberOptions = Array.from(memberSet).sort((a, b) =>
      a.localeCompare(b, 'ja')
    );
  }

  applyFilters(): void {
    const filtered = this.allLogs.filter((log) => {
      const projectName = this.resolveProjectName(log);
      const matchProject =
        this.filterProjects.length === 0 ||
        (projectName && this.filterProjects.includes(projectName));
      const matchTask =
        this.filterTasks.length === 0 ||
        (log.taskName && this.filterTasks.includes(log.taskName));

      // メンバーフィルター（カンマ区切り対応、メンバー管理画面に存在する名前のみ）
      const matchMember =
        this.filterMembers.length === 0 ||
        (() => {
          // getUserNameDisplay()で取得した名前を使用（メンバー管理画面に存在する名前のみ）
          const displayName = this.getUserNameDisplay(log);
          if (displayName === '—') {
            return false;
          }
          
          // 表示名をカンマで分割
          const userNames = displayName
            .split(',')
            .map((n) => n.trim())
            .filter((n) => n.length > 0);

          // フィルター値とマッチするか確認（複数選択対応）
          return userNames.some((userName) =>
            this.filterMembers.some(
              (filterMember) =>
                userName.toLowerCase() === filterMember.toLowerCase()
            )
          );
        })();

      const matchPeriod = this.matchesPeriod(log.createdAt);
      return matchProject && matchTask && matchMember && matchPeriod;
    });

    this.editLogs = filtered;
  }

  onProjectFilterChange(): void {
    this.applyFilters();
  }

  onTaskFilterChange(): void {
    this.applyFilters();
  }

  onMemberFilterChange(): void {
    this.applyFilters();
  }

  openPeriodDialog(): void {
    const dialogRef = this.dialog.open(PeriodFilterDialogComponent, {
      width: '300px',
      data: {
        startDate: this.periodStartDate,
        endDate: this.periodEndDate,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      this.periodStartDate = result.startDate;
      this.periodEndDate = result.endDate;
      this.applyFilters();
    });
  }

  periodLabel(): string {
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      month: '2-digit',
      day: '2-digit',
    });

    if (this.periodStartDate && this.periodEndDate) {
      return `${formatter.format(this.periodStartDate)} - ${formatter.format(
        this.periodEndDate
      )}`;
    }
    if (this.periodStartDate) {
      return `${formatter.format(this.periodStartDate)} 以降`;
    }
    if (this.periodEndDate) {
      return `${formatter.format(this.periodEndDate)} 以前`;
    }
    return '期間';
  }

  resetFilters(): void {
    this.filterProjects = [];
    this.filterTasks = [];
    this.filterMembers = [];
    this.periodStartDate = null;
    this.periodEndDate = null;
    this.applyFilters();
  }

  isFilterActive(): boolean {
    return (
      this.filterProjects.length > 0 ||
      this.filterTasks.length > 0 ||
      this.filterMembers.length > 0 ||
      !!this.periodStartDate ||
      !!this.periodEndDate
    );
  }

  private matchesPeriod(value: Date | string | undefined): boolean {
    if (!this.periodStartDate && !this.periodEndDate) {
      return true;
    }
    if (!value) {
      return false;
    }
    const targetDate = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(targetDate.getTime())) {
      return false;
    }
    
    // 日付のみで比較するため、時刻を00:00:00にリセット
    const normalizeDate = (date: Date): Date => {
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      return normalized;
    };
    
    const normalizedTargetDate = normalizeDate(targetDate);
    
    const afterStart = this.periodStartDate
      ? normalizedTargetDate >= normalizeDate(this.periodStartDate)
      : true;
    
    // 終了日の場合は、その日の23:59:59.999までを含める
    const beforeEnd = this.periodEndDate
      ? normalizedTargetDate <= normalizeDate(this.periodEndDate)
      : true;
    
    return afterStart && beforeEnd;
  }

  private loadProjectNames(): void {
    console.log('loadProjectNames() が呼ばれました');
    // 全プロジェクト進捗画面と同じ方法でプロジェクトを取得
    // projectService.getProjects()はcurrentRoomId$を使用してルーム内のすべてのプロジェクトを取得
    // currentRoomId$がnullでない値になるまで待つ
    this.authService.currentRoomId$
      .pipe(
        filter((roomId) => roomId !== null && roomId !== undefined && roomId !== ''),
        take(1),
        switchMap(() => this.projectService.getProjects()),
        take(1)
      )
      .subscribe((projects) => {
        console.log('プロジェクト一覧を取得しました:', projects.length, '件');
        console.log('プロジェクト一覧:', projects.map(p => ({ id: p.id, name: p.projectName })));
        this.projectNameMap.clear();
        this.currentProjectNames.clear();
        projects.forEach((project) => {
          if (project.id && project.projectName) {
            this.projectNameMap.set(project.id, project.projectName);
            this.currentProjectNames.add(project.projectName);
          }
        });
        console.log('currentProjectNames:', Array.from(this.currentProjectNames));
        
        // 現在のタスク名も取得
        this.loadCurrentTaskNames(projects);
        
        this.applyProjectNameFallback();
      });
  }

  /** 現在存在するタスク名を取得 */
  private loadCurrentTaskNames(projects: any[]): void {
    this.currentTaskNames.clear();
    let completedRequests = 0;
    
    if (projects.length === 0) {
      console.log('プロジェクトが0件のため、フィルターオプションを更新します');
      this.updateFilterOptions();
      this.applyFilters();
      return;
    }
    
    projects.forEach((project) => {
      if (project.id) {
        this.projectService
          .getTasksByProjectId(project.id)
          .pipe(take(1))
          .subscribe((tasks) => {
            tasks.forEach((task) => {
              if (task.taskName) {
                this.currentTaskNames.add(task.taskName);
              }
            });
            completedRequests++;
            if (completedRequests === projects.length) {
              console.log('すべてのタスク名を取得しました。フィルターオプションを更新します');
              console.log('currentTaskNames:', Array.from(this.currentTaskNames));
              this.updateFilterOptions();
              this.applyFilters();
            }
          });
      } else {
        completedRequests++;
        if (completedRequests === projects.length) {
          console.log('すべてのタスク名を取得しました（プロジェクトIDなし）。フィルターオプションを更新します');
          this.updateFilterOptions();
          this.applyFilters();
        }
      }
    });
  }

  private applyProjectNameFallback(): void {
    if (this.projectNameMap.size === 0) {
      return;
    }
    this.allLogs.forEach((log) => {
      const resolved = this.projectNameMap.get(log.projectId);
      if (
        resolved &&
        (!log.projectName || log.projectName === 'プロジェクト')
      ) {
        log.projectName = resolved;
      }
    });
  }

  private resolveProjectName(log: EditLog): string {
    if (log.projectName && log.projectName !== 'プロジェクト') {
      return log.projectName;
    }
    const resolved = this.projectNameMap.get(log.projectId);
    return resolved || log.projectName || '';
  }

  /** 編集者名を表示（userEmailでメンバー管理画面と照合、カンマ区切り対応） */
  getUserNameDisplay(log: EditLog): string {
    const displayNames: string[] = [];

    // まず、userEmailでメンバー管理画面と照合
    if (log.userEmail) {
      const memberByEmail = this.allMembers.find((m) => {
        if (!m.email) return false;
        return m.email.toLowerCase() === log.userEmail!.toLowerCase();
      });

      if (memberByEmail && memberByEmail.name) {
        const names = memberByEmail.name
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        displayNames.push(...names);
      }
    }

    // userEmailでマッチしない場合、userIdがメンバー管理画面のメンバーのidと一致するか確認
    if (displayNames.length === 0 && log.userId) {
      const memberById = this.allMembers.find((m) => m.id === log.userId);
      if (memberById && memberById.name) {
        const names = memberById.name
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        displayNames.push(...names);
      }
    }

    // それでもマッチしない場合、userNameでメンバー名と照合
    if (displayNames.length === 0 && log.userName) {
      const userNameNormalized = log.userName.trim();

      // userNameがメールアドレス形式の場合
      if (userNameNormalized.includes('@')) {
        const memberByEmail = this.allMembers.find((m) => {
          if (!m.email) return false;
          return m.email.toLowerCase() === userNameNormalized.toLowerCase();
        });

        if (memberByEmail && memberByEmail.name) {
          const names = memberByEmail.name
            .split(',')
            .map((n) => n.trim())
            .filter((n) => n.length > 0);
          displayNames.push(...names);
        }
      } else {
        // userNameがメールアドレス形式でない場合、メンバー名と照合（大文字小文字を区別しない）
        const memberByName = this.allMembers.find((m) => {
          if (!m.name) return false;
          const memberNames = m.name
            .split(',')
            .map((n) => n.trim())
            .filter((n) => n.length > 0);
          return memberNames.some(
            (name) => name.toLowerCase() === userNameNormalized.toLowerCase()
          );
        });

        if (memberByName && memberByName.name) {
          const names = memberByName.name
            .split(',')
            .map((n) => n.trim())
            .filter((n) => n.length > 0);
          displayNames.push(...names);
        }
      }
    }

    // それでもマッチしない場合、メンバー管理画面に存在しない名前なので表示しない
    // （userNameやuserIdをそのまま表示しない）

    return displayNames.length > 0 ? displayNames.join(', ') : '—';
  }
}
