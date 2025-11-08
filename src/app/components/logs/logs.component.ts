import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditLogService } from '../../services/edit-log.service';
import { EditLog } from '../../models/task.model';
import { DocumentSnapshot } from '@angular/fire/firestore';
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
export class LogsComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly projectService = inject(ProjectService);
  private readonly editLogService = inject(EditLogService);
  private readonly memberManagementService = inject(MemberManagementService);
  private readonly authService = inject(AuthService);
  private readonly auth = inject(Auth);

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

    this.loadProjectNames();
    this.loadRecentLogs();
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
    this.editLogService.exportToCSV(this.editLogs);
  }

  /** アクション名を取得 */
  getActionLabel(action: string): string {
    return this.editLogService.getActionLabel(action);
  }

  /** 変更内容を整形 */
  formatChangeDescription(log: EditLog): string {
    // 個別の変更詳細がある場合はそれを使用
    if (log.changes && log.changes.length > 0) {
      return log.changes
        .map((change) => this.formatChangeDetail(change))
        .join('');
    }

    // フォールバック：従来の方法
    const baseLabel = log.changeDescription?.trim() || '';
    const oldValue = log.oldValue?.toString().trim();
    const newValue = log.newValue?.toString().trim();
    const hasOld = !!oldValue;
    const hasNew = !!newValue;

    if (!hasOld && !hasNew) {
      return baseLabel ? `・${baseLabel}` : '・変更内容なし';
    }

    if (hasOld && hasNew) {
      return baseLabel
        ? `・${baseLabel}：${oldValue}→${newValue}`
        : `・${oldValue}→${newValue}`;
    }

    if (hasNew) {
      return baseLabel
        ? `・${baseLabel}：「${newValue}」が追加`
        : `・「${newValue}」が追加`;
    }

    return baseLabel
      ? `・${baseLabel}：「${oldValue}」が削除`
      : `・「${oldValue}」が削除`;
  }

  /** 個別の変更詳細を整形 */
  formatChangeDetail(change: any): string {
    const field = change.field || '';
    const oldValue = change.oldValue?.toString().trim();
    const newValue = change.newValue?.toString().trim();
    const hasOld = !!oldValue;
    const hasNew = !!newValue;

    if (!hasOld && !hasNew) {
      return `・${field}：変更内容なし\n`;
    }

    if (hasOld && hasNew) {
      return `・${field}：${oldValue}→${newValue}に変更しました\n`;
    }

    if (hasNew) {
      return `・${field}：${newValue}が追加されました\n`;
    }

    return `・${field}：${oldValue}が削除されました\n`;
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
    const toUnique = (values: (string | undefined)[]) =>
      Array.from(
        new Set(values.filter((value): value is string => !!value?.trim()))
      ).sort((a, b) => a.localeCompare(b, 'ja'));

    this.projectOptions = toUnique(
      this.allLogs.map((log) => this.resolveProjectName(log))
    );
    this.taskOptions = toUnique(this.allLogs.map((log) => log.taskName));

    // メンバーオプションは updateMemberOptions() で更新
    this.updateMemberOptions();
  }

  /** メンバーオプションを更新（メンバー管理画面のメンバー一覧から取得、カンマ区切り対応） */
  private updateMemberOptions(): void {
    const memberSet = new Set<string>();

    // メンバー管理画面のメンバー一覧から取得
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

    // 編集ログのuserNameからも取得（カンマ区切り対応）
    this.allLogs.forEach((log) => {
      if (log.userName) {
        const names = log.userName
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

      // メンバーフィルター（カンマ区切り対応）
      const matchMember =
        this.filterMembers.length === 0 ||
        (log.userName &&
          (() => {
            // userName をカンマで分割
            const userNames = log.userName
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
          })());

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
    const afterStart = this.periodStartDate
      ? targetDate >= this.periodStartDate
      : true;
    const beforeEnd = this.periodEndDate
      ? targetDate <= this.periodEndDate
      : true;
    return afterStart && beforeEnd;
  }

  private loadProjectNames(): void {
    this.projectService
      .getProjects()
      .pipe(take(1))
      .subscribe((projects) => {
        this.projectNameMap.clear();
        projects.forEach((project) => {
          if (project.id && project.projectName) {
            this.projectNameMap.set(project.id, project.projectName);
          }
        });
        this.applyProjectNameFallback();
        this.updateFilterOptions();
        this.applyFilters();
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

    // それでもマッチしない場合、userNameをそのまま使用
    if (displayNames.length === 0 && log.userName) {
      displayNames.push(log.userName.trim());
    } else if (displayNames.length === 0 && log.userId) {
      displayNames.push(log.userId);
    }

    return displayNames.length > 0 ? displayNames.join(', ') : '—';
  }
}
