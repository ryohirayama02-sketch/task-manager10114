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
    'settings.notifications.slack': { ja: 'Slack通知', en: 'Slack Notifications' },
    'settings.notifications.address': { ja: 'メールアドレス', en: 'Email Address' },
    'settings.notifications.webhook': { ja: 'Webhook URL', en: 'Webhook URL' },
    'settings.notifications.channel': { ja: 'チャンネル', en: 'Channel' },
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

  /** ブラウザ環境かどうかを判定 */
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }
}
