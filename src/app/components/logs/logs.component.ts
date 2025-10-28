import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditLogService } from '../../services/edit-log.service';
import { EditLog } from '../../models/task.model';
import { DocumentSnapshot } from '@angular/fire/firestore';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.css',
})
export class LogsComponent implements OnInit {
  editLogs: EditLog[] = [];
  loading = false;
  hasMoreLogs = true;
  lastDocument: DocumentSnapshot | null = null;

  constructor(private editLogService: EditLogService) {}

  ngOnInit() {
    this.loadRecentLogs();
  }

  /** 直近の編集ログを読み込み */
  async loadRecentLogs(): Promise<void> {
    this.loading = true;
    try {
      this.editLogs = await this.editLogService.getRecentEditLogs();
      this.hasMoreLogs = this.editLogs.length === 30; // 30件取得できた場合はまだデータがある可能性
      console.log('編集ログを読み込みました:', this.editLogs.length, '件');
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
      this.editLogs = [...this.editLogs, ...result.logs];
      this.lastDocument = result.lastDocument;
      this.hasMoreLogs = result.logs.length === 30;
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
}
