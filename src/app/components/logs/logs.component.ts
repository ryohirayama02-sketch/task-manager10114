import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditLogService } from '../../services/edit-log.service';
import { EditLog } from '../../models/task.model';
import { DocumentSnapshot } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PeriodFilterDialogComponent } from '../progress/member-detail/member-detail.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.css',
})
export class LogsComponent implements OnInit {
  private readonly dialog = inject(MatDialog);

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

  constructor(private editLogService: EditLogService) {}

  ngOnInit() {
    this.loadRecentLogs();
  }

  /** 直近の編集ログを読み込み */
  async loadRecentLogs(): Promise<void> {
    this.loading = true;
    try {
      const result = await this.editLogService.getRecentEditLogs();
      this.allLogs = result.logs;
      this.lastDocument = result.lastDocument;
      this.hasMoreLogs = result.logs.length === 30 && !!this.lastDocument;
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
      this.allLogs = [...this.allLogs, ...result.logs];
      this.lastDocument = result.lastDocument;
      this.hasMoreLogs = result.logs.length === 30 && !!this.lastDocument;
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

    this.projectOptions = toUnique(this.allLogs.map((log) => log.projectName));
    this.taskOptions = toUnique(this.allLogs.map((log) => log.taskName));
    this.memberOptions = toUnique(this.allLogs.map((log) => log.userName));
  }

  applyFilters(): void {
    const filtered = this.allLogs.filter((log) => {
      const matchProject =
        this.filterProjects.length === 0 ||
        (log.projectName && this.filterProjects.includes(log.projectName));
      const matchTask =
        this.filterTasks.length === 0 ||
        (log.taskName && this.filterTasks.includes(log.taskName));
      const matchMember =
        this.filterMembers.length === 0 ||
        (log.userName && this.filterMembers.includes(log.userName));
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
    const beforeEnd = this.periodEndDate ? targetDate <= this.periodEndDate : true;
    return afterStart && beforeEnd;
  }
}
