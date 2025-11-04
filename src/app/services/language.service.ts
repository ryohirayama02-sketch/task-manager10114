import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type SupportedLanguage = 'ja' | 'en';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private readonly STORAGE_KEY = 'app-language';
  private readonly defaultLanguage: SupportedLanguage = 'ja';
  private readonly translations: Record<
    string,
    Record<SupportedLanguage, string>
  > = {
    'app.title': { ja: '課題管理アプリ', en: 'Task Manager' },
    'nav.kanban': { ja: 'カンバン', en: 'Kanban' },
    'nav.gantt': { ja: 'ガント', en: 'Gantt' },
    'nav.calendar': { ja: 'カレンダー', en: 'Calendar' },
    'nav.projectProgress': { ja: '進捗(プロジェクト)', en: 'Project Progress' },
    'nav.memberProgress': { ja: '進捗(メンバー)', en: 'Member Progress' },
    'nav.quick': { ja: 'すぐやる', en: 'Quick Tasks' },
    'nav.search': { ja: '検索', en: 'Search' },
    'nav.members': { ja: 'メンバー管理', en: 'Members' },
    'nav.logs': { ja: '編集ログ', en: 'Edit Logs' },
    'nav.offlineTest': { ja: 'オフラインテスト', en: 'Offline Test' },
    'nav.settings': { ja: '設定', en: 'Settings' },
    'nav.login': { ja: 'ログイン', en: 'Login' },
    'nav.logout': { ja: 'ログアウト', en: 'Logout' },
    'settings.title': { ja: '設定', en: 'Settings' },
    'settings.menu.title': { ja: '設定メニュー', en: 'Settings Menu' },
    'settings.menu.notifications': { ja: '通知設定', en: 'Notifications' },
    'settings.menu.home': { ja: 'ホーム画面設定', en: 'Home Screen' },
    'settings.menu.language': { ja: '言語設定', en: 'Language' },
    'settings.loading': { ja: '設定を読み込み中...', en: 'Loading settings...' },
    'settings.notifications.title': { ja: '通知設定', en: 'Notification Settings' },
    'settings.notifications.subtitle': {
      ja: 'タスクの期限や作業時間に関する通知を設定できます',
      en: 'Configure notifications for task due dates and working hours',
    },
    'settings.notifications.targets': { ja: '通知先設定', en: 'Notification Targets' },
    'settings.notifications.email': { ja: 'メール通知', en: 'Email Notifications' },
    'settings.notifications.address': { ja: 'メールアドレス', en: 'Email Address' },
    'settings.deadline.title': { ja: 'タスク期限通知', en: 'Task Deadline Notifications' },
    'settings.deadline.enable': {
      ja: '期限通知を有効にする',
      en: 'Enable deadline notifications',
    },
    'settings.deadline.timing': {
      ja: '通知タイミング（期限の何日前）',
      en: 'When to notify (days before due date)',
    },
    'settings.deadline.daysSuffix': { ja: '日前', en: 'days before' },
    'settings.common.notifyTime': { ja: '通知時間', en: 'Notification Time' },
    'settings.quiet.title': { ja: '通知オフ期間', en: 'Quiet Hours' },
    'settings.quiet.enable': {
      ja: '通知オフ期間を設定する',
      en: 'Enable quiet hours',
    },
    'settings.quiet.start': { ja: '開始時間', en: 'Start Time' },
    'settings.quiet.end': { ja: '終了時間', en: 'End Time' },
    'settings.quiet.weekend': {
      ja: '週末も通知をオフにする',
      en: 'Mute notifications on weekends',
    },
    'settings.worktime.title': { ja: '作業時間オーバー通知', en: 'Work Time Overrun Notifications' },
    'settings.worktime.enable': {
      ja: '作業時間オーバー通知を有効にする',
      en: 'Enable work time overrun notifications',
    },
    'settings.worktime.period': { ja: 'チェック期間', en: 'Monitoring Period' },
    'settings.worktime.periodSuffix': { ja: '日間', en: 'days' },
    'settings.worktime.max': { ja: '最大作業時間', en: 'Maximum Work Hours' },
    'settings.worktime.maxSuffix': { ja: '時間', en: 'hours' },
    'settings.worktime.notifyManager': {
      ja: 'プロジェクト責任者に通知',
      en: 'Notify project owner',
    },
    'settings.worktime.notifyAssignee': {
      ja: '担当者に通知',
      en: 'Notify assignee',
    },
    'settings.daily.title': { ja: '日次リマインダー', en: 'Daily Reminder' },
    'settings.daily.enable': {
      ja: '日次リマインダーを有効にする',
      en: 'Enable daily reminders',
    },
    'settings.save': { ja: '設定を保存', en: 'Save Settings' },
    'settings.saving': { ja: '保存中...', en: 'Saving...' },
    'settings.sendTest': { ja: 'テスト通知送信', en: 'Send Test Notification' },
    'settings.sendDueTest': {
      ja: '期限間近タスク通知テスト',
      en: 'Due Task Notification Test',
    },
    'settings.sendUserTest': {
      ja: 'ユーザー個別通知テスト',
      en: 'User Notification Test',
    },
    'settings.sending': { ja: '送信中...', en: 'Sending...' },
    'settings.saveSuccess': {
      ja: '通知設定を保存しました',
      en: 'Notification settings saved',
    },
    'settings.saveError': {
      ja: '設定の保存に失敗しました',
      en: 'Failed to save settings',
    },
    'settings.loginRequired': { ja: 'ログインが必要です', en: 'Login is required' },
    'settings.home.title': { ja: 'ホーム画面設定', en: 'Home Screen Settings' },
    'settings.home.subtitle': {
      ja: 'サインイン後のデフォルト画面を選択してください',
      en: 'Choose the default screen after signing in',
    },
    'settings.home.field': { ja: 'ホーム画面', en: 'Home Screen' },
    'settings.home.preview': { ja: 'プレビュー', en: 'Preview' },
    'settings.language.title': { ja: '言語設定', en: 'Language Settings' },
    'settings.language.subtitle': {
      ja: 'アプリの表示言語を選択できます（入力済みのテキストには影響しません）',
      en: 'Choose the display language (user-entered text is unaffected)',
    },
    'settings.language.field': { ja: 'UI言語', en: 'UI Language' },
    'settings.language.description': {
      ja: '※ 言語変更はアプリのメニューやラベルの表示にのみ適用され、ユーザーが入力した内容は変更されません。',
      en: '* Language changes apply to menus and labels only; user-entered content is unchanged.',
    },
    'settings.language.save': { ja: '設定を保存', en: 'Save Settings' },
    'settings.language.saving': { ja: '保存中...', en: 'Saving...' },
    'settings.language.saved': {
      ja: '言語設定を保存しました',
      en: 'Language setting saved',
    },
    'settings.language.saveError': {
      ja: '言語設定の保存に失敗しました',
      en: 'Failed to save language setting',
    },
    'common.close': { ja: '閉じる', en: 'Close' },
    'language.japanese': { ja: '日本語', en: 'Japanese' },
    'language.english': { ja: '英語', en: 'English' },
    'homeScreen.kanban': { ja: 'カンバン画面', en: 'Kanban Board' },
    'homeScreen.gantt': { ja: 'ガント画面', en: 'Gantt Chart' },
    'homeScreen.calendar': { ja: 'カレンダー画面', en: 'Calendar View' },
    'offline.banner.title': { ja: 'オフラインモード', en: 'Offline Mode' },
    'offline.banner.message': {
      ja: '変更は自動的に同期されます',
      en: 'Changes will sync automatically',
    },
    'offline.snackbar.online': {
      ja: 'オンラインに復帰しました。データを同期中...',
      en: 'Back online. Syncing data...',
    },
    'offline.snackbar.offline': {
      ja: 'オフラインモードになりました。変更は自動的に同期されます。',
      en: 'You are offline. Changes will sync automatically.',
    },
    // カンバン画面
    'kanban.title': { ja: 'カンバン式課題管理', en: 'Kanban Board' },
    'kanban.projectSelector.title': { ja: '表示するプロジェクトを選択', en: 'Select Projects to Display' },
    'kanban.projectSelector.selectAll': { ja: 'すべてにチェック', en: 'Select All' },
    'kanban.projectSelector.clearAll': { ja: 'すべてのチェックをクリア', en: 'Clear All' },
    'kanban.createProject': { ja: '+ プロジェクトを作成', en: '+ Create Project' },
    'kanban.createTask': { ja: '+ タスク', en: '+ Task' },
    'kanban.selectProjectToAdd': { ja: 'タスクを追加するプロジェクトを選択してください', en: 'Please select a project to add a task' },
    'kanban.multipleProjectsSelected': { ja: '複数プロジェクトが選択されています。タスクを追加するには1つのプロジェクトのみを選択してください', en: 'Multiple projects are selected. Please select only one project to add a task' },
    'kanban.status.notStarted': { ja: '未着手', en: 'Not Started' },
    'kanban.status.inProgress': { ja: '作業中', en: 'In Progress' },
    'kanban.status.completed': { ja: '完了', en: 'Completed' },
    'kanban.alert.parentTaskStatusChange': { ja: '「親タスク：{taskName}」のステータスを作業中に変更します', en: 'The parent task "{taskName}" status will be changed to in progress' },
    'kanban.alert.incompleteSubtask': { ja: '「子タスク：{taskName}」が完了していません', en: 'The subtask "{taskName}" is not completed' },
    'kanban.dueDate': { ja: '期限', en: 'Due Date' },
    'kanban.assignee': { ja: '担当', en: 'Assigned To' },
    // 進捗画面（全プロジェクト）
    'progress.projects.title': { ja: '全プロジェクト進捗', en: 'All Projects Progress' },
    'progress.projects.sortBy': { ja: '並び替え', en: 'Sort By' },
    'progress.projects.createProject': { ja: 'プロジェクトを作成', en: 'Create Project' },
    'progress.projects.sortBy.name': { ja: 'プロジェクト名', en: 'Project Name' },
    'progress.projects.sortBy.dueDate': { ja: '期限', en: 'Due Date' },
    'progress.projects.sortBy.status': { ja: '状態', en: 'Status' },
    'progress.projects.sortBy.assignee': { ja: '担当', en: 'Assigned To' },
    'progress.projects.sortBy.progress': { ja: '進捗', en: 'Progress' },
    'progress.projects.sortBy.soon': { ja: '近い順', en: 'Soon' },
    'progress.projects.sortBy.later': { ja: '遠い順', en: 'Later' },
    'progress.projects.sortBy.high': { ja: '高い順', en: 'High' },
    'progress.projects.sortBy.low': { ja: '低い順', en: 'Low' },
    'progress.projects.overview': { ja: '概要', en: 'Overview' },
    'progress.projects.period': { ja: '期間', en: 'Period' },
    'progress.projects.responsible': { ja: '責任者', en: 'Responsible' },
    'progress.projects.members': { ja: 'メンバー', en: 'Members' },
    // 進捗画面（メンバー概要）
    'progress.members.title': { ja: '全メンバーの進捗', en: 'All Members Progress' },
    'progress.members.description': { ja: '自身が所属するプロジェクトに属している全メンバーの進捗概要を一覧で確認', en: 'View progress overview of all members in your projects' },
    'progress.members.period': { ja: '期間', en: 'Period' },
    'progress.members.loading': { ja: 'メンバー進捗を読み込み中...', en: 'Loading member progress...' },
    'progress.members.noMembers': { ja: 'メンバーが見つかりません', en: 'No Members Found' },
    'progress.members.noMembersDesc': { ja: 'タスクに担当者が設定されていないか、タスクが存在しません。', en: 'No members have been assigned to tasks or no tasks exist.' },
    'progress.members.after': { ja: '以降', en: 'after' },
    'progress.members.before': { ja: '以前', en: 'before' },
    'progress.status.completed': { ja: '完了', en: 'Completed' },
    'progress.status.inProgress': { ja: '作業中', en: 'In Progress' },
    'progress.status.notStarted': { ja: '未着手', en: 'Not Started' },
    // 進捗画面（プロジェクト詳細）
    'progress.project.title': { ja: '個別プロジェクト進捗', en: 'Project Progress Details' },
    'progress.project.back': { ja: '戻る', en: 'Back' },
    'progress.project.overview': { ja: '概要', en: 'Overview' },
    'progress.project.period': { ja: '期間', en: 'Period' },
    'progress.project.responsible': { ja: '責任者', en: 'Project Owner' },
    'progress.project.members': { ja: 'メンバー', en: 'Members' },
    'progress.project.notSet': { ja: '未設定', en: 'Not Set' },
    'progress.project.taskList': { ja: 'タスク一覧', en: 'Tasks' },
    'progress.project.noTasks': { ja: 'タスクが登録されていません。', en: 'No tasks registered.' },
    'progress.project.taskName': { ja: 'タスク名', en: 'Task Name' },
    'progress.project.assignee': { ja: '担当', en: 'Assigned To' },
    'progress.project.dueDate': { ja: '期限', en: 'Due Date' },
    'progress.project.status': { ja: '状態', en: 'Status' },
    // 進捗画面（メンバー詳細）
    'progress.member.title': { ja: '個別メンバーの進捗', en: 'Member Progress Details' },
    'progress.member.back': { ja: '戻る', en: 'Back' },
    'progress.member.loading': { ja: 'メンバー詳細を読み込み中...', en: 'Loading member details...' },
    'progress.member.completionRate': { ja: '完了率', en: 'Completion Rate' },
    'progress.member.totalTasks': { ja: '総タスク数', en: 'Total Tasks' },
    'progress.member.projects': { ja: '所属プロジェクト', en: 'Projects' },
    'progress.member.allTasksStatus': { ja: '全保有タスクのステータスと優先度', en: 'All Tasks Status and Priority' },
    'progress.member.period': { ja: '期間', en: 'Period' },
    // 素早いタスク
    'quickTasks.title': { ja: 'すぐやるタスク', en: 'Quick Tasks' },
    'quickTasks.dueDate': { ja: '期日設定', en: 'Due Date Setting' },
    'quickTasks.days': { ja: '{days}日以内', en: 'Within {days} days' },
    'quickTasks.loading': { ja: 'タスクを読み込み中...', en: 'Loading tasks...' },
    'quickTasks.debug': { ja: 'デバッグ{mode}', en: 'Debug {mode}' },
    'quickTasks.debugOn': { ja: 'ON', en: 'ON' },
    'quickTasks.debugOff': { ja: 'OFF', en: 'OFF' },
    'quickTasks.daysSuffix': { ja: '日以内', en: ' days within' },
    'quickTasks.noTasksFound': { ja: '該当するタスクがありません', en: 'No matching tasks found' },
    // ガント チャート
    'gantt.title': { ja: 'ガントチャート', en: 'Gantt Chart' },
    'gantt.milestone': { ja: 'マイルストーン', en: 'Milestone' },
    // カレンダー
    'calendar.title': { ja: 'カレンダー', en: 'Calendar' },
    'calendar.month': { ja: '月', en: 'Month' },
    'calendar.week': { ja: '週', en: 'Week' },
    'calendar.day': { ja: '日', en: 'Day' },
  };
  private readonly languageSubject = new BehaviorSubject<SupportedLanguage>(
    this.loadInitialLanguage()
  );

  /** 選択中の言語を購読可能な形で公開 */
  readonly language$ = this.languageSubject.asObservable();

  constructor() {
    this.applyLanguage(this.languageSubject.value);
  }

  /** 現在設定されている言語を取得 */
  getCurrentLanguage(): SupportedLanguage {
    return this.languageSubject.value;
  }

  /** 言語を更新 */
  setLanguage(language: SupportedLanguage): void {
    if (language === this.languageSubject.value) {
      return;
    }

    this.languageSubject.next(language);
    this.persistLanguage(language);
    this.applyLanguage(language);
  }

  /** ストレージから初期言語を読み込む */
  private loadInitialLanguage(): SupportedLanguage {
    if (!this.isBrowser()) {
      return this.defaultLanguage;
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored === 'ja' || stored === 'en') {
        return stored;
      }
    } catch (error) {
      console.warn('言語設定の読み込みに失敗しました', error);
    }

    return this.defaultLanguage;
  }

  /** 言語設定をブラウザに保存 */
  private persistLanguage(language: SupportedLanguage): void {
    if (!this.isBrowser()) {
      return;
    }

    try {
      localStorage.setItem(this.STORAGE_KEY, language);
    } catch (error) {
      console.warn('言語設定の保存に失敗しました', error);
    }
  }

  /** ページ全体に言語設定を反映 */
  private applyLanguage(language: SupportedLanguage): void {
    if (!this.isBrowser()) {
      return;
    }

    document.documentElement.lang = language;
    if (document.body) {
      document.body.setAttribute('data-language', language);
    }
  }

  /** 指定したキーの翻訳を取得 */
  translate(key: string): string {
    const entry = this.translations[key];
    if (entry) {
      return entry[this.languageSubject.value] || entry[this.defaultLanguage];
    }
    return key;
  }

  /** プレースホルダー対応の翻訳を取得 */
  translateWithParams(key: string, params: Record<string, string>): string {
    let text = this.translate(key);
    Object.entries(params).forEach(([key, value]) => {
      text = text.replace(`{${key}}`, value);
    });
    return text;
  }

  /** ブラウザ環境かどうかを判定 */
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }
}
