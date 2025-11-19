import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditLogService } from '../../services/edit-log.service';
import { EditLog } from '../../models/task.model';
import {
  DocumentSnapshot,
  Firestore,
  collection,
  query,
  where,
  collectionData,
} from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
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
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
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
  private readonly languageService = inject(LanguageService);
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
  periodStartDateObj: Date | null = null; // Material date picker用
  periodEndDateObj: Date | null = null; // Material date picker用
  maxDate = new Date(9999, 11, 31); // 9999-12-31
  private projectNameMap = new Map<string, string>();
  private allMembers: Member[] = []; // メンバー一覧
  private currentProjectNames = new Set<string>(); // 現在存在するプロジェクト名のセット
  private currentTaskNames = new Set<string>(); // 現在存在するタスク名のセット

  // プロジェクトテーマカラーの16進表記から色名へのマッピング
  private getThemeColorLabelMap(): Record<string, string> {
    const isEnglish = this.languageService.getCurrentLanguage() === 'en';
    return {
      // 現在のカラー
      '#fde4ec': isEnglish ? 'Pink' : 'ピンク',
      '#ffe6dc': isEnglish ? 'Peach' : 'ピーチ',
      '#ffedd6': isEnglish ? 'Apricot' : 'アプリコット',
      '#fff8e4': isEnglish ? 'Yellow' : 'イエロー',
      '#eef6da': isEnglish ? 'Lime' : 'ライム',
      '#e4f4e8': isEnglish ? 'Mint' : 'ミント',
      '#dcf3f0': isEnglish ? 'Blue Green' : 'ブルーグリーン',
      '#def3ff': isEnglish ? 'Sky Blue' : 'スカイブルー',
      '#e6e9f9': isEnglish ? 'Lavender Blue' : 'ラベンダーブルー',
      '#ece6f8': isEnglish ? 'Purple' : 'パープル',
      // レガシーカラー（古いカラーコードも対応）
      '#f8bbd0': isEnglish ? 'Pink' : 'ピンク',
      '#ffccbc': isEnglish ? 'Peach' : 'ピーチ',
      '#ffe0b2': isEnglish ? 'Apricot' : 'アプリコット',
      '#fff9c4': isEnglish ? 'Yellow' : 'イエロー',
      '#dcedc8': isEnglish ? 'Lime' : 'ライム',
      '#c8e6c9': isEnglish ? 'Mint' : 'ミント',
      '#b2dfdb': isEnglish ? 'Blue Green' : 'ブルーグリーン',
      '#b3e5fc': isEnglish ? 'Sky Blue' : 'スカイブルー',
      '#c5cae9': isEnglish ? 'Lavender Blue' : 'ラベンダーブルー',
      '#d1c4e9': isEnglish ? 'Purple' : 'パープル',
    };
  }

  ngOnInit() {
    // メンバー一覧を読み込み
    this.memberManagementService.getMembers()
      .pipe(takeUntil(this.destroy$)) // ✅ 追加: メモリリーク防止
      .subscribe({
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
            console.log(
              '編集ログ画面に戻ってきました。プロジェクト一覧を再読み込みします。'
            );
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
    this.editLogService.exportToCSV(
      this.editLogs,
      (log) => this.getUserNameDisplay(log),
      (log) => this.formatChangeDescription(log)
    );
  }

  /** アクション名を取得 */
  getActionLabel(action: string): string {
    return this.editLogService.getActionLabel(action);
  }

  /** 変更内容を整形 */
  formatChangeDescription(log: EditLog): string {
    const isJapanese = this.languageService.getCurrentLanguage() === 'ja';

    // 作成・削除の場合
    if (log.action === 'create') {
      if (log.taskName) {
        // タスクを作成しました。（「タスク名」を作成）
        const taskCreatedText =
          this.languageService.translate('logs.taskCreated');
        const createdText = isJapanese ? 'を作成' : ' created';
        const period = isJapanese ? '。' : '.';
        const nameInQuotes = isJapanese
          ? `「${log.taskName}」`
          : `"${log.taskName}"`;
        return `${taskCreatedText}${period}（${nameInQuotes}${createdText}）`;
      } else {
        // プロジェクトを作成しました。（「プロジェクト名」を作成）
        const projectCreatedText = this.languageService.translate(
          'logs.projectCreated'
        );
        const createdText = isJapanese ? 'を作成' : ' created';
        const period = isJapanese ? '。' : '.';
        const nameInQuotes = isJapanese
          ? `「${log.projectName}」`
          : `"${log.projectName}"`;
        return `${projectCreatedText}${period}（${nameInQuotes}${createdText}）`;
      }
    }

    if (log.action === 'delete') {
      if (log.taskName) {
        // タスクを削除しました。（「タスク名」を削除）
        const taskDeletedText =
          this.languageService.translate('logs.taskDeleted');
        const deletedText = isJapanese ? 'を削除' : ' deleted';
        const period = isJapanese ? '。' : '.';
        const nameInQuotes = isJapanese
          ? `「${log.taskName}」`
          : `"${log.taskName}"`;
        return `${taskDeletedText}${period}（${nameInQuotes}${deletedText}）`;
      } else {
        // プロジェクトを削除しました。（「プロジェクト名」を削除）
        const projectDeletedText = this.languageService.translate(
          'logs.projectDeleted'
        );
        const deletedText = isJapanese ? 'を削除' : ' deleted';
        const period = isJapanese ? '。' : '.';
        const nameInQuotes = isJapanese
          ? `「${log.projectName}」`
          : `"${log.projectName}"`;
        return `${projectDeletedText}${period}（${nameInQuotes}${deletedText}）`;
      }
    }

    // 更新の場合：個別の変更詳細がある場合はそれを使用
    if (log.action === 'update' && log.changes && log.changes.length > 0) {
      const changeDescriptions = log.changes
        .map((change) => this.formatChangeDetail(change))
        .filter((desc) => desc.length > 0);

      if (changeDescriptions.length > 0) {
        // タスク名がある場合は「タスクを更新しました」、ない場合は「プロジェクトを更新しました」
        const actionLabel = log.taskName
          ? this.languageService.translate('logs.taskUpdated')
          : this.languageService.translate('logs.projectUpdated');
        // 変更内容を括弧で囲む（日本語は全角括弧、英語は半角括弧）
        const openBracket = isJapanese ? '（' : '(';
        const closeBracket = isJapanese ? '）' : ')';
        const separator = isJapanese ? '、' : ', ';
        return `${actionLabel}${openBracket}${changeDescriptions.join(
          separator
        )}${closeBracket}`;
      }
    }

    // フォールバック：従来の方法
    let baseLabel = log.changeDescription?.trim() || '';

    // 日本語のメッセージパターンを英語に翻訳
    if (baseLabel && this.languageService.getCurrentLanguage() === 'en') {
      // プロジェクト作成パターン: プロジェクト「{name}」を作成しました
      const projectCreatedMatch = baseLabel.match(
        /プロジェクト「([^」]+)」を作成しました/
      );
      if (projectCreatedMatch) {
        const projectName = projectCreatedMatch[1];
        baseLabel = this.languageService.translateWithParams(
          'logs.message.projectCreatedWithName',
          { projectName }
        );
      }

      // プロジェクト削除パターン: プロジェクト「{name}」を削除しました
      const projectDeletedMatch = baseLabel.match(
        /プロジェクト「([^」]+)」を削除しました/
      );
      if (projectDeletedMatch) {
        const projectName = projectDeletedMatch[1];
        baseLabel = this.languageService.translateWithParams(
          'logs.message.projectDeletedWithName',
          { projectName }
        );
      }

      // タスク作成パターン: タスク「{name}」を作成しました
      const taskCreatedMatch =
        baseLabel.match(/タスク「([^」]+)」を作成しました/);
      if (taskCreatedMatch) {
        const taskName = taskCreatedMatch[1];
        baseLabel = this.languageService.translateWithParams(
          'logs.message.taskCreatedWithName',
          { taskName }
        );
      }

      // タスク削除パターン: タスク「{name}」を削除しました
      const taskDeletedMatch =
        baseLabel.match(/タスク「([^」]+)」を削除しました/);
      if (taskDeletedMatch) {
        const taskName = taskDeletedMatch[1];
        baseLabel = this.languageService.translateWithParams(
          'logs.message.taskDeletedWithName',
          { taskName }
        );
      }

      // プロジェクト更新パターン: プロジェクトを更新しました
      if (
        baseLabel === 'プロジェクトを更新しました' ||
        baseLabel.startsWith('プロジェクトを更新しました')
      ) {
        baseLabel = baseLabel.replace(
          'プロジェクトを更新しました',
          this.languageService.translate('logs.projectUpdated')
        );
      }

      // タスク更新パターン: タスク「{name}」を更新しました
      const taskUpdatedMatch =
        baseLabel.match(/タスク「([^」]+)」を更新しました/);
      if (taskUpdatedMatch) {
        const taskName = taskUpdatedMatch[1];
        baseLabel = this.languageService.translateWithParams(
          'logs.message.taskUpdatedWithName',
          { taskName }
        );
      }

      // ステータス変更パターン: タスクのステータスを「{old}」→「{new}」に変更しました
      const statusChangedMatch = baseLabel.match(
        /タスクのステータスを「([^」]+)」→「([^」]+)」に変更しました/
      );
      if (statusChangedMatch) {
        const oldStatus = this.translateStatus(statusChangedMatch[1]);
        const newStatus = this.translateStatus(statusChangedMatch[2]);
        baseLabel = this.languageService.translateWithParams(
          'logs.message.statusChanged',
          { oldStatus, newStatus }
        );
      }
    }

    let oldValue = log.oldValue?.toString().trim();
    let newValue = log.newValue?.toString().trim();
    const hasOld = !!oldValue;
    const hasNew = !!newValue;

    // oldValueとnewValueがステータスまたは優先度の可能性がある場合は翻訳
    // ステータス変更の場合
    if (
      oldValue &&
      (oldValue === '未着手' ||
        oldValue === '作業中' ||
        oldValue === '完了' ||
        oldValue === 'Not Started' ||
        oldValue === 'In Progress' ||
        oldValue === 'Completed')
    ) {
      oldValue = this.translateStatus(oldValue);
    }
    if (
      newValue &&
      (newValue === '未着手' ||
        newValue === '作業中' ||
        newValue === '完了' ||
        newValue === 'Not Started' ||
        newValue === 'In Progress' ||
        newValue === 'Completed')
    ) {
      newValue = this.translateStatus(newValue);
    }
    // 優先度変更の場合
    if (
      oldValue &&
      (oldValue === '高' ||
        oldValue === '中' ||
        oldValue === '低' ||
        oldValue === 'High' ||
        oldValue === 'Medium' ||
        oldValue === 'Low')
    ) {
      oldValue = this.translatePriority(oldValue);
    }
    if (
      newValue &&
      (newValue === '高' ||
        newValue === '中' ||
        newValue === '低' ||
        newValue === 'High' ||
        newValue === 'Medium' ||
        newValue === 'Low')
    ) {
      newValue = this.translatePriority(newValue);
    }

    if (!hasOld && !hasNew) {
      return baseLabel || '';
    }

    if (hasOld && hasNew) {
      return baseLabel
        ? `${baseLabel} (${oldValue}→${newValue})`
        : `${oldValue}→${newValue}`;
    }

    if (hasNew) {
      const addedText = this.languageService.translate('logs.added');
      return baseLabel
        ? `${baseLabel} (${newValue}${addedText})`
        : `${newValue}${addedText}`;
    }

    const deletedText = this.languageService.translate('logs.deleted');
    return baseLabel
      ? `${baseLabel} (${oldValue}${deletedText})`
      : `${oldValue}${deletedText}`;
  }

  /** 個別の変更詳細を整形 */
  formatChangeDetail(change: any): string {
    const isJapanese = this.languageService.getCurrentLanguage() === 'ja';
    let field = change.field || '';
    let oldValue = change.oldValue?.toString().trim();
    let newValue = change.newValue?.toString().trim();
    const hasOld = !!oldValue;
    const hasNew = !!newValue;

    // フィールド名が日本語の場合は多言語対応に変換
    const fieldTranslationMap: { [key: string]: string } = {
      プロジェクト名: 'logs.field.projectName',
      説明: 'logs.field.overview',
      開始日: 'logs.field.startDate',
      終了日: 'logs.field.endDate',
      テーマ色: 'logs.field.themeColor',
      テーマカラー: 'logs.field.themeColor',
      資料: 'logs.field.attachments',
      責任者: 'logs.field.responsible',
      メンバー: 'logs.field.members',
      ステータス: 'logs.field.status',
      優先度: 'logs.field.priority',
      担当者: 'logs.field.assignee',
      期限: 'logs.field.dueDate',
      タスク名: 'logs.field.taskName',
      概要: 'logs.field.description',
      タグ: 'logs.field.tags',
      マイルストーン: 'logs.field.milestone',
      カレンダー連携: 'logs.field.calendarSync',
      通知対象設定: 'logs.field.notificationSettings',
      タスクの順番管理: 'logs.field.taskOrderManagement',
      作業予定時間入力: 'logs.field.estimatedWorkTime',
      // 翻訳キーが直接保存されている場合も対応
      'logs.field.status': 'logs.field.status',
      'logs.field.priority': 'logs.field.priority',
      'logs.field.assignee': 'logs.field.assignee',
      'logs.field.dueDate': 'logs.field.dueDate',
      'logs.field.taskName': 'logs.field.taskName',
      'logs.field.description': 'logs.field.description',
      'logs.field.tags': 'logs.field.tags',
      'logs.field.projectName': 'logs.field.projectName',
      'logs.field.overview': 'logs.field.overview',
      'logs.field.startDate': 'logs.field.startDate',
      'logs.field.endDate': 'logs.field.endDate',
      'logs.field.themeColor': 'logs.field.themeColor',
      'logs.field.attachments': 'logs.field.attachments',
      'logs.field.responsible': 'logs.field.responsible',
      'logs.field.members': 'logs.field.members',
      'logs.field.milestone': 'logs.field.milestone',
      'logs.field.calendarSync': 'logs.field.calendarSync',
      'logs.field.notificationSettings': 'logs.field.notificationSettings',
      'logs.field.taskOrderManagement': 'logs.field.taskOrderManagement',
      'logs.field.estimatedWorkTime': 'logs.field.estimatedWorkTime',
    };
    if (fieldTranslationMap[field]) {
      const translationKey = fieldTranslationMap[field];
      field = this.languageService.translate(translationKey);
    }

    // ステータスの値を翻訳
    const statusFieldKey = this.languageService.translate('logs.field.status');
    // change.fieldが翻訳キー、日本語フィールド名、英語フィールド名、または翻訳後のフィールド名のいずれかである場合
    if (
      change.field === 'ステータス' ||
      change.field === 'status' ||
      change.field === 'logs.field.status' ||
      field === statusFieldKey
    ) {
      if (oldValue) {
        oldValue = this.translateStatus(oldValue);
      }
      if (newValue) {
        newValue = this.translateStatus(newValue);
      }
    }

    // 優先度の値を翻訳
    const priorityFieldKey = this.languageService.translate(
      'logs.field.priority'
    );
    // change.fieldが翻訳キー、日本語フィールド名、英語フィールド名、または翻訳後のフィールド名のいずれかである場合
    if (
      change.field === '優先度' ||
      change.field === 'priority' ||
      change.field === 'logs.field.priority' ||
      field === priorityFieldKey
    ) {
      if (oldValue) {
        oldValue = this.translatePriority(oldValue);
      }
      if (newValue) {
        newValue = this.translatePriority(newValue);
      }
    }

    // プロジェクトテーマ色の場合は16進表記を色名に変換
    const themeColorKey = this.languageService.translate('logs.themeColor');
    if (
      change.field === 'テーマ色' ||
      change.field === 'themeColor' ||
      change.field === themeColorKey ||
      field === themeColorKey
    ) {
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

    // 両方の値がある場合（変更）
    if (hasOld && hasNew) {
      const arrow = isJapanese ? '→' : '→';
      return `${field}：${oldValue}${arrow}${newValue}`;
    }

    // 追加の場合
    if (hasNew) {
      const quoteOpen = isJapanese ? '「' : '"';
      const quoteClose = isJapanese ? '」' : '"';
      const addedText = isJapanese ? 'を追加' : ' added';
      return `${field}：${quoteOpen}${newValue}${quoteClose}${addedText}`;
    }

    // 削除の場合
    if (hasOld) {
      const quoteOpen = isJapanese ? '「' : '"';
      const quoteClose = isJapanese ? '」' : '"';
      const deletedText = isJapanese ? 'を削除' : ' deleted';
      return `${field}：${quoteOpen}${oldValue}${quoteClose}${deletedText}`;
    }

    return '';
  }

  /** ステータスを翻訳 */
  private translateStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      未着手: 'progress.status.notStarted',
      作業中: 'progress.status.inProgress',
      完了: 'progress.status.completed',
      'Not Started': 'progress.status.notStarted',
      'In Progress': 'progress.status.inProgress',
      Completed: 'progress.status.completed',
    };
    const translationKey = statusMap[status];
    if (translationKey) {
      return this.languageService.translate(translationKey);
    }
    return status;
  }

  /** 優先度を翻訳 */
  private translatePriority(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      高: 'progress.priority.high',
      中: 'progress.priority.medium',
      低: 'progress.priority.low',
      High: 'progress.priority.high',
      Medium: 'progress.priority.medium',
      Low: 'progress.priority.low',
    };
    const translationKey = priorityMap[priority];
    if (translationKey) {
      return this.languageService.translate(translationKey);
    }
    return priority;
  }

  /** プロジェクトテーマカラーの16進表記を色名に変換 */
  private getThemeColorLabel(color: string): string {
    // #ffffffの場合は「なし」に変換
    if (color.toLowerCase() === '#ffffff') {
      return this.languageService.translate('logs.none');
    }
    // 大文字小文字を区別しないように、小文字に変換してから検索
    const normalizedColor = color.toLowerCase();
    const labelMap = this.getThemeColorLabelMap();
    return labelMap[normalizedColor] ?? color;
  }

  /** 日付をフォーマット */
  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const locale =
      this.languageService.getCurrentLanguage() === 'ja' ? 'ja-JP' : 'en-US';
    return d.toLocaleString(locale, {
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
    const locale =
      this.languageService.getCurrentLanguage() === 'ja' ? 'ja' : 'en';
    this.projectOptions = Array.from(this.currentProjectNames).sort((a, b) =>
      a.localeCompare(b, locale)
    );
    console.log('projectOptions:', this.projectOptions);

    // タスク名：現在存在するすべてのタスク名を選択肢に表示
    this.taskOptions = Array.from(this.currentTaskNames).sort((a, b) =>
      a.localeCompare(b, locale)
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

    const locale =
      this.languageService.getCurrentLanguage() === 'ja' ? 'ja' : 'en';
    this.memberOptions = Array.from(memberSet).sort((a, b) =>
      a.localeCompare(b, locale)
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

  onPeriodStartDateChange(): void {
    if (this.periodStartDateObj) {
      this.periodStartDate = this.periodStartDateObj;
    } else {
      this.periodStartDate = null;
    }
    this.applyFilters();
  }

  onPeriodEndDateChange(): void {
    if (this.periodEndDateObj) {
      this.periodEndDate = this.periodEndDateObj;
    } else {
      this.periodEndDate = null;
    }
    this.applyFilters();
  }

  periodLabel(): string {
    const locale =
      this.languageService.getCurrentLanguage() === 'ja' ? 'ja-JP' : 'en-US';
    const formatter = new Intl.DateTimeFormat(locale, {
      month: '2-digit',
      day: '2-digit',
    });

    if (this.periodStartDate && this.periodEndDate) {
      return `${formatter.format(this.periodStartDate)} - ${formatter.format(
        this.periodEndDate
      )}`;
    }
    if (this.periodStartDate) {
      const afterText = this.languageService.translate('logs.after');
      return `${formatter.format(this.periodStartDate)} ${afterText}`;
    }
    if (this.periodEndDate) {
      const beforeText = this.languageService.translate('logs.before');
      return `${formatter.format(this.periodEndDate)} ${beforeText}`;
    }
    return this.languageService.translate('logs.period');
  }

  resetFilters(): void {
    this.filterProjects = [];
    this.filterTasks = [];
    this.filterMembers = [];
    this.periodStartDate = null;
    this.periodEndDate = null;
    // ✅ 修正: 期日選択欄の表示状態もリセット
    this.periodStartDateObj = null;
    this.periodEndDateObj = null;
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
        filter(
          (roomId) => roomId !== null && roomId !== undefined && roomId !== ''
        ),
        take(1),
        switchMap(() => this.projectService.getProjects()),
        take(1)
      )
      .subscribe((projects) => {
        console.log('プロジェクト一覧を取得しました:', projects.length, '件');
        console.log(
          'プロジェクト一覧:',
          projects.map((p) => ({ id: p.id, name: p.projectName }))
        );
        this.projectNameMap.clear();
        this.currentProjectNames.clear();
        projects.forEach((project) => {
          if (project.id && project.projectName) {
            this.projectNameMap.set(project.id, project.projectName);
            this.currentProjectNames.add(project.projectName);
          }
        });
        console.log(
          'currentProjectNames:',
          Array.from(this.currentProjectNames)
        );

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
              console.log(
                'すべてのタスク名を取得しました。フィルターオプションを更新します'
              );
              console.log(
                'currentTaskNames:',
                Array.from(this.currentTaskNames)
              );
              this.updateFilterOptions();
              this.applyFilters();
            }
          });
      } else {
        completedRequests++;
        if (completedRequests === projects.length) {
          console.log(
            'すべてのタスク名を取得しました（プロジェクトIDなし）。フィルターオプションを更新します'
          );
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
      const projectFallback = this.languageService.translate(
        'logs.projectFallback'
      );
      if (
        resolved &&
        (!log.projectName ||
          log.projectName === 'プロジェクト' ||
          log.projectName === projectFallback)
      ) {
        log.projectName = resolved;
      }
    });
  }

  private resolveProjectName(log: EditLog): string {
    const projectFallback = this.languageService.translate(
      'logs.projectFallback'
    );
    if (
      log.projectName &&
      log.projectName !== 'プロジェクト' &&
      log.projectName !== projectFallback
    ) {
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

    // ✅ 修正: メンバー管理画面に登録されていない場合、メールアドレスを表示
    if (displayNames.length > 0) {
      return displayNames.join(', ');
    }

    // メンバー管理に登録されていない場合、メールアドレスを表示
    if (log.userEmail) {
      return log.userEmail;
    }

    // メールアドレスも存在しない場合はフォールバック
    return '—';
  }
}
