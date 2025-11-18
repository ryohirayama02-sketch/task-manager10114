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
    'login.title': { ja: '課題管理アプリ', en: 'Task Manager' },
    'login.subtitle': {
      ja: 'あなたのタスクを効率的に管理',
      en: 'Manage your tasks efficiently',
    },
    'login.googleLogin': { ja: 'Google でログイン', en: 'Sign in with Google' },
    'login.emailLogin': { ja: 'メールでログイン', en: 'Sign in with Email' },
    'login.emailSignUp': { ja: 'メールで登録', en: 'Sign up with Email' },
    'login.loggingIn': { ja: 'ログイン中...', en: 'Signing in...' },
    'login.or': { ja: 'または', en: 'or' },
    'login.emailPlaceholder': { ja: 'メールアドレス', en: 'Email address' },
    'login.passwordPlaceholder': { ja: 'パスワード', en: 'Password' },
    'login.confirmPasswordPlaceholder': {
      ja: 'パスワード（確認）',
      en: 'Confirm Password',
    },
    'login.noAccount': {
      ja: 'アカウントをお持ちでないですか？',
      en: "Don't have an account?",
    },
    'login.haveAccount': {
      ja: '既にアカウントをお持ちですか？',
      en: 'Already have an account?',
    },
    'login.signUp': { ja: '登録する', en: 'Sign up' },
    'login.login': { ja: 'ログイン', en: 'Login' },
    'login.error.googleLoginFailed': {
      ja: 'Googleログインに失敗しました。',
      en: 'Google sign-in failed.',
    },
    'login.error.emailPasswordRequired': {
      ja: 'メールアドレスとパスワードを入力してください。',
      en: 'Please enter your email address and password.',
    },
    'login.error.emailPasswordRequiredNoPeriod': {
      ja: 'メールアドレスとパスワードを入力してください',
      en: 'Please enter your email address and password',
    },
    'login.error.allFieldsRequired': {
      ja: 'すべての項目を入力してください。',
      en: 'Please fill in all fields.',
    },
    'login.error.passwordMismatch': {
      ja: 'パスワードが一致しません。',
      en: 'Passwords do not match.',
    },
    'login.error.passwordMinLength': {
      ja: 'パスワードは6文字以上で入力してください。',
      en: 'Password must be at least 6 characters.',
    },
    'login.error.passwordMinLengthNoPeriod': {
      ja: 'パスワードは6文字以上で入力してください',
      en: 'Password must be at least 6 characters',
    },
    'login.error.invalidEmail': {
      ja: 'メールアドレスの形式が正しくありません。',
      en: 'Invalid email format.',
    },
    'login.error.invalidEmailNoPeriod': {
      ja: 'メールアドレスの形式が正しくありません',
      en: 'Invalid email format',
    },
    'login.error.userDisabled': {
      ja: 'このアカウントは無効化されています。',
      en: 'This account has been disabled.',
    },
    'login.error.userNotFound': {
      ja: 'このメールアドレスは登録されていません。',
      en: 'This email address is not registered.',
    },
    'login.error.userNotFoundNoPeriod': {
      ja: 'このメールアドレスは登録されていません',
      en: 'This email address is not registered',
    },
    'login.error.wrongPassword': {
      ja: 'パスワードが正しくありません。',
      en: 'Incorrect password.',
    },
    'login.error.wrongPasswordAlt': {
      ja: 'パスワードが間違っています',
      en: 'Incorrect password',
    },
    'login.error.emailAlreadyInUse': {
      ja: 'このメールアドレスは既に使用されています。',
      en: 'This email address is already in use.',
    },
    'login.error.emailAlreadyInUseNoPeriod': {
      ja: 'このメールアドレスは既に使用されています',
      en: 'This email address is already in use',
    },
    'login.error.weakPassword': {
      ja: 'パスワードが弱すぎます。',
      en: 'Password is too weak.',
    },
    'login.error.weakPasswordNoPeriod': {
      ja: 'パスワードが弱すぎます',
      en: 'Password is too weak',
    },
    'login.error.operationNotAllowed': {
      ja: 'この操作は許可されていません。',
      en: 'This operation is not allowed.',
    },
    'login.error.tooManyRequests': {
      ja: 'リクエストが多すぎます。しばらく待ってから再試行してください',
      en: 'Too many requests. Please wait a while and try again',
    },
    'login.error.popupClosedByUser': {
      ja: 'ログインがキャンセルされました',
      en: 'Sign-in was cancelled',
    },
    'login.error.loginFailed': {
      ja: 'ログインに失敗しました。もう一度お試しください。',
      en: 'Sign-in failed. Please try again.',
    },
    'login.error.loginFailedNoPeriod': {
      ja: 'ログインに失敗しました。もう一度お試しください',
      en: 'Sign-in failed. Please try again',
    },
    'login.cardTitle': { ja: 'タスク管理アプリ', en: 'Task Manager' },
    'login.cardSubtitle': { ja: 'ログイン', en: 'Sign In' },
    'login.emailLabel': { ja: 'メールアドレス', en: 'Email Address' },
    'login.passwordLabel': { ja: 'パスワード', en: 'Password' },
    'login.passwordPlaceholderInput': {
      ja: 'パスワードを入力',
      en: 'Enter password',
    },
    'login.signInButton': { ja: 'ログイン', en: 'Sign In' },
    'login.signUpButton': { ja: '新規登録', en: 'Sign Up' },
    'login.orDivider': { ja: 'または', en: 'or' },
    'login.googleSignIn': { ja: 'Googleでログイン', en: 'Sign in with Google' },
    // ルーム入室・作成画面
    'roomLogin.roomId': { ja: 'Room ID', en: 'Room ID' },
    'roomLogin.password': { ja: 'Password', en: 'Password' },
    'roomLogin.enter': { ja: '入室', en: 'Enter Room' },
    'roomLogin.createRoom': { ja: '新規ルーム作成', en: 'Create New Room' },
    'roomLogin.displayName': { ja: '表示名', en: 'Display Name' },
    'roomLogin.create': { ja: '作成', en: 'Create' },
    'roomLogin.maxLength': { ja: '最大20文字', en: 'Max 20 characters' },
    'roomLogin.error.invalidInput': {
      ja: '入力内容が正しくありません',
      en: 'Invalid input',
    },
    'roomLogin.error.roomIdExists': {
      ja: 'このroomIDはすでに作られています。別のroomIDにしてください。',
      en: 'This Room ID already exists. Please use a different Room ID.',
    },
    'roomLogin.error.createFailed': {
      ja: 'ルームを作成できませんでした。',
      en: 'Failed to create room.',
    },
    'settings.title': { ja: '設定', en: 'Settings' },
    'settings.menu.title': { ja: '設定メニュー', en: 'Settings Menu' },
    'settings.menu.notifications': {
      ja: 'メール通知設定',
      en: 'Email Notifications',
    },
    'settings.menu.home': { ja: 'ホーム画面設定', en: 'Home Screen' },
    'settings.menu.language': { ja: '言語設定', en: 'Language' },
    'settings.menu.roomInfo': { ja: 'ルーム情報', en: 'Room Information' },
    'settings.loading': {
      ja: '設定を読み込み中...',
      en: 'Loading settings...',
    },
    'settings.notifications.title': {
      ja: 'メール通知設定',
      en: 'Email Notification Settings',
    },
    'settings.notifications.subtitle': {
      ja: 'タスクの期限や作業時間に関するメール通知を設定できます',
      en: 'Configure email notifications for task due dates and working hours',
    },
    'settings.notifications.spamWarning': {
      ja: 'メール通知は迷惑メールとして受信される場合がございます。',
      en: 'Email notifications may be received as spam.',
    },
    'settings.notifications.targets': {
      ja: '通知ON/OFF設定',
      en: 'Notification ON/OFF Settings',
    },
    'settings.notifications.email': {
      ja: '通知先',
      en: 'Notification Target',
    },
    'settings.notifications.address': {
      ja: 'メールアドレス',
      en: 'Email Address',
    },
    'settings.deadline.title': {
      ja: 'タスク期限通知',
      en: 'Task Deadline Notifications',
    },
    'settings.deadline.enable': {
      ja: '期限通知を有効にする',
      en: 'Enable deadline notifications',
    },
    'settings.deadline.timing': {
      ja: '通知タイミング（期限の何日前）',
      en: 'When to notify (days before due date)',
    },
    'settings.deadline.daysSuffix': { ja: '日前', en: 'days before' },
    'settings.common.notifyTime': { ja: '通知時刻', en: 'Notification Time' },
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
    'settings.worktime.title': {
      ja: '作業予定時間オーバー通知',
      en: 'Work Time Overrun Notifications',
    },
    'settings.worktime.enable': {
      ja: '作業予定時間オーバー通知を有効にする',
      en: 'Enable work time overrun notifications',
    },
    'settings.worktime.period': { ja: 'チェック期間', en: 'Monitoring Period' },
    'settings.worktime.periodSuffix': { ja: '日間', en: 'days' },
    'settings.worktime.max': { ja: '最大作業時間', en: 'Maximum Work Hours' },
    'settings.worktime.maxSuffix': { ja: '時間', en: 'hours' },
    'settings.worktime.description': {
      ja: '{days}日以内の作業予定時間が{hours}時間を超えたら通知',
      en: 'Notify when scheduled work time exceeds {hours} hours within {days} days',
    },
    'settings.worktime.notifyManager': {
      ja: 'プロジェクト責任者に通知',
      en: 'Notify project owner',
    },
    'settings.worktime.notifyAssignee': {
      ja: '担当者に通知',
      en: 'Notify assignee',
    },
    'settings.daily.title': { ja: '今日のタスク', en: "Today's Tasks" },
    'settings.daily.enable': {
      ja: '今日のタスク通知を有効にする',
      en: "Enable today's tasks notification",
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
    'settings.loginRequired': {
      ja: 'ログインが必要です',
      en: 'Login is required',
    },
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
    'common.save': { ja: '保存', en: 'Save' },
    'common.user': { ja: 'ユーザー', en: 'User' },
    'common.update': { ja: '更新', en: 'Update' },
    'common.saving': { ja: '保存中...', en: 'Saving...' },
    'common.updating': { ja: '更新中...', en: 'Updating...' },
    'common.delete': { ja: '削除', en: 'Delete' },
    'common.notSet': { ja: '未設定', en: 'Not Set' },
    'common.nameNotSet': { ja: '名称未設定', en: 'Name Not Set' },
    'common.memberRequiredForProject': {
      ja: 'メンバー管理にメンバーを追加してください',
      en: 'Please add members in Member Management',
    },
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
    'kanban.projectSelector.title': {
      ja: '表示するプロジェクトを選択',
      en: 'Select Projects to Display',
    },
    'kanban.projectSelector.selectAll': {
      ja: 'すべてにチェック',
      en: 'Select All',
    },
    'kanban.projectSelector.clearAll': {
      ja: 'すべてのチェックをクリア',
      en: 'Clear All',
    },
    'kanban.createProject': {
      ja: '+ プロジェクトを作成',
      en: '+ Create Project',
    },
    'kanban.createTask': { ja: '+ タスク', en: '+ Task' },
    'kanban.selectProjectToAdd': {
      ja: 'タスクを追加するプロジェクトを選択してください',
      en: 'Please select a project to add a task',
    },
    'kanban.multipleProjectsSelected': {
      ja: '複数プロジェクトが選択されています。タスクを追加するには1つのプロジェクトのみを選択してください',
      en: 'Multiple projects are selected. Please select only one project to add a task',
    },
    'kanban.status.notStarted': { ja: '未着手', en: 'Not Started' },
    'kanban.status.inProgress': { ja: '作業中', en: 'In Progress' },
    'kanban.status.completed': { ja: '完了', en: 'Completed' },
    'kanban.alert.parentTaskStatusChange': {
      ja: '「親タスク：{taskName}」のステータスを作業中に変更します',
      en: 'The parent task "{taskName}" status will be changed to in progress',
    },
    'kanban.alert.incompleteSubtask': {
      ja: '「子タスク：{taskName}」が完了していません',
      en: 'The subtask "{taskName}" is not completed',
    },
    'kanban.dueDate': { ja: '期限', en: 'Due Date' },
    'kanban.assignee': { ja: '担当', en: 'Assigned To' },
    'kanban.filter.priority': { ja: '優先度', en: 'Priority' },
    'kanban.filter.assignee': { ja: '担当者', en: 'Assignee' },
    'kanban.filter.reset': { ja: 'フィルターリセット', en: 'Reset Filters' },
    // 進捗画面（全プロジェクト）
    'progress.projects.title': {
      ja: '全プロジェクト進捗',
      en: 'All Projects Progress',
    },
    'progress.projects.sortBy': { ja: '並び替え', en: 'Sort By' },
    'progress.projects.createProject': {
      ja: 'プロジェクトを作成',
      en: 'Create Project',
    },
    'progress.projects.sortBy.name': {
      ja: 'プロジェクト名',
      en: 'Project Name',
    },
    'progress.projects.sortBy.dueDate': { ja: '期限', en: 'Due Date' },
    'progress.projects.sortBy.status': { ja: '状態', en: 'Status' },
    'progress.projects.sortBy.assignee': { ja: '担当', en: 'Assigned To' },
    'progress.projects.sortBy.progress': { ja: '進捗率', en: 'Progress Rate' },
    'progress.projects.sortBy.soon': { ja: '近い順', en: 'Soon' },
    'progress.projects.sortBy.later': { ja: '遠い順', en: 'Later' },
    'progress.projects.sortBy.high': { ja: '高い順', en: 'High' },
    'progress.projects.sortBy.low': { ja: '低い順', en: 'Low' },
    'progress.projects.overview': { ja: '説明', en: 'Description' },
    'progress.projects.period': { ja: '期間', en: 'Period' },
    'progress.projects.responsible': { ja: '責任者', en: 'Responsible' },
    'progress.projects.members': { ja: 'メンバー', en: 'Members' },
    'progress.projects.completed': { ja: '完了', en: 'Completed' },
    'progress.projects.overviewNotSet': {
      ja: '（説明未設定）',
      en: '(Not Set)',
    },
    'progress.projects.membersNotSet': {
      ja: '（メンバー情報未設定）',
      en: '(Members Not Set)',
    },
    'progress.projects.responsibleNotSet': {
      ja: '（責任者未設定）',
      en: '(Responsible Not Set)',
    },
    'progress.projects.noProjectsFound': {
      ja: 'プロジェクトが見つかりません',
      en: 'No projects found',
    },
    // 進捗画面（メンバー概要）
    'progress.members.title': {
      ja: '全メンバーの進捗',
      en: 'All Members Progress',
    },
    'progress.members.description': {
      ja: '全メンバーの進捗を一覧で確認',
      en: 'View progress overview of all members',
    },
    'progress.members.period': { ja: '期間', en: 'Period' },
    'progress.members.loading': {
      ja: 'メンバー進捗を読み込み中...',
      en: 'Loading member progress...',
    },
    'progress.members.noMembers': {
      ja: 'メンバーが見つかりません',
      en: 'No Members Found',
    },
    'progress.members.noMembersDesc': {
      ja: 'タスクに担当者が設定されていないか、タスクが存在しません。',
      en: 'No members have been assigned to tasks or no tasks exist.',
    },
    'progress.members.after': { ja: '以降', en: 'after' },
    'progress.members.before': { ja: '以前', en: 'before' },
    'progress.members.role': { ja: '役職:', en: 'Role:' },
    'progress.members.email': { ja: 'メール:', en: 'Email:' },
    'progress.members.completedTasks': {
      ja: '完了タスク:',
      en: 'Completed Tasks:',
    },
    'progress.members.inProgress': { ja: '作業中:', en: 'In Progress:' },
    'progress.members.notStarted': { ja: '未着手:', en: 'Not Started:' },
    'progress.members.count': { ja: '件', en: 'tasks' },
    'progress.members.completionRate': { ja: '完了率', en: 'Completion Rate' },
    'progress.members.priority': { ja: '優先度', en: 'Priority' },
    'progress.priority.high': { ja: '高', en: 'High' },
    'progress.priority.medium': { ja: '中', en: 'Medium' },
    'progress.priority.low': { ja: '低', en: 'Low' },
    'progress.status.completed': { ja: '完了', en: 'Completed' },
    'progress.status.inProgress': { ja: '作業中', en: 'In Progress' },
    'progress.status.notStarted': { ja: '未着手', en: 'Not Started' },
    // 進捗画面（プロジェクト詳細）
    'progress.project.title': {
      ja: '個別プロジェクト進捗',
      en: 'Project Progress Details',
    },
    'progress.project.back': { ja: '戻る', en: 'Back' },
    'progress.project.overview': { ja: '概要', en: 'Overview' },
    'progress.project.period': { ja: '期間', en: 'Period' },
    'progress.project.responsible': { ja: '責任者', en: 'Project Owner' },
    'progress.project.members': { ja: 'メンバー', en: 'Members' },
    'progress.project.notSet': { ja: '未設定', en: 'Not Set' },
    'progress.project.taskList': { ja: 'タスク一覧', en: 'Tasks' },
    'progress.project.noTasks': {
      ja: 'タスクが登録されていません。',
      en: 'No tasks registered.',
    },
    'progress.project.taskName': { ja: 'タスク名', en: 'Task Name' },
    'progress.project.assignee': { ja: '担当', en: 'Assigned To' },
    'progress.project.dueDate': { ja: '期限', en: 'Due Date' },
    'progress.project.status': { ja: '状態', en: 'Status' },
    // 進捗画面（メンバー詳細）
    'progress.member.title': {
      ja: '個別メンバーの進捗',
      en: 'Member Progress Details',
    },
    'progress.member.back': { ja: '戻る', en: 'Back' },
    'progress.member.loading': {
      ja: 'メンバー詳細を読み込み中...',
      en: 'Loading member details...',
    },
    'progress.member.completionRate': {
      ja: '総タスクの完了率',
      en: 'Total Tasks Completion Rate',
    },
    'progress.member.periodCompletionRate': {
      ja: '期間内タスク完了率',
      en: 'Period Task Completion Rate',
    },
    'progress.member.totalTasks': { ja: '総タスク数', en: 'Total Tasks' },
    'progress.member.projects': { ja: '所属プロジェクト', en: 'Projects' },
    'progress.member.allTasksStatus': {
      ja: '全保有タスクのステータスと優先度',
      en: 'All Tasks Status and Priority',
    },
    'progress.member.period': { ja: '期間', en: 'Period' },
    'progress.member.periodDialog.title': {
      ja: '期間を選択',
      en: 'Select Period',
    },
    'progress.member.periodDialog.startDate': {
      ja: '開始日',
      en: 'Start Date',
    },
    'progress.member.periodDialog.endDate': { ja: '終了日', en: 'End Date' },
    'progress.member.periodDialog.cancel': { ja: 'キャンセル', en: 'Cancel' },
    'progress.member.periodDialog.confirm': { ja: '確定', en: 'Confirm' },
    'progress.member.periodDialog.reset': { ja: 'リセット', en: 'Reset' },
    'progress.member.taskList': { ja: 'タスク一覧', en: 'Tasks' },
    'progress.member.filter.project': { ja: 'プロジェクト', en: 'Project' },
    'progress.member.filter.dueDate': { ja: '期日', en: 'Due Date' },
    'progress.member.filter.status': { ja: 'ステータス', en: 'Status' },
    'progress.member.filter.priority': { ja: '優先度', en: 'Priority' },
    'progress.member.filter.sortNone': { ja: 'ソートなし', en: 'No Sort' },
    'progress.member.filter.sortNear': { ja: '近い順', en: 'Soon' },
    'progress.member.filter.sortFar': { ja: '遠い順', en: 'Later' },
    'progress.member.filter.reset': { ja: 'リセット', en: 'Reset' },
    'progress.member.filter.export': { ja: '出力', en: 'Export' },
    'progress.member.table.projectName': {
      ja: 'プロジェクト名',
      en: 'Project Name',
    },
    'progress.member.table.taskName': { ja: 'タスク名', en: 'Task Name' },
    'progress.member.table.status': { ja: 'ステータス', en: 'Status' },
    'progress.member.table.dueDate': { ja: '期日', en: 'Due Date' },
    'progress.member.table.priority': { ja: '優先度', en: 'Priority' },
    'progress.member.noMemberFound': {
      ja: 'メンバーが見つかりません',
      en: 'Member Not Found',
    },
    'progress.member.noMemberFoundDesc': {
      ja: '指定されたメンバーのタスクが見つかりません。',
      en: 'No tasks found for the specified member.',
    },
    'progress.member.filter.noTasksToExport': {
      ja: '出力できるタスクがありません。',
      en: 'No tasks to export.',
    },
    // 素早いタスク
    'quickTasks.title': { ja: 'すぐやるタスク', en: 'Quick Tasks' },
    'quickTasks.dueDate': { ja: '期間設定', en: 'Period Setting' },
    'quickTasks.days': { ja: '{days}日以内', en: 'Within {days} days' },
    'quickTasks.loading': {
      ja: 'タスクを読み込み中...',
      en: 'Loading tasks...',
    },
    'quickTasks.debug': { ja: 'デバッグ{mode}', en: 'Debug {mode}' },
    'quickTasks.debugOn': { ja: 'ON', en: 'ON' },
    'quickTasks.debugOff': { ja: 'OFF', en: 'OFF' },
    'quickTasks.daysSuffix': { ja: '日以内', en: ' days within' },
    'quickTasks.noTasksFound': {
      ja: '該当するタスクがありません',
      en: 'No matching tasks found',
    },
    'quickTasks.noTasksFoundDesc': {
      ja: '以内に期限が来る未完了のタスクはありません。',
      en: 'There are no incomplete tasks with deadlines within the selected period.',
    },
    'quickTasks.debugInfo': {
      ja: '🔍 デバッグ情報',
      en: '🔍 Debug Information',
    },
    'quickTasks.totalTasks': { ja: '全タスク数:', en: 'Total Tasks:' },
    'quickTasks.userRelatedTasks': {
      ja: '現在のユーザーに関連するタスク数:',
      en: 'Tasks related to current user:',
    },
    'quickTasks.currentUser': { ja: '現在のユーザー:', en: 'Current User:' },
    'quickTasks.userRelatedTasksList': {
      ja: '現在のユーザーに関連するタスク一覧:',
      en: 'Tasks related to current user:',
    },
    'quickTasks.projectName': { ja: 'プロジェクト名：', en: 'Project Name: ' },
    'quickTasks.dueDateLabel': { ja: '期日：', en: 'Due Date: ' },
    'quickTasks.daysAfter': { ja: '日後', en: ' days later' },
    'quickTasks.daysOverdue': { ja: '日遅れ', en: ' days overdue' },
    'quickTasks.noUserTasksFound': {
      ja: '⚠️ 現在のユーザーに関連するタスクが見つかりません',
      en: '⚠️ No tasks found for current user',
    },
    'quickTasks.checkAllTaskAssignees': {
      ja: '全タスクの担当者情報を確認してください：',
      en: 'Please check assignee information for all tasks:',
    },
    'quickTasks.assignee': { ja: '担当者:', en: 'Assignee:' },
    'quickTasks.assigneeEmail': { ja: '担当者メール:', en: 'Assignee Email:' },
    // ガント チャート
    'gantt.title': { ja: 'ガントチャート式課題管理', en: 'Gantt Chart' },
    'gantt.projectSelector.title': {
      ja: '表示するプロジェクトを選択',
      en: 'Select Projects to Display',
    },
    'gantt.projectSelector.selectAll': {
      ja: 'すべてにチェック',
      en: 'Select All',
    },
    'gantt.projectSelector.clearAll': {
      ja: 'すべてのチェックをクリア',
      en: 'Clear All',
    },
    'gantt.projectSelector.createProject': {
      ja: '+ プロジェクトを作成',
      en: '+ Create Project',
    },
    'gantt.filter.status': { ja: 'ステータス', en: 'Status' },
    'gantt.filter.priority': { ja: '優先度', en: 'Priority' },
    'gantt.filter.assignee': { ja: '担当者', en: 'Assignee' },
    'gantt.milestone': { ja: 'マイルストーン', en: 'Milestone' },
    'gantt.filter.reset': { ja: 'フィルターリセット', en: 'Reset Filters' },
    'gantt.legend.status': { ja: 'ステータス', en: 'Status' },
    'gantt.legend.notStarted': { ja: '未着手', en: 'Not Started' },
    'gantt.legend.inProgress': { ja: '作業中', en: 'In Progress' },
    'gantt.legend.completed': { ja: '完了', en: 'Completed' },
    'gantt.header.projectName': { ja: 'プロジェクト名', en: 'Project Name' },
    'gantt.header.taskName': { ja: 'タスク名', en: 'Task Name' },
    'gantt.header.priority': { ja: '優先度', en: 'Priority' },
    'gantt.header.assignee': { ja: '担当者', en: 'Assignee' },
    'gantt.tooltip.milestone': { ja: 'マイルストーン', en: 'Milestone' },
    'gantt.status.notStarted': { ja: '未着手', en: 'Not Started' },
    'gantt.status.inProgress': { ja: '作業中', en: 'In Progress' },
    'gantt.status.completed': { ja: '完了', en: 'Completed' },
    'gantt.priority.high': { ja: '高', en: 'High' },
    'gantt.priority.medium': { ja: '中', en: 'Medium' },
    'gantt.priority.low': { ja: '低', en: 'Low' },
    'gantt.priority.short.high': { ja: '高', en: 'H' },
    'gantt.priority.short.medium': { ja: '中', en: 'M' },
    'gantt.priority.short.low': { ja: '低', en: 'L' },
    'gantt.notSet': { ja: '未設定', en: 'Not Set' },
    'gantt.error.projectIdMissing': {
      ja: 'プロジェクトIDが不足しています',
      en: 'Project ID is missing',
    },
    'gantt.error.taskProjectIdMissing': {
      ja: 'タスクのprojectIdまたはidが不足しています',
      en: 'Task projectId or id is missing',
    },
    'gantt.screenWidthWarning': {
      ja: '注意：ガントを表示するには画面幅が狭いです。大きな画面で見てください。',
      en: 'Warning: The screen width is too narrow to display the Gantt chart. Please view on a larger screen.',
    },
    // カレンダー
    'calendar.title': { ja: 'カレンダー式課題管理', en: 'Calendar View' },
    'calendar.offlineTaskAdd': {
      ja: 'オフラインでタスク追加',
      en: 'Add Task Offline',
    },
    'calendar.offlineNote': {
      ja: 'オフライン時は簡易的なタスク追加のみ可能です',
      en: 'Limited task addition available while offline',
    },
    'calendar.projectSelector.title': {
      ja: '表示するプロジェクトを選択',
      en: 'Select Projects to Display',
    },
    'calendar.projectSelector.selectAll': {
      ja: 'すべてにチェック',
      en: 'Select All',
    },
    'calendar.projectSelector.clearAll': {
      ja: 'すべてのチェックをクリア',
      en: 'Clear All',
    },
    'calendar.filter.status': { ja: 'ステータス', en: 'Status' },
    'calendar.filter.priority': { ja: '優先度', en: 'Priority' },
    'calendar.filter.assignee': { ja: '担当者', en: 'Assignee' },
    'calendar.filter.reset': { ja: 'フィルターリセット', en: 'Reset Filters' },
    'calendar.actionButtons.addProject': {
      ja: 'プロジェクトを作成',
      en: 'Create Project',
    },
    'calendar.header.today': { ja: '今日', en: 'Today' },
    'calendar.legend.status': { ja: 'ステータス', en: 'Status' },
    'calendar.legend.status.notStarted': { ja: '未着手', en: 'Not Started' },
    'calendar.legend.status.inProgress': { ja: '作業中', en: 'In Progress' },
    'calendar.legend.status.completed': { ja: '完了', en: 'Completed' },
    'calendar.milestoneTooltip.title': {
      ja: 'マイルストーン',
      en: 'Milestone',
    },
    'calendar.status.notStarted': { ja: '未着手', en: 'Not Started' },
    'calendar.status.inProgress': { ja: '作業中', en: 'In Progress' },
    'calendar.status.completed': { ja: '完了', en: 'Completed' },
    'calendar.priority.high': { ja: '高', en: 'High' },
    'calendar.priority.medium': { ja: '中', en: 'Medium' },
    'calendar.priority.low': { ja: '低', en: 'Low' },
    'calendar.offline.simpleTaskOnly': {
      ja: 'オフライン時は簡易的なタスク追加のみ可能です。オンライン復帰後に詳細な編集ができます。',
      en: 'Only simple task addition is available offline. Detailed editing will be available after coming back online.',
    },
    'calendar.offline.enterTaskName': {
      ja: 'タスク名を入力してください:',
      en: 'Enter task name:',
    },
    'calendar.offline.enterDueDate': {
      ja: '期日を入力してください (YYYY-MM-DD):',
      en: 'Enter due date (YYYY-MM-DD):',
    },
    'calendar.offline.taskSaved': {
      ja: 'タスクをオフラインで保存しました。オンライン復帰後に同期されます。',
      en: 'Task saved offline. It will sync when you come back online.',
    },
    'calendar.offline.taskName': {
      ja: 'オフラインタスク',
      en: 'Offline Task',
    },
    'calendar.taskTooltip.dueDate': {
      ja: '期限: ',
      en: 'Due: ',
    },
    'calendar.error.taskProjectIdMissing': {
      ja: 'タスクのprojectIdまたはidが不足しています',
      en: 'Task projectId or id is missing',
    },
    'calendar.close': { ja: '閉じる', en: 'Close' },
    // プロジェクト詳細
    'projectDetail.title': { ja: 'プロジェクト詳細', en: 'Project Details' },
    'projectDetail.back': {
      ja: '全プロジェクト進捗へ',
      en: 'To All Projects Progress',
    },
    'projectDetail.editMode': { ja: '編集モード', en: 'Edit Mode' },
    'projectDetail.on': { ja: 'ON', en: 'ON' },
    'projectDetail.off': { ja: 'OFF', en: 'OFF' },
    'projectDetail.overview': { ja: '説明', en: 'Overview' },
    'projectDetail.overviewPlaceholder': {
      ja: 'プロジェクトの詳細説明を入力してください（200文字以内）',
      en: 'Enter project details (max 200 characters)',
    },
    'projectDetail.notSet': { ja: '未設定', en: 'Not Set' },
    'projectDetail.period': { ja: '期間', en: 'Period' },
    'projectDetail.responsible': { ja: '責任者', en: 'Project Owner' },
    'projectDetail.selectResponsiblePlaceholder': {
      ja: '責任者を選択してください（複数選択可）',
      en: 'Select project owners (multiple selection)',
    },
    'projectDetail.selectResponsiblePlaceholderFull': {
      ja: '責任者を選択してください（複数選択可）（入力必須）',
      en: 'Select project owners (multiple selection) (Required)',
    },
    'projectDetail.members': { ja: 'メンバー', en: 'Members' },
    'projectDetail.materials': { ja: '資料', en: 'Materials' },
    'projectDetail.tasks': { ja: 'タスク', en: 'Tasks' },
    'projectDetail.saveChanges': { ja: '変更を保存', en: 'Save Changes' },
    'projectDetail.delete': { ja: 'プロジェクトを削除', en: 'Delete Project' },
    'projectDetail.projectName': { ja: 'プロジェクト名', en: 'Project Name' },
    'projectDetail.projectNamePlaceholder': {
      ja: '例: 新商品開発プロジェクト',
      en: 'e.g.: New Product Development Project',
    },
    'projectDetail.projectNamePlaceholderFull': {
      ja: '例: 新商品開発プロジェクト（入力必須）',
      en: 'e.g.: New Product Development Project (Required)',
    },
    'projectDetail.startDate': { ja: '開始日', en: 'Start Date' },
    'projectDetail.startDatePlaceholder': {
      ja: '開始日を選択',
      en: 'Select start date',
    },
    'projectDetail.startDatePlaceholderFull': {
      ja: '開始日を選択（選択必須）',
      en: 'Select start date (Selection Required)',
    },
    'projectDetail.endDate': { ja: '終了日', en: 'End Date' },
    'projectDetail.endDatePlaceholder': {
      ja: '終了日を選択',
      en: 'Select end date',
    },
    'projectDetail.endDatePlaceholderFull': {
      ja: '終了日を選択（選択必須）',
      en: 'Select end date (Selection Required)',
    },
    'projectDetail.assignee': { ja: 'メンバー', en: 'Members' },
    'projectDetail.selectMember': {
      ja: 'メンバーを選択',
      en: 'Select Members',
    },
    'projectDetail.selectMemberPlaceholderFull': {
      ja: 'メンバーを選択してください（複数選択可）（入力必須）',
      en: 'Select members (multiple selection) (Required)',
    },
    'projectDetail.addFile': { ja: 'ファイルを追加', en: 'Add File' },
    'projectDetail.enterUrl': { ja: 'URLを入力', en: 'Enter URL' },
    'projectDetail.urlPlaceholder': {
      ja: 'https://example.com',
      en: 'https://example.com',
    },
    'projectDetail.add': { ja: '追加', en: 'Add' },
    'projectDetail.materialName': { ja: '資料名', en: 'Material Name' },
    'projectDetail.designMaterial': { ja: '設計資料', en: 'Design Document' },
    'projectDetail.materialUrl': { ja: '資料URL', en: 'Material URL' },
    'projectDetail.addUrl': { ja: 'URLを追加', en: 'Add URL' },
    'projectDetail.uploadingFiles': {
      ja: '保存時にアップロードされるファイル',
      en: 'Files to upload on save',
    },
    'projectDetail.registeredMaterials': {
      ja: '登録済み資料',
      en: 'Registered Materials',
    },
    'projectDetail.removeAttachment': {
      ja: '添付を削除',
      en: 'Remove Attachment',
    },
    'projectDetail.noRegisteredMaterials': {
      ja: '登録済みの資料はありません',
      en: 'No registered materials',
    },
    'projectDetail.uploadingAttachments': {
      ja: '添付ファイルをアップロード中...',
      en: 'Uploading attachments...',
    },
    'projectDetail.milestones': { ja: 'マイルストーン', en: 'Milestones' },
    'projectDetail.date': { ja: '日付', en: 'Date' },
    'projectDetail.milestoneDatePlaceholder': {
      ja: '日付を選択',
      en: 'Select date',
    },
    'projectDetail.milestoneName': {
      ja: 'マイルストーン名',
      en: 'Milestone Name',
    },
    'projectDetail.removeMilestone': {
      ja: 'マイルストーンを削除',
      en: 'Remove Milestone',
    },
    'projectDetail.addMilestone': {
      ja: 'マイルストーンを追加',
      en: 'Add Milestone',
    },
    'projectDetail.maxMilestonesReached': {
      ja: 'マイルストーンは1プロジェクトあたり3つまで追加できます',
      en: 'You can add up to 3 milestones per project',
    },
    'projectDetail.themeColor': {
      ja: 'プロジェクトカラー',
      en: 'Project Color',
    },
    'projectDetail.taskList': { ja: 'タスク一覧', en: 'Tasks' },
    'projectDetail.addTask': { ja: '+ タスク', en: '+ Task' },
    'projectDetail.export': { ja: '出力', en: 'Export' },
    'projectDetail.status': { ja: 'ステータス', en: 'Status' },
    'projectDetail.all': { ja: 'すべて', en: 'All' },
    'projectDetail.priority': { ja: '優先度', en: 'Priority' },
    'projectDetail.selectAssignee': {
      ja: '担当者',
      en: 'Assignee',
    },
    'projectDetail.dueDate': { ja: '期日', en: 'Due Date' },
    'projectDetail.selectDueDate': { ja: '期日を選択', en: 'Select Due Date' },
    'projectDetail.reset': { ja: 'リセット', en: 'Reset' },
    'projectDetail.parentTask': { ja: '親タスク', en: 'Parent Task' },
    'projectDetail.noTasks': { ja: 'タスクがありません', en: 'No tasks' },
    'projectDetail.deleteProject': {
      ja: 'プロジェクトを削除',
      en: 'Delete Project',
    },
    'projectDetail.loading': { ja: '読み込み中...', en: 'Loading...' },
    'projectDetail.deleteProjectConfirm': {
      ja: '本当にこのプロジェクトを削除しますか？',
      en: 'Are you sure you want to delete this project?',
    },
    'projectDetail.required': { ja: '（入力必須）', en: '(Required)' },
    'projectDetail.status.notStarted': { ja: '未着手', en: 'Not Started' },
    'projectDetail.status.inProgress': { ja: '作業中', en: 'In Progress' },
    'projectDetail.status.completed': { ja: '完了', en: 'Completed' },
    'projectDetail.status.notStarted.short': { ja: '未着手', en: 'NS' },
    'projectDetail.status.inProgress.short': { ja: '作業中', en: 'IP' },
    'projectDetail.status.completed.short': { ja: '完了', en: 'C' },
    'projectDetail.priority.high': { ja: '高', en: 'High' },
    'projectDetail.priority.medium': { ja: '中', en: 'Medium' },
    'projectDetail.priority.low': { ja: '低', en: 'Low' },
    'projectDetail.priority.high.short': { ja: '高', en: 'H' },
    'projectDetail.priority.medium.short': { ja: '中', en: 'M' },
    'projectDetail.priority.low.short': { ja: '低', en: 'L' },
    'projectDetail.chatTitle': {
      ja: 'プロジェクトチャット',
      en: 'Project Chat',
    },
    'projectDetail.error.projectNotFound': {
      ja: 'プロジェクトが見つかりませんでした',
      en: 'Project not found',
    },
    'projectDetail.error.projectNameRequired': {
      ja: 'プロジェクト名を入力してください',
      en: 'Please enter project name',
    },
    'projectDetail.error.datesRequired': {
      ja: '開始日と終了日は必須です',
      en: 'Start date and end date are required',
    },
    'projectDetail.error.startDateAfterEndDate': {
      ja: '開始日は終了日より前の日付を設定してください',
      en: 'Start date must be before end date',
    },
    'projectDetail.error.responsibleRequired': {
      ja: '責任者は1人以上選択してください',
      en: 'Please select at least one project owner',
    },
    'projectDetail.error.membersRequired': {
      ja: 'プロジェクトメンバーは1人以上選択してください',
      en: 'Please select at least one project member',
    },
    'projectDetail.success.saved': {
      ja: 'プロジェクトを保存しました',
      en: 'Project saved successfully',
    },
    'projectDetail.error.updateFailed': {
      ja: 'プロジェクトの更新に失敗しました',
      en: 'Failed to update project',
    },
    'projectDetail.success.deleted': {
      ja: 'プロジェクト「{projectName}」を削除しました',
      en: 'Project "{projectName}" deleted successfully',
    },
    'projectDetail.error.deleteFailed': {
      ja: 'プロジェクトの削除に失敗しました',
      en: 'Failed to delete project',
    },
    'projectDetail.error.fileSizeExceeded': {
      ja: '{fileName} は5MBを超えています。別のファイルを選択してください。',
      en: '{fileName} exceeds 5MB. Please select another file.',
    },
    'projectDetail.error.invalidUrl': {
      ja: 'URLの形式が正しくありません',
      en: 'Invalid URL format',
    },
    'projectDetail.error.urlAlreadyAdded': {
      ja: 'このURLは既に追加されています',
      en: 'This URL has already been added',
    },
    'projectDetail.error.maxAttachmentsReached': {
      ja: 'ファイルとURLの合計は3つまでです',
      en: 'Maximum 3 attachments (files and URLs) allowed',
    },
    'projectDetail.error.attachmentUploadFailed': {
      ja: '{fileName} のアップロードに失敗しました',
      en: 'Failed to upload {fileName}',
    },
    'projectDetail.error.attachmentDeleteFailed': {
      ja: '資料の削除に失敗しました',
      en: 'Failed to delete material',
    },
    'projectDetail.error.projectNameExists': {
      ja: 'このプロジェクト名は既に使用されています',
      en: 'This project name is already in use',
    },
    'projectDetail.error.membersLoadFailed': {
      ja: 'メンバー一覧の取得に失敗しました',
      en: 'Failed to load members',
    },
    'projectDetail.error.maxParentTasks': {
      ja: '親タスクは最大{count}個作成できます',
      en: 'You can create up to {count} parent tasks',
    },
    'projectDetail.error.noDataToExport': {
      ja: '出力するデータがありません',
      en: 'No data to export',
    },
    'projectDetail.csv.header.taskName': { ja: 'タスク名', en: 'Task Name' },
    'projectDetail.csv.header.status': { ja: 'ステータス', en: 'Status' },
    'projectDetail.csv.header.dueDate': { ja: '期日', en: 'Due Date' },
    'projectDetail.csv.header.priority': { ja: '優先度', en: 'Priority' },
    'projectDetail.csv.header.assignee': { ja: '担当者', en: 'Assignee' },
    'projectDetail.csv.header.startDate': { ja: '開始日', en: 'Start Date' },
    'projectDetail.csv.header.description': { ja: '説明', en: 'Description' },
    'projectDetail.milestoneNamePlaceholder': {
      ja: '（30文字以内）',
      en: '(max 30 characters)',
    },
    'projectDetail.tooltip.noColor': {
      ja: '色を選択しない',
      en: "Don't select color",
    },
    'projectDetail.ariaLabel.themeColorNone': {
      ja: 'テーマ色 なし',
      en: 'Theme Color None',
    },
    'projectDetail.ariaLabel.themeColor': {
      ja: 'テーマ色 {colorName}',
      en: 'Theme Color {colorName}',
    },
    'projectDetail.deleteConfirm.title': {
      ja: 'プロジェクト削除の確認',
      en: 'Confirm Project Deletion',
    },
    'projectDetail.deleteConfirm.message': {
      ja: '以下のプロジェクトを削除しますか？',
      en: 'Do you want to delete the following project?',
    },
    'projectDetail.deleteConfirm.tasksWarning': {
      ja: 'このプロジェクトに紐づく{count}件のタスク（親タスク・子タスク含む）も一緒に削除されます。',
      en: '{count} tasks (including parent and child tasks) associated with this project will also be deleted.',
    },
    'projectDetail.deleteConfirm.irreversibleWarning': {
      ja: 'この操作は取り消せません。プロジェクトに関連するすべてのタスクとデータが削除されます。',
      en: 'This operation cannot be undone. All tasks and data related to this project will be deleted.',
    },
    'projectDetail.deleteConfirm.cancel': { ja: 'キャンセル', en: 'Cancel' },
    'projectDetail.deleteConfirm.delete': { ja: '削除する', en: 'Delete' },
    'projectDetail.memberRemoveConfirm.title': {
      ja: 'メンバーをプロジェクトから外す',
      en: 'Remove Member from Project',
    },
    'projectDetail.memberRemoveConfirm.message': {
      ja: '以下のメンバーをプロジェクトから外しますか？',
      en: 'Do you want to remove the following member from the project?',
    },
    'projectDetail.memberRemoveConfirm.affectedTasksWarning': {
      ja: 'このメンバーが担当している{count}件のタスク・子タスクから担当者を削除します。',
      en: 'This member will be removed from {count} tasks and subtasks they are assigned to.',
    },
    'projectDetail.memberRemoveConfirm.tasksToDeleteWarning': {
      ja: 'このメンバーしか担当者がいない{count}件のタスク・子タスクは削除されます。',
      en: '{count} tasks and subtasks with no other assignees will be deleted.',
    },
    'projectDetail.memberRemoveConfirm.irreversibleWarning': {
      ja: 'この操作は取り消せません。担当者が空になったタスクは削除されます。',
      en: 'This operation cannot be undone. Tasks with no assignees will be deleted.',
    },
    'projectDetail.memberRemoveConfirm.cancel': {
      ja: 'キャンセル',
      en: 'Cancel',
    },
    'projectDetail.memberRemoveConfirm.remove': { ja: '外す', en: 'Remove' },
    'projectDetail.memberRemoveConfirm.success': {
      ja: 'メンバーをプロジェクトから外しました',
      en: 'Member removed from project successfully',
    },
    'projectDetail.memberRemoveConfirm.error': {
      ja: 'メンバーの削除に失敗しました',
      en: 'Failed to remove member',
    },
    // プロジェクトチャット
    'projectChat.loading': {
      ja: 'チャットを読み込み中...',
      en: 'Loading chat...',
    },
    'projectChat.noMessages': {
      ja: 'まだメッセージはありません',
      en: 'No messages yet',
    },
    'projectChat.messagePlaceholder': {
      ja: 'メッセージを入力（最大100文字）',
      en: 'Enter message (max 100 characters)',
    },
    'projectChat.send': { ja: '送信', en: 'Send' },
    // タスク詳細追加キー
    'taskDetail.back': { ja: '戻る', en: 'Back' },
    'taskDetail.backToProject': {
      ja: 'プロジェクト詳細へ',
      en: 'To Project Details',
    },
    'taskDetail.backToParentTask': {
      ja: '親タスク詳細へ',
      en: 'To Parent Task Details',
    },
    'taskDetail.title': { ja: 'タスク詳細', en: 'Task Detail' },
    'taskDetail.childTaskTitle': {
      ja: '子タスク詳細',
      en: 'Child Task Detail',
    },
    'taskDetail.editMode': { ja: '編集モード', en: 'Edit Mode' },
    'taskDetail.on': { ja: 'ON', en: 'ON' },
    'taskDetail.off': { ja: 'OFF', en: 'OFF' },
    'taskDetail.description': { ja: 'タスク説明', en: 'Description' },
    'taskDetail.taskName': { ja: 'タスク名', en: 'Task Name' },
    'taskDetail.taskNamePlaceholder': {
      ja: 'タスク名を入力してください',
      en: 'Enter task name',
    },
    'taskDetail.taskNamePlaceholderFull': {
      ja: 'タスク名を入力してください（入力必須）',
      en: 'Enter task name (Required)',
    },
    'taskDetail.childTaskNamePlaceholderFull': {
      ja: '子タスク名を入力してください（入力必須）',
      en: 'Enter child task name (Required)',
    },
    'taskDetail.childTaskName': { ja: '子タスク名', en: 'Child Task Name' },
    'taskDetail.projectName': { ja: 'プロジェクト名', en: 'Project Name' },
    'taskDetail.parentTaskName': { ja: '親タスク名', en: 'Parent Task Name' },
    'taskDetail.calendarSync': { ja: 'カレンダー連携', en: 'Calendar Sync' },
    'taskDetail.export': { ja: '出力', en: 'Export' },
    'taskDetail.reset': { ja: 'リセット', en: 'Reset' },
    'taskDetail.project': { ja: 'プロジェクト', en: 'Project' },
    'taskDetail.parentTask': { ja: '親タスク', en: 'Parent Task' },
    'taskDetail.period': { ja: '期間', en: 'Period' },
    'taskDetail.assignee': { ja: '担当者', en: 'Assignee' },
    'taskDetail.assigneePlaceholder': {
      ja: '担当者を選択してください（複数選択可）',
      en: 'Select assignees (multiple selection)',
    },
    'taskDetail.assigneePlaceholderFull': {
      ja: '担当者を選択してください（複数選択可）（入力必須）',
      en: 'Select assignees (multiple selection) (Required)',
    },
    'taskDetail.status': { ja: 'ステータス', en: 'Status' },
    'taskDetail.priority': { ja: '優先度', en: 'Priority' },
    'taskDetail.startDate': { ja: '開始日', en: 'Start Date' },
    'taskDetail.startDatePlaceholder': {
      ja: '開始日を選択',
      en: 'Select start date',
    },
    'taskDetail.startDatePlaceholderFull': {
      ja: '開始日を選択（選択必須）',
      en: 'Select start date (Selection Required)',
    },
    'taskDetail.dueDate': { ja: '終了日', en: 'Due Date' },
    'taskDetail.dueDatePlaceholder': {
      ja: '期日を選択',
      en: 'Select due date',
    },
    'taskDetail.dueDatePlaceholderFull': {
      ja: '期日を選択（選択必須）',
      en: 'Select due date (Selection Required)',
    },
    'taskDetail.unassigned': { ja: '未割当', en: 'Unassigned' },
    'taskDetail.status.notStarted': { ja: '未着手', en: 'Not Started' },
    'taskDetail.status.inProgress': { ja: '作業中', en: 'In Progress' },
    'taskDetail.status.completed': { ja: '完了', en: 'Completed' },
    'taskDetail.status.notStarted.short': { ja: '未着手', en: 'NS' },
    'taskDetail.status.inProgress.short': { ja: '作業中', en: 'IP' },
    'taskDetail.status.completed.short': { ja: '完了', en: 'C' },
    'taskDetail.priority.high': { ja: '高', en: 'High' },
    'taskDetail.priority.medium': { ja: '中', en: 'Medium' },
    'taskDetail.priority.low': { ja: '低', en: 'Low' },
    'taskDetail.priority.high.short': { ja: '高', en: 'H' },
    'taskDetail.priority.medium.short': { ja: '中', en: 'M' },
    'taskDetail.priority.low.short': { ja: '低', en: 'L' },
    'taskDetail.tags': { ja: 'タグ', en: 'Tags' },
    'taskDetail.noTags': { ja: 'タグなし', en: 'No Tags' },
    'taskDetail.materials': { ja: '資料', en: 'Materials' },
    'taskDetail.noMaterials': { ja: '資料なし', en: 'No Materials' },
    'taskDetail.relatedFiles': { ja: '関連資料', en: 'Related Files' },
    'taskDetail.noRelatedFiles': { ja: '関連資料なし', en: 'No Related Files' },
    'taskDetail.addTag': { ja: 'タグを追加', en: 'Add Tag' },
    'taskDetail.enterTag': { ja: 'タグを入力してEnter', en: 'Enter tag' },
    'taskDetail.enterUrlOrFileName': {
      ja: 'URLまたはファイル名',
      en: 'URL or File Name',
    },
    'taskDetail.enterUrlOrFileNamePlaceholder': {
      ja: 'https://... またはファイル名を入力してEnter',
      en: 'Enter https://... or file name',
    },
    'taskDetail.enterUrl': { ja: 'URLを入力', en: 'Enter URL' },
    'taskDetail.urlPlaceholder': {
      ja: 'https://example.com',
      en: 'https://example.com',
    },
    'taskDetail.add': { ja: '追加', en: 'Add' },
    'taskDetail.taskChat': { ja: 'タスクチャット', en: 'Task Chat' },
    'taskDetail.createSubtask': { ja: '子タスク', en: 'Create Subtask' },
    'taskDetail.duplicate': { ja: '複製', en: 'Duplicate' },
    'taskDetail.detailSettings': { ja: '詳細設定', en: 'Detail Settings' },
    'taskDetail.deleteTask': { ja: 'タスクを削除', en: 'Delete Task' },
    'taskDetail.childTasks': { ja: '子タスク一覧', en: 'Child Tasks' },
    'taskDetail.all': { ja: 'すべて', en: 'All' },
    'taskDetail.selectDueDate': { ja: '期日を選択', en: 'Select Due Date' },
    'taskDetail.dueDateFilter': { ja: '期日', en: 'Due Date' },
    'taskDetail.noChildTasks': {
      ja: '条件に一致する子タスクがありません。',
      en: 'No child tasks matching the criteria.',
    },
    'taskDetail.notificationSettings': {
      ja: '通知対象設定',
      en: 'Notification Target Settings',
    },
    'taskDetail.taskDeadlineNotification': {
      ja: '通知を有効',
      en: 'Enable Notification',
    },
    'taskDetail.notificationRecipients': {
      ja: '通知先',
      en: 'Notification Recipients',
    },
    'taskDetail.taskOrder': {
      ja: 'タスクの順番管理',
      en: 'Task Order Management',
    },
    'taskDetail.cannotCompleteUntilSubtasksDone': {
      ja: '子タスク完了まで完了ステータスにできない',
      en: 'Cannot complete until all subtasks are done',
    },
    'taskDetail.parentTaskReopensWhenSubtaskIncomplete': {
      ja: '子タスクの完了が解除されると、親タスクも作業中に変更される',
      en: 'When a subtask is marked as incomplete, the parent task will also be changed to "In Progress"',
    },
    'taskDetail.timeTracking': {
      ja: '作業予定時間入力',
      en: 'Estimated Time Input',
    },
    'taskDetail.estimatedTime': { ja: '予定時間', en: 'Estimated Time' },
    'taskDetail.hour': { ja: '時間', en: 'Hour' },
    'taskDetail.minute': { ja: '分', en: 'Minute' },
    'taskDetail.actualTime': { ja: '実績時間', en: 'Actual Time' },
    'taskDetail.cancel': { ja: 'キャンセル', en: 'Cancel' },
    'taskDetail.save': { ja: '保存', en: 'Save' },
    'taskDetail.loadingTaskInfo': {
      ja: 'タスク情報を読み込み中...',
      en: 'Loading task info...',
    },
    'taskDetail.required': { ja: '（入力必須）', en: '(Required)' },
    'taskDetail.noDescription': { ja: '説明なし', en: 'No Description' },
    'taskDetail.periodSeparator': { ja: '～', en: ' - ' },
    'taskDetail.notSet': { ja: '未設定', en: 'Not Set' },
    'taskDetail.error.projectNotFound': {
      ja: 'プロジェクトが見つかりませんでした',
      en: 'Project not found',
    },
    'taskDetail.error.taskNotFound': {
      ja: 'タスクが見つかりませんでした',
      en: 'Task not found',
    },
    'taskDetail.error.taskNameRequired': {
      ja: 'タスク名を入力してください',
      en: 'Please enter task name',
    },
    'taskDetail.error.datesRequired': {
      ja: '開始日と終了日は必須です',
      en: 'Start date and end date are required',
    },
    'taskDetail.error.startDateAfterDueDate': {
      ja: '開始日は期限日より前の日付を設定してください',
      en: 'Start date must be before due date',
    },
    'taskDetail.error.dateRangeExceeded': {
      ja: 'タスクの開始日から終了日までの期間は最長30日までです',
      en: 'The period from start date to end date must be at most 30 days',
    },
    'taskDetail.error.assigneeRequired': {
      ja: '担当者は1人以上選択してください',
      en: 'Please select at least one assignee',
    },
    'taskDetail.error.childTaskNameExists': {
      ja: 'この子タスク名は既に使用されています',
      en: 'This child task name is already in use',
    },
    'taskDetail.error.taskNameExists': {
      ja: 'このタスク名は既に使用されています',
      en: 'This task name is already in use',
    },
    'taskDetail.success.saved': {
      ja: 'タスクを保存しました',
      en: 'Task saved successfully',
    },
    'taskDetail.success.childTaskSaved': {
      ja: '子タスクを保存しました',
      en: 'Child task saved successfully',
    },
    'taskDetail.error.saveFailed': {
      ja: 'タスクの保存に失敗しました: {errorMessage}',
      en: 'Failed to save task: {errorMessage}',
    },
    'taskDetail.error.unknownError': {
      ja: '不明なエラーが発生しました',
      en: 'An unknown error occurred',
    },
    'taskDetail.deleteConfirm.message': {
      ja: 'タスク「{taskName}」を削除してもよろしいですか？この操作は元に戻せません。',
      en: 'Do you want to delete task "{taskName}"? This operation cannot be undone.',
    },
    'taskDetail.deleteConfirm.childTasksWarning': {
      ja: '注意: このタスクに紐づく{count}件の子タスクも一緒に削除されます。',
      en: 'Note: {count} child tasks associated with this task will also be deleted.',
    },
    'taskDetail.error.maxAttachmentsReached': {
      ja: 'ファイルとURLの合計は3つまでです',
      en: 'Maximum 3 attachments (files and URLs) allowed',
    },
    'taskDetail.error.fileSizeExceeded': {
      ja: '{{fileName}} は5MBを超えています。別のファイルを選択してください。',
      en: '{{fileName}} exceeds 5MB. Please select another file.',
    },
    'taskDetail.error.maxTagsReached': {
      ja: 'タグは3つまでです',
      en: 'Maximum 3 tags allowed',
    },
    'taskDetail.error.deleteFailed': {
      ja: 'タスクの削除に失敗しました',
      en: 'Failed to delete task',
    },
    'taskDetail.error.calendarSyncFailed': {
      ja: 'カレンダー連携に失敗しました: {errorMessage}',
      en: 'Calendar sync failed: {errorMessage}',
    },
    'taskDetail.error.unknownErrorOccurred': {
      ja: 'エラーが発生しました',
      en: 'An error occurred',
    },
    'taskDetail.error.maxChildTasks': {
      ja: '子タスクは最大{count}個作成できます',
      en: 'You can create up to {count} child tasks',
    },
    'taskDetail.error.childTaskCountCheckFailed': {
      ja: '子タスク数の確認に失敗しました',
      en: 'Failed to check child task count',
    },
    'taskDetail.error.detailSettingsSaveFailed': {
      ja: '詳細設定の保存に失敗しました',
      en: 'Failed to save detail settings',
    },
    'taskDetail.success.detailSettingsSaved': {
      ja: '詳細設定を保存しました',
      en: 'Detail settings saved successfully',
    },
    'taskDetail.alert.parentTaskStatusChange': {
      ja: '「親タスク：{taskName}」のステータスを作業中に変更します',
      en: 'The parent task "{taskName}" status will be changed to in progress',
    },
    'taskDetail.error.parentTaskStatusUpdateFailed': {
      ja: '親タスクのステータス更新に失敗しました',
      en: 'Failed to update parent task status',
    },
    'taskDetail.error.noChildTasksToExport': {
      ja: '出力する子タスクがありません',
      en: 'No child tasks to export',
    },
    'taskEditDialog.title': { ja: 'タスク編集', en: 'Edit Task' },
    'taskEditDialog.taskName': { ja: 'タスク名', en: 'Task Name' },
    'taskEditDialog.taskNamePlaceholder': {
      ja: 'タスク名を入力してください',
      en: 'Please enter task name',
    },
    'taskEditDialog.description': { ja: '説明', en: 'Description' },
    'taskEditDialog.descriptionPlaceholder': {
      ja: 'タスクの詳細説明を入力してください（200文字以内）',
      en: 'Enter task description (max 200 characters)',
    },
    'taskEditDialog.tags': { ja: 'タグ', en: 'Tags' },
    'taskEditDialog.tagPlaceholder': {
      ja: 'タグ名を入力してEnter（20文字以内）',
      en: 'Enter tag name and press Enter (max 20 characters)',
    },
    'taskEditDialog.removeTag': { ja: '{tag} を削除', en: 'Remove {tag}' },
    'taskEditDialog.assignee': { ja: '担当者', en: 'Assignee' },
    'taskEditDialog.noAssignee': { ja: '担当者なし', en: 'No Assignee' },
    'taskEditDialog.loadingMembers': {
      ja: 'メンバーを読み込み中...',
      en: 'Loading members...',
    },
    'taskEditDialog.noMembers': {
      ja: 'メンバーが登録されていません。先にメンバー管理画面でメンバーを登録してください。',
      en: 'No members registered. Please register members in the member management screen first.',
    },
    'taskEditDialog.status': { ja: 'ステータス', en: 'Status' },
    'taskEditDialog.priority': { ja: '優先度', en: 'Priority' },
    'taskEditDialog.startDate': { ja: '開始日', en: 'Start Date' },
    'taskEditDialog.startDatePlaceholder': {
      ja: '開始日を選択',
      en: 'Select start date',
    },
    'taskEditDialog.dueDate': { ja: '期日', en: 'Due Date' },
    'taskEditDialog.dueDatePlaceholder': {
      ja: '期日を選択',
      en: 'Select due date',
    },
    'taskEditDialog.deleteTask': { ja: 'タスク削除', en: 'Delete Task' },
    'taskEditDialog.cancel': { ja: 'キャンセル', en: 'Cancel' },
    'taskEditDialog.save': { ja: '保存', en: 'Save' },
    'taskEditDialog.saving': { ja: '保存中...', en: 'Saving...' },
    'taskEditDialog.error.membersLoadFailed': {
      ja: 'メンバーの読み込みに失敗しました',
      en: 'Failed to load members',
    },
    'taskEditDialog.error.taskNameRequired': {
      ja: 'タスク名を入力してください',
      en: 'Please enter task name',
    },
    'taskEditDialog.error.childTaskNameExists': {
      ja: 'この子タスク名は既に使用されています',
      en: 'This child task name is already in use',
    },
    'taskEditDialog.error.taskNameExists': {
      ja: 'このタスク名は既に使用されています',
      en: 'This task name is already in use',
    },
    'taskEditDialog.error.incompleteChildTask': {
      ja: '「子タスク：{taskName}」が完了していません',
      en: 'Child task "{taskName}" is not completed',
    },
    'taskEditDialog.success.updated': {
      ja: 'タスクを更新しました',
      en: 'Task updated successfully',
    },
    'taskEditDialog.error.updateFailed': {
      ja: 'タスクの更新に失敗しました',
      en: 'Failed to update task',
    },
    'taskEditDialog.success.deleted': {
      ja: 'タスク「{taskName}」を削除しました',
      en: 'Task "{taskName}" deleted successfully',
    },
    'taskEditDialog.success.deletedWithChildren': {
      ja: 'タスク「{taskName}」を削除しました（{count}件の子タスクも削除されました）',
      en: 'Task "{taskName}" deleted successfully ({count} child tasks also deleted)',
    },
    'taskEditDialog.error.deleteFailed': {
      ja: 'タスクの削除に失敗しました',
      en: 'Failed to delete task',
    },
    'taskDeleteConfirmDialog.title': {
      ja: 'タスク削除の確認',
      en: 'Confirm Task Deletion',
    },
    'taskDeleteConfirmDialog.message': {
      ja: '以下のタスクを削除しますか？',
      en: 'Do you want to delete the following task?',
    },
    'taskDeleteConfirmDialog.childTasksWarning': {
      ja: 'このタスクに紐づく{count}件の子タスクも一緒に削除されます。',
      en: '{count} child tasks associated with this task will also be deleted.',
    },
    'taskDeleteConfirmDialog.irreversibleWarning': {
      ja: 'この操作は取り消せません。タスクに関連するすべてのデータが削除されます。',
      en: 'This operation cannot be undone. All data related to this task will be deleted.',
    },
    'taskDeleteConfirmDialog.cancel': { ja: 'キャンセル', en: 'Cancel' },
    'taskDeleteConfirmDialog.delete': { ja: '削除する', en: 'Delete' },
    'taskDetail.descriptionPlaceholder': {
      ja: 'タスクの詳細説明を入力してください（200文字以内）',
      en: 'Enter task description (max 200 characters)',
    },
    'taskDetail.tagPlaceholder': {
      ja: '（20文字以内）',
      en: '(max 20 characters)',
    },
    'taskDetail.attachments': { ja: '添付ファイル', en: 'Attachments' },
    'taskDetail.attachedFiles': {
      ja: '添付済みファイル',
      en: 'Attached Files',
    },
    'taskDetail.addFile': { ja: 'ファイルを追加', en: 'Add File' },
    'taskDetail.uploadingFiles': {
      ja: 'アップロード中のファイル',
      en: 'Uploading Files',
    },
    'taskDetail.uploadingAttachments': {
      ja: '添付ファイルをアップロード中...',
      en: 'Uploading attachments...',
    },
    'taskDetail.noAttachments': {
      ja: '添付ファイルなし',
      en: 'No Attachments',
    },
    'taskDetail.removeAttachment': { ja: '削除', en: 'Remove' },
    // プロジェクト作成画面
    'projectForm.title': { ja: 'プロジェクト作成', en: 'Create Project' },
    'projectForm.editTitle': { ja: 'プロジェクト編集', en: 'Edit Project' },
    'projectForm.back': { ja: '戻る', en: 'Back' },
    'common.noSelection': { ja: '選択しない', en: 'No selection' },
    'projectForm.projectName': { ja: 'プロジェクト名', en: 'Project Name' },
    'projectForm.projectNamePlaceholder': {
      ja: '例: 新商品開発プロジェクト',
      en: 'e.g.: New Product Development Project',
    },
    'projectForm.overview': { ja: '説明', en: 'Overview' },
    'projectForm.overviewPlaceholder': {
      ja: 'プロジェクトの詳細説明を入力してください',
      en: 'Enter project details',
    },
    'projectForm.startDate': { ja: '開始日', en: 'Start Date' },
    'projectForm.startDateLabel': { ja: '年 / 月 / 日', en: 'YYYY / MM / DD' },
    'projectForm.startDatePlaceholder': {
      ja: '開始日を選択',
      en: 'Select start date',
    },
    'projectForm.startDatePlaceholderFull': {
      ja: '開始日を選択（選択必須）',
      en: 'Select start date (Selection Required)',
    },
    'projectForm.endDate': { ja: '終了日', en: 'End Date' },
    'projectForm.endDateLabel': { ja: '年 / 月 / 日', en: 'YYYY / MM / DD' },
    'projectForm.endDatePlaceholder': {
      ja: '終了日を選択',
      en: 'Select end date',
    },
    'projectForm.endDatePlaceholderFull': {
      ja: '終了日を選択（選択必須）',
      en: 'Select end date (Selection Required)',
    },
    'projectForm.responsible': { ja: '責任者', en: 'Project Owner' },
    'projectForm.loadingMembers': {
      ja: 'メンバーを読み込み中...',
      en: 'Loading members...',
    },
    'projectForm.selectResponsible': {
      ja: '責任者を選択',
      en: 'Select Project Owner',
    },
    'projectForm.noMembers': {
      ja: 'メンバーが登録されていません',
      en: 'No members registered',
    },
    'projectForm.manageMembers': {
      ja: 'メンバー管理',
      en: 'Member Management',
    },
    'projectForm.projectMembers': {
      ja: 'プロジェクトメンバー',
      en: 'Project Members',
    },
    'projectForm.selectMembers': { ja: 'メンバーを選択', en: 'Select Members' },
    'projectForm.tags': { ja: 'タグ', en: 'Tags' },
    'projectForm.tagHelper': {
      ja: 'Enterで追加 / # は自動で付きます',
      en: 'Press Enter to add / # is auto-added',
    },
    'projectForm.noTags': {
      ja: 'タグはまだ追加されていません',
      en: 'No tags added yet',
    },
    'projectForm.milestones': { ja: 'マイルストーン', en: 'Milestones' },
    'projectForm.date': { ja: '日付', en: 'Date' },
    'projectForm.milestoneDatePlaceholder': {
      ja: '日付を選択',
      en: 'Select date',
    },
    'projectForm.openCalendar': { ja: 'カレンダーを開く', en: 'Open Calendar' },
    'projectForm.milestoneNamePlaceholder': {
      ja: 'マイルストーン名（30文字以内）',
      en: 'Milestone name (max 30 characters)',
    },
    'projectForm.removeMilestone': {
      ja: 'このマイルストーンを削除',
      en: 'Remove this milestone',
    },
    'projectForm.milestoneName': {
      ja: 'マイルストーン名',
      en: 'Milestone Name',
    },
    'projectForm.addMilestone': {
      ja: 'マイルストーンを追加',
      en: 'Add Milestone',
    },
    'projectForm.maxMilestonesReached': {
      ja: 'マイルストーンは1プロジェクトあたり3つまで追加できます',
      en: 'You can add up to 3 milestones per project',
    },
    'projectForm.attachments': { ja: '資料', en: 'Attachments' },
    'projectForm.attachmentHelper': {
      ja: '1ファイル 5MB 未満・複数添付可',
      en: 'Max 5MB per file, multiple files allowed',
    },
    'projectForm.selectFile': { ja: 'ファイルを選択', en: 'Select File' },
    'projectForm.attachmentHint': {
      ja: 'PDF / 画像 / Office ファイルなど',
      en: 'PDF / Images / Office files etc.',
    },
    'projectForm.uploading': { ja: 'アップロード予定', en: 'To Upload' },
    'projectForm.attachmentName': {
      ja: '資料名（任意）',
      en: 'Attachment Name (optional)',
    },
    'projectForm.attachmentUrl': { ja: '資料URL', en: 'Attachment URL' },
    'projectForm.attachmentUrlPlaceholder': {
      ja: 'https://example.com/document.pdf',
      en: 'https://example.com/document.pdf',
    },
    'projectForm.addUrl': { ja: 'URLを追加', en: 'Add URL' },
    'projectForm.registeredAttachments': {
      ja: '登録済み（URL）',
      en: 'Registered (URL)',
    },
    'projectForm.uploadingAttachments': {
      ja: '添付ファイルをアップロード中...',
      en: 'Uploading attachments...',
    },
    'projectForm.themeColor': { ja: 'テーマ色', en: 'Theme Color' },
    'projectForm.themeColorHelper': {
      ja: 'プロジェクトやタスクのカードに反映されます',
      en: 'Applies to project and task cards',
    },
    'projectForm.noColor': { ja: 'なし', en: 'None' },
    'projectForm.required': { ja: '（入力必須）', en: '(Required)' },
    'projectForm.register': { ja: '登録', en: 'Register' },
    'projectForm.creating': { ja: '作成中...', en: 'Creating...' },
    'projectForm.maxProjectLimit': {
      ja: 'プロジェクトは最大{{count}}個作成できます',
      en: 'You can create up to {{count}} projects',
    },
    'projectForm.registerMember': {
      ja: 'でメンバーを登録してください。',
      en: ' to register members.',
    },
    'projectForm.selectResponsiblePlaceholder': {
      ja: '責任者を選択してください（複数選択可）',
      en: 'Select project owners (multiple selection)',
    },
    'projectForm.selectMembersPlaceholder': {
      ja: 'メンバーを選択してください（複数選択可）',
      en: 'Select members (multiple selection)',
    },
    'projectForm.membersSelected': {
      ja: '人選択中',
      en: ' selected',
    },
    'projectForm.cancel': { ja: 'キャンセル', en: 'Cancel' },
    'projectForm.delete': { ja: '削除', en: 'Delete' },
    'projectForm.dontSelectColor': {
      ja: '色を選択しない',
      en: "Don't select color",
    },
    'projectForm.themeColorNone': {
      ja: 'テーマ色 なし',
      en: 'Theme Color None',
    },
    'projectForm.themeColorLabel': { ja: 'テーマ色 ', en: 'Theme Color ' },
    'projectForm.projectNamePlaceholderFull': {
      ja: '例: 新商品開発プロジェクト',
      en: 'e.g.: New Product Development Project',
    },
    'projectForm.overviewPlaceholderFull': {
      ja: 'プロジェクトの詳細説明を入力してください（200文字以内）',
      en: 'Enter project details (max 200 characters)',
    },
    'projectForm.error.projectCountFetch': {
      ja: 'プロジェクト数の取得エラー',
      en: 'Error fetching project count',
    },
    'projectForm.error.membersLoad': {
      ja: 'メンバー一覧の読み込みに失敗しました',
      en: 'Failed to load members',
    },
    'projectForm.error.fileSizeExceeded': {
      ja: '{{fileName}} は5MBを超えています。別のファイルを選択してください。',
      en: '{{fileName}} exceeds 5MB. Please select another file.',
    },
    'projectForm.error.enterUrl': {
      ja: 'URLを入力してください',
      en: 'Please enter a URL',
    },
    'projectForm.error.invalidUrl': {
      ja: 'URLの形式が正しくありません',
      en: 'Invalid URL format',
    },
    'projectForm.error.urlAlreadyAdded': {
      ja: 'このURLは既に追加されています',
      en: 'This URL has already been added',
    },
    'projectForm.error.maxAttachmentsReached': {
      ja: 'ファイルとURLの合計は3つまでです',
      en: 'Maximum 3 attachments (files and URLs) allowed',
    },
    'projectForm.error.datesRequired': {
      ja: '開始日と終了日は必須です',
      en: 'Start date and end date are required',
    },
    'projectForm.error.responsibleRequired': {
      ja: '責任者は1人以上選択してください',
      en: 'Please select at least one project owner',
    },
    'projectForm.error.membersRequired': {
      ja: 'プロジェクトメンバーは1人以上選択してください',
      en: 'Please select at least one project member',
    },
    'projectForm.error.checkInput': {
      ja: '入力内容を確認してください',
      en: 'Please check your input',
    },
    'projectForm.error.projectNameExists': {
      ja: 'このプロジェクト名は既に使用されています',
      en: 'This project name is already in use',
    },
    'projectForm.error.startDateAfterEndDate': {
      ja: '開始日は終了日より前の日付を設定してください',
      en: 'Start date must be before end date',
    },
    'projectForm.success.created': {
      ja: 'プロジェクトを作成しました',
      en: 'Project created successfully',
    },
    'projectForm.error.createFailed': {
      ja: 'プロジェクトの作成に失敗しました: {{errorMessage}}',
      en: 'Failed to create project: {{errorMessage}}',
    },
    'projectForm.error.membersLoadFailed': {
      ja: 'メンバー一覧の読み込みエラー',
      en: 'Error loading members',
    },
    'projectForm.error.uploadFailed': {
      ja: '{{fileName}} のアップロードに失敗しました',
      en: '{{fileName}} failed to upload',
    },
    'projectForm.error.attachmentUploadFailed': {
      ja: '添付ファイルのアップロードに失敗しました',
      en: 'Failed to upload attachment',
    },
    'projectForm.error.required': {
      ja: '必須項目です',
      en: 'This field is required',
    },
    'projectForm.error.minLength': {
      ja: '1文字以上入力してください',
      en: 'Please enter at least 1 character',
    },
    'projectForm.error.projectNameMaxLength': {
      ja: 'プロジェクト名は30文字以内で入力してください',
      en: 'Project name must be 30 characters or less',
    },
    'projectForm.error.yearMustBe4Digits': {
      ja: '年は4桁で入力してください',
      en: 'Year must be 4 digits',
    },
    'projectForm.close': { ja: '閉じる', en: 'Close' },
    'projectForm.themeColor.pink': { ja: 'ピンク', en: 'Pink' },
    'projectForm.themeColor.peach': { ja: 'ピーチ', en: 'Peach' },
    'projectForm.themeColor.apricot': { ja: 'アプリコット', en: 'Apricot' },
    'projectForm.themeColor.yellow': { ja: 'イエロー', en: 'Yellow' },
    'projectForm.themeColor.lime': { ja: 'ライム', en: 'Lime' },
    'projectForm.themeColor.mint': { ja: 'ミント', en: 'Mint' },
    'projectForm.themeColor.blueGreen': {
      ja: 'ブルーグリーン',
      en: 'Blue Green',
    },
    'projectForm.themeColor.skyBlue': { ja: 'スカイブルー', en: 'Sky Blue' },
    'projectForm.themeColor.lavenderBlue': {
      ja: 'ラベンダーブルー',
      en: 'Lavender Blue',
    },
    'projectForm.themeColor.purple': { ja: 'パープル', en: 'Purple' },
    // タスク作成画面
    'taskCreate.title': { ja: 'タスク作成', en: 'Create Task' },
    'taskCreate.back': { ja: '戻る', en: 'Back' },
    'taskCreate.backToProject': {
      ja: 'プロジェクト詳細へ',
      en: 'To Project Details',
    },
    'taskCreate.backToParentTask': {
      ja: '親タスク詳細へ',
      en: 'To Parent Task Details',
    },
    'taskCreate.taskName': { ja: 'タスク名', en: 'Task Name' },
    'taskCreate.taskNamePlaceholder': {
      ja: 'タスク名を入力してください',
      en: 'Enter task name',
    },
    'taskCreate.subtaskNamePlaceholder': {
      ja: '子タスク名を入力してください',
      en: 'Enter subtask name',
    },
    'taskCreate.description': { ja: '説明', en: 'Description' },
    'taskCreate.startDate': { ja: '開始日', en: 'Start Date' },
    'taskCreate.startDatePlaceholder': {
      ja: '開始日を選択',
      en: 'Select start date',
    },
    'taskCreate.dueDate': { ja: '終了日', en: 'Due Date' },
    'taskCreate.dueDatePlaceholder': {
      ja: '終了日を選択',
      en: 'Select due date',
    },
    'taskCreate.assignee': { ja: '担当者', en: 'Assignee' },
    'taskCreate.status': { ja: 'ステータス', en: 'Status' },
    'taskCreate.priority': { ja: '優先度', en: 'Priority' },
    'taskCreate.tags': { ja: 'タグ', en: 'Tags' },
    'taskCreate.addTag': { ja: 'タグを追加', en: 'Add Tag' },
    'taskCreate.enterTag': {
      ja: 'タグを入力してEnter',
      en: 'Enter tag and press Enter',
    },
    'taskCreate.calendarSync': { ja: 'カレンダー連携', en: 'Calendar Sync' },
    'taskCreate.cancel': { ja: 'キャンセル', en: 'Cancel' },
    'taskCreate.createTask': { ja: 'タスクを作成', en: 'Create Task' },
    'taskCreate.saving': { ja: '保存中...', en: 'Saving...' },
    'taskCreate.resources': { ja: '資料', en: 'Resources' },
    'taskCreate.addFile': { ja: 'ファイルを追加', en: 'Add File' },
    'taskCreate.enterUrl': { ja: 'URLを入力', en: 'Enter URL' },
    'taskCreate.add': { ja: '追加', en: 'Add' },
    'taskCreate.uploadingFiles': { ja: 'アップロード中', en: 'Uploading' },
    'taskCreate.createSubtask': { ja: '子タスク作成', en: 'Create Subtask' },
    'taskCreate.subtaskName': { ja: '子タスク名', en: 'Subtask Name' },
    'taskCreate.parentTaskInfo.projectName': {
      ja: 'プロジェクト名:',
      en: 'Project Name:',
    },
    'taskCreate.parentTaskInfo.parentTaskName': {
      ja: '親タスク名:',
      en: 'Parent Task Name:',
    },
    'taskCreate.descriptionPlaceholder': {
      ja: 'タスクの詳細説明を入力してください',
      en: 'Enter task details',
    },
    'taskCreate.required': { ja: '（入力必須）', en: '(Required)' },
    'taskCreate.selectRequired': {
      ja: '（選択必須）',
      en: '(Selection Required)',
    },
    'taskCreate.noMembersInProject': {
      ja: 'プロジェクトにメンバーが登録されていません',
      en: 'No members registered in project',
    },
    'taskCreate.urlPlaceholder': {
      ja: 'https://example.com',
      en: 'https://example.com',
    },
    'taskCreate.tagMaxLength': {
      ja: '（20文字以内）',
      en: '(max 20 characters)',
    },
    'taskCreate.save': { ja: '保存', en: 'Save' },
    'taskCreate.error.taskNameRequired': {
      ja: 'タスク名を入力してください',
      en: 'Please enter task name',
    },
    'taskCreate.error.datesRequired': {
      ja: '開始日と終了日は必須です',
      en: 'Start date and end date are required',
    },
    'taskCreate.error.dateRangeExceeded': {
      ja: 'タスクの開始日から終了日までの期間は最長30日までです',
      en: 'The period from start date to end date must be at most 30 days',
    },
    'taskCreate.error.assigneeRequired': {
      ja: '担当者は1人以上選択してください',
      en: 'Please select at least one assignee',
    },
    'taskCreate.error.projectNotSpecified': {
      ja: 'プロジェクトが指定されていません',
      en: 'Project not specified',
    },
    'taskCreate.error.maxChildTasks': {
      ja: '子タスクは最大{{count}}個作成できます',
      en: 'You can create up to {{count}} child tasks',
    },
    'taskCreate.error.maxParentTasks': {
      ja: '親タスクは最大{{count}}個作成できます',
      en: 'You can create up to {{count}} parent tasks',
    },
    'taskCreate.error.taskCountCheckFailed': {
      ja: 'タスク数の確認に失敗しました',
      en: 'Failed to check task count',
    },
    'taskCreate.error.childTaskNameExists': {
      ja: 'この子タスク名は既に使用されています',
      en: 'This subtask name is already in use',
    },
    'taskCreate.error.taskNameExists': {
      ja: 'このタスク名は既に使用されています',
      en: 'This task name is already in use',
    },
    'taskCreate.error.saveFailed': {
      ja: '保存に失敗しました: {{errorMessage}}',
      en: 'Failed to save: {{errorMessage}}',
    },
    'taskCreate.error.unknownError': {
      ja: '不明なエラーが発生しました',
      en: 'An unknown error occurred',
    },
    'taskCreate.error.fileSizeExceeded': {
      ja: '{{fileName}} は5MBを超えています。別のファイルを選択してください。',
      en: '{{fileName}} exceeds 5MB. Please select another file.',
    },
    'taskCreate.error.startDateAfterDueDate': {
      ja: '開始日は期限日より前の日付を設定してください',
      en: 'Start date must be before due date',
    },
    'taskCreate.error.invalidUrl': {
      ja: 'URLはhttp://またはhttps://で始まる必要があります',
      en: 'URL must start with http:// or https://',
    },
    'taskCreate.error.maxAttachmentsReached': {
      ja: 'ファイルとURLの合計は3つまでです',
      en: 'Maximum 3 attachments (files and URLs) allowed',
    },
    'taskCreate.error.maxTagsReached': {
      ja: 'タグは3つまでです',
      en: 'Maximum 3 tags allowed',
    },
    'taskCreate.error.tagAlreadyAdded': {
      ja: 'このタグは既に追加されています',
      en: 'This tag has already been added',
    },
    'taskCreate.error.urlAlreadyAdded': {
      ja: 'このURLは既に追加されています',
      en: 'This URL has already been added',
    },
    'taskCreate.error.attachmentUploadFailed': {
      ja: '{{fileName}} のアップロードに失敗しました',
      en: 'Failed to upload {{fileName}}',
    },
    'taskCreate.error.attachmentUpdateFailed': {
      ja: 'ファイル情報の更新に失敗しましたが、タスクは作成されました',
      en: 'Failed to update file information, but the task was created',
    },
    'taskCreate.error.fileAlreadyAdded': {
      ja: '{{fileName}} は既に追加されています',
      en: '{{fileName}} has already been added',
    },
    'taskCreate.error.calendarSyncFailed': {
      ja: 'カレンダー連携に失敗しました: {{error}}',
      en: 'Calendar sync failed: {{error}}',
    },
    'taskCreate.error.taskIdNotReturned': {
      ja: 'タスクIDが取得できませんでした。タスクの作成に失敗した可能性があります。',
      en: 'Task ID could not be retrieved. Task creation may have failed.',
    },
    'taskCreate.error.parentTaskIdRequired': {
      ja: '親タスクIDが設定されていません。子タスクを作成するには親タスクが必要です。',
      en: 'Parent task ID is not set. A parent task is required to create a child task.',
    },
    'taskCreate.error.invalidStartDate': {
      ja: '開始日が無効です。有効な日付を選択してください。',
      en: 'Start date is invalid. Please select a valid date.',
    },
    'taskCreate.error.invalidDueDate': {
      ja: '期限日が無効です。有効な日付を選択してください。',
      en: 'Due date is invalid. Please select a valid date.',
    },
    'taskCreate.error.projectIdRequired': {
      ja: 'プロジェクトIDが設定されていません。タスクを作成するにはプロジェクトが必要です。',
      en: 'Project ID is not set. A project is required to create a task.',
    },
    'taskCreate.error.parentTaskFetchFailed': {
      ja: '親タスク情報の取得に失敗しました',
      en: 'Failed to fetch parent task information',
    },
    'taskCreate.close': { ja: '閉じる', en: 'Close' },
    'taskCreate.status.notStarted': { ja: '未着手', en: 'Not Started' },
    'taskCreate.status.inProgress': { ja: '作業中', en: 'In Progress' },
    'taskCreate.status.completed': { ja: '完了', en: 'Completed' },
    'taskCreate.priority.high': { ja: '高', en: 'High' },
    'taskCreate.priority.medium': { ja: '中', en: 'Medium' },
    'taskCreate.priority.low': { ja: '低', en: 'Low' },
    // タスクフォーム（ダイアログ）
    'taskForm.title': { ja: 'タスクを追加', en: 'Add Task' },
    'taskForm.projectName': { ja: 'プロジェクト名', en: 'Project Name' },
    'taskForm.parentTask': { ja: '親タスク', en: 'Parent Task' },
    'taskForm.taskName': { ja: 'タスク名', en: 'Task Name' },
    'taskForm.taskNamePlaceholder': {
      ja: '例: 要件定義書作成',
      en: 'e.g.: Create requirements document',
    },
    'taskForm.tags': { ja: 'タグ', en: 'Tags' },
    'taskForm.tagPlaceholder': {
      ja: 'タグ名を入力してEnter',
      en: 'Enter tag name',
    },
    'taskForm.status': { ja: 'ステータス', en: 'Status' },
    'taskForm.statusNotStarted': { ja: '未着手', en: 'Not Started' },
    'taskForm.statusInProgress': { ja: '作業中', en: 'In Progress' },
    'taskForm.statusCompleted': { ja: '完了', en: 'Completed' },
    'taskForm.priority': { ja: '優先度', en: 'Priority' },
    'taskForm.priorityHigh': { ja: '高', en: 'High' },
    'taskForm.priorityMedium': { ja: '中', en: 'Medium' },
    'taskForm.priorityLow': { ja: '低', en: 'Low' },
    'taskForm.calendarSync': { ja: 'カレンダー連携', en: 'Calendar Sync' },
    'taskForm.on': { ja: 'ON', en: 'ON' },
    'taskForm.off': { ja: 'OFF', en: 'OFF' },
    'taskForm.assignee': { ja: '担当者', en: 'Assignee' },
    'taskForm.selectAssignee': { ja: '担当者を選択', en: 'Select Assignee' },
    'taskForm.selectAssigneePlaceholder': {
      ja: '担当者を選択してください',
      en: 'Select an assignee',
    },
    'taskForm.loadingMembers': {
      ja: 'メンバーを読み込み中...',
      en: 'Loading members...',
    },
    'taskForm.noMembers': {
      ja: 'メンバーが登録されていません',
      en: 'No members registered',
    },
    'taskForm.noMembersDesc': {
      ja: '先にメンバー管理画面でメンバーを登録してください。',
      en: 'Please register members in the member management screen first.',
    },
    'taskForm.startDate': { ja: '開始日', en: 'Start Date' },
    'taskForm.startDatePlaceholder': {
      ja: '開始日を選択',
      en: 'Select start date',
    },
    'taskForm.dueDate': { ja: '期限', en: 'Due Date' },
    'taskForm.dueDatePlaceholder': { ja: '期限を選択', en: 'Select due date' },
    'taskForm.cancel': { ja: 'キャンセル', en: 'Cancel' },
    'taskForm.save': { ja: '保存', en: 'Save' },
    // メンバー管理画面
    'memberManagement.title': { ja: 'メンバー管理', en: 'Member Management' },
    'memberManagement.addMember': { ja: 'メンバーを追加', en: 'Add Member' },
    'memberManagement.loading': {
      ja: 'メンバーを読み込み中...',
      en: 'Loading members...',
    },
    'memberManagement.noMembers': {
      ja: 'メンバーがいません',
      en: 'No members',
    },
    'memberManagement.addFirstMember': {
      ja: '最初のメンバーを追加してください',
      en: 'Add your first member',
    },
    'memberManagement.name': { ja: '名前', en: 'Name' },
    'memberManagement.email': { ja: 'メール', en: 'Email' },
    'memberManagement.createdAt': { ja: '登録日', en: 'Registration Date' },
    'memberManagement.actions': { ja: '操作', en: 'Actions' },
    'memberManagement.edit': { ja: '編集', en: 'Edit' },
    'memberManagement.delete': { ja: '削除', en: 'Delete' },
    'memberManagement.action': { ja: 'アクション', en: 'Action' },
    'memberManagement.maxMemberLimit': {
      ja: '管理メンバーは最大{count}人登録できます',
      en: 'You can register up to {count} members',
    },
    'memberManagement.memberAdded': {
      ja: 'メンバーを追加しました',
      en: 'Member added successfully',
    },
    'memberManagement.loadFailed': {
      ja: 'メンバー一覧の読み込みに失敗しました',
      en: 'Failed to load members',
    },
    'memberManagement.memberUpdated': {
      ja: 'メンバーを更新しました',
      en: 'Member updated successfully',
    },
    'memberManagement.deleteConfirm': {
      ja: '「{name}」を削除してもよろしいですか？',
      en: 'Are you sure you want to delete "{name}"?',
    },
    'memberManagement.deleteConfirm.title': {
      ja: 'メンバーを削除',
      en: 'Delete Member',
    },
    'memberManagement.deleteConfirm.message': {
      ja: '以下のメンバーを削除しますか？',
      en: 'Do you want to delete the following member?',
    },
    'memberManagement.deleteConfirm.delete': {
      ja: '削除する',
      en: 'Delete',
    },
    'memberManagement.memberDeleted': {
      ja: 'メンバーを削除しました',
      en: 'Member deleted successfully',
    },
    'memberManagement.deleteFailed': {
      ja: 'メンバーの削除に失敗しました',
      en: 'Failed to delete member',
    },
    'memberManagement.editMember': { ja: 'メンバーを編集', en: 'Edit Member' },
    'memberManagement.namePlaceholder': {
      ja: '例: 田中太郎',
      en: 'e.g.: John Doe',
    },
    'memberManagement.emailPlaceholder': {
      ja: '例: tanaka@example.com',
      en: 'e.g.: john@example.com',
    },
    'memberManagement.cancel': { ja: 'キャンセル', en: 'Cancel' },
    'memberManagement.add': { ja: '追加', en: 'Add' },
    'memberManagement.adding': { ja: '追加中...', en: 'Adding...' },
    'memberManagement.update': { ja: '更新', en: 'Update' },
    'memberManagement.saving': { ja: '保存中...', en: 'Saving...' },
    'memberManagement.saveFailed': {
      ja: '保存に失敗しました',
      en: 'Failed to save',
    },
    'memberManagement.checkInput': {
      ja: '入力内容を確認してください',
      en: 'Please check your input',
    },
    'memberManagement.noComma': {
      ja: '名前に「,」（カンマ）は使用できません',
      en: 'Comma (,) cannot be used in name',
    },
    'memberManagement.nameExists': {
      ja: 'この名前は既に登録されています',
      en: 'This name is already registered',
    },
    'memberManagement.emailExists': {
      ja: 'このメールアドレスは既に登録されています',
      en: 'This email address is already registered',
    },
    'memberManagement.countCheckFailed': {
      ja: 'メンバー数の確認に失敗しました',
      en: 'Failed to check member count',
    },
    'memberManagement.addFailed': {
      ja: 'メンバーの追加に失敗しました',
      en: 'Failed to add member',
    },
    'memberManagement.nameRequired': {
      ja: '名前は必須です',
      en: 'Name is required',
    },
    'memberManagement.emailRequired': {
      ja: 'メールアドレスは必須です',
      en: 'Email address is required',
    },
    'memberManagement.validEmail': {
      ja: '有効なメールアドレスを入力してください',
      en: 'Please enter a valid email address',
    },
    'memberManagement.minLength': {
      ja: '1文字以上入力してください',
      en: 'Please enter at least 1 character',
    },
    'memberManagement.nameMaxLength': {
      ja: '名前は20文字以内で入力してください',
      en: 'Name must be 20 characters or less',
    },
    'memberManagement.emailMaxLength': {
      ja: 'メールアドレスは254文字以内で入力してください',
      en: 'Email address must be 254 characters or less',
    },
    'memberManagement.close': { ja: '閉じる', en: 'Close' },
    // 設定画面（追加）
    'settings.roomEnterRequired': {
      ja: 'ルームに入室してください',
      en: 'Please enter a room',
    },
    'settings.loadFailed': {
      ja: '設定の読み込みに失敗しました: {error}',
      en: 'Failed to load settings: {error}',
    },
    'settings.emailRequired': {
      ja: 'メールアドレスを入力してください',
      en: 'Please enter email address',
    },
    'settings.validEmailRequired': {
      ja: '有効なメールアドレスを入力してください',
      en: 'Please enter a valid email address',
    },
    'settings.testNotificationSent': {
      ja: 'テスト通知を送信しました ✅',
      en: 'Test notification sent ✅',
    },
    'settings.testNotificationFailed': {
      ja: 'テスト通知の送信に失敗しました',
      en: 'Failed to send test notification',
    },
    'settings.testNotificationFailedWithError': {
      ja: 'テスト通知の送信に失敗しました: {error}',
      en: 'Failed to send test notification: {error}',
    },
    'settings.enableEmailNotification': {
      ja: 'メール通知を有効にしてください',
      en: 'Please enable email notifications',
    },
    'settings.deadlineNotificationSent': {
      ja: '期限が近いタスクのメール通知を送信しました ({taskCount}件のタスク、{userCount}人のユーザー)',
      en: 'Deadline notification sent ({taskCount} tasks, {userCount} users)',
    },
    'settings.emailNotificationFailed': {
      ja: 'メール通知の送信に失敗しました',
      en: 'Failed to send email notification',
    },
    'settings.deadlineTestCompleted': {
      ja: 'タスク期限通知のテスト実行が完了しました\n成功: {successCount}件、スキップ: {skippedCount}件、エラー: {errorCount}件\n対象タスク: {taskCount}件\n詳細はコンソールを確認してください',
      en: 'Task deadline notification test completed\nSuccess: {successCount}, Skipped: {skippedCount}, Errors: {errorCount}\nTarget tasks: {taskCount}\nSee console for details',
    },
    'settings.deadlineTestFailed': {
      ja: 'タスク期限通知のテスト実行に失敗しました',
      en: 'Task deadline notification test failed',
    },
    'settings.error': { ja: 'エラー: {error}', en: 'Error: {error}' },
    'settings.workTimeTestCompleted': {
      ja: '作業時間オーバー通知のテスト実行が完了しました\n成功: {successCount}件、スキップ: {skippedCount}件、エラー: {errorCount}件\n作業時間オーバーユーザー: {overflowUserCount}人\n送信通知数: {notificationCount}件\n詳細はコンソールを確認してください',
      en: 'Work time overflow notification test completed\nSuccess: {successCount}, Skipped: {skippedCount}, Errors: {errorCount}\nOverflow users: {overflowUserCount}\nNotifications sent: {notificationCount}\nSee console for details',
    },
    'settings.workTimeTestFailed': {
      ja: '作業時間オーバー通知のテスト実行に失敗しました',
      en: 'Work time overflow notification test failed',
    },
    'settings.dailyTestCompleted': {
      ja: '今日のタスク通知のテスト実行が完了しました\n成功: {successCount}件、スキップ: {skippedCount}件、エラー: {errorCount}件\n通知タスク数: {taskCount}件\n詳細はコンソールを確認してください',
      en: "Today's task notification test completed\nSuccess: {successCount}, Skipped: {skippedCount}, Errors: {errorCount}\nNotification tasks: {taskCount}\nSee console for details",
    },
    'settings.dailyTestFailed': {
      ja: '今日のタスク通知のテスト実行に失敗しました',
      en: "Today's task notification test failed",
    },
    'settings.userNotificationSent': {
      ja: 'ユーザー個別のタスク通知を送信しました ({taskCount}件のタスク、{userCount}人のユーザー)',
      en: 'User-specific task notification sent ({taskCount} tasks, {userCount} users)',
    },
    'settings.userNotificationFailed': {
      ja: 'ユーザー個別のタスク通知の送信に失敗しました',
      en: 'Failed to send user-specific task notification',
    },
    'settings.homeScreenSaved': {
      ja: 'ホーム画面設定を保存しました',
      en: 'Home screen settings saved',
    },
    'settings.homeScreenSaveFailed': {
      ja: 'ホーム画面設定の保存に失敗しました',
      en: 'Failed to save home screen settings',
    },
    'settings.changeRoom': { ja: 'ルームを変更', en: 'Change Room' },
    'settings.deleteRoom': { ja: 'ルームを削除', en: 'Delete Room' },
    'settings.roomIdNotAvailable': {
      ja: 'ルームIDが取得できませんでした',
      en: 'Could not get room ID',
    },
    'settings.roomDeleted': {
      ja: 'ルームを削除しました',
      en: 'Room deleted successfully',
    },
    'settings.roomDeleteFailed': {
      ja: 'ルームの削除に失敗しました',
      en: 'Failed to delete room',
    },
    'settings.quietHoursTimeSameError': {
      ja: '開始時間と終了時間を同じにすることはできません',
      en: 'Start time and end time cannot be the same',
    },
    'settings.deleteRoomTitle': { ja: 'ルームを削除', en: 'Delete Room' },
    'settings.deleteRoomConfirm': {
      ja: '本当にルーム「{roomName}」を削除しますか？',
      en: 'Are you sure you want to delete room "{roomName}"?',
    },
    'settings.deleteRoomWarning': {
      ja: 'この操作は取り消せません。ルームに関連するすべてのデータ（プロジェクト、タスク、メンバーなど）が削除されます。',
      en: 'This operation cannot be undone. All data related to the room (projects, tasks, members, etc.) will be deleted.',
    },
    'settings.cancel': { ja: 'キャンセル', en: 'Cancel' },
    'settings.delete': { ja: '削除', en: 'Delete' },
    // 編集ログ画面
    'logs.title': { ja: '編集ログ', en: 'Edit Logs' },
    'logs.csvExport': { ja: 'CSV出力', en: 'Export CSV' },
    'logs.filterProject': { ja: 'プロジェクト', en: 'Project' },
    'logs.filterTask': { ja: 'タスク', en: 'Task' },
    'logs.filterMember': { ja: 'メンバー', en: 'Member' },
    'logs.timestamp': { ja: '日時', en: 'Timestamp' },
    'logs.operation': { ja: '操作', en: 'Operation' },
    'logs.details': { ja: '詳細', en: 'Details' },
    'logs.loading': { ja: 'ログを読み込み中...', en: 'Loading logs...' },
    'logs.noLogs': { ja: 'ログがありません', en: 'No logs' },
    'logs.reset': { ja: 'リセット', en: 'Reset' },
    'logs.loadingText': { ja: '読み込み中...', en: 'Loading...' },
    'logs.project': { ja: 'プロジェクト:', en: 'Project: ' },
    'logs.task': { ja: 'タスク:', en: 'Task: ' },
    'logs.changeDescription': { ja: '変更内容:', en: 'Change Description: ' },
    'logs.noEditLogs': { ja: '編集ログがありません', en: 'No edit logs' },
    'logs.loadMore': { ja: 'さらに読み込む', en: 'Load More' },
    'logs.period': { ja: '期間', en: 'Period' },
    'logs.after': { ja: '以降', en: 'after' },
    'logs.before': { ja: '以前', en: 'before' },
    'logs.taskUpdated': { ja: 'タスクを更新しました', en: 'Task updated' },
    'logs.projectUpdated': {
      ja: 'プロジェクトを更新しました',
      en: 'Project updated',
    },
    'logs.taskCreated': { ja: 'タスクを作成しました', en: 'Task created' },
    'logs.projectCreated': {
      ja: 'プロジェクトを作成しました',
      en: 'Project created',
    },
    'logs.taskDeleted': { ja: 'タスクを削除しました', en: 'Task deleted' },
    'logs.projectDeleted': {
      ja: 'プロジェクトを削除しました',
      en: 'Project deleted',
    },
    'logs.message.projectCreatedWithName': {
      ja: 'プロジェクト「{projectName}」を作成しました',
      en: 'Project "{projectName}" created',
    },
    'logs.message.projectDeletedWithName': {
      ja: 'プロジェクト「{projectName}」を削除しました',
      en: 'Project "{projectName}" deleted',
    },
    'logs.message.taskCreatedWithName': {
      ja: 'タスク「{taskName}」を作成しました',
      en: 'Task "{taskName}" created',
    },
    'logs.message.taskDeletedWithName': {
      ja: 'タスク「{taskName}」を削除しました',
      en: 'Task "{taskName}" deleted',
    },
    'logs.added': { ja: 'が追加', en: ' added' },
    'logs.deleted': { ja: 'が削除', en: ' deleted' },
    'logs.themeColor': { ja: 'テーマ色', en: 'Theme Color' },
    'logs.none': { ja: 'なし', en: 'None' },
    'logs.projectFallback': { ja: 'プロジェクト', en: 'Project' },
    'logs.action.create': { ja: '新規作成', en: 'Create' },
    'logs.action.update': { ja: '更新', en: 'Update' },
    'logs.action.delete': { ja: '削除', en: 'Delete' },
    'logs.field.projectName': { ja: 'プロジェクト名', en: 'Project Name' },
    'logs.field.overview': { ja: '説明', en: 'Overview' },
    'logs.field.startDate': { ja: '開始日', en: 'Start Date' },
    'logs.field.endDate': { ja: '終了日', en: 'End Date' },
    'logs.field.themeColor': { ja: 'テーマ色', en: 'Theme Color' },
    'logs.field.attachments': { ja: '資料', en: 'Attachments' },
    'logs.field.responsible': { ja: '責任者', en: 'Responsible' },
    'logs.field.status': { ja: 'ステータス', en: 'Status' },
    'logs.field.priority': { ja: '優先度', en: 'Priority' },
    'logs.field.assignee': { ja: '担当者', en: 'Assignee' },
    'logs.field.dueDate': { ja: '終了日', en: 'Due Date' },
    'logs.field.taskName': { ja: 'タスク名', en: 'Task Name' },
    'logs.field.description': { ja: '概要', en: 'Description' },
    'logs.field.tags': { ja: 'タグ', en: 'Tags' },
    'logs.field.members': { ja: 'メンバー', en: 'Members' },
    'logs.field.milestone': { ja: 'マイルストーン', en: 'Milestone' },
    'logs.field.calendarSync': { ja: 'カレンダー連携', en: 'Calendar Sync' },
    'logs.field.notificationSettings': {
      ja: '通知対象設定',
      en: 'Notification Settings',
    },
    'logs.field.taskOrderManagement': {
      ja: 'タスクの順番管理',
      en: 'Task Order Management',
    },
    'logs.field.estimatedWorkTime': {
      ja: '作業予定時間入力',
      en: 'Estimated Work Time',
    },
    'logs.status.unknown': { ja: '不明', en: 'Unknown' },
    'logs.status.notSet': { ja: '変更なし', en: 'Not Set' },
    'logs.message.taskUpdatedWithName': {
      ja: 'タスク「{taskName}」を更新しました',
      en: 'Task "{taskName}" updated',
    },
    'logs.message.statusChanged': {
      ja: 'タスクのステータスを「{oldStatus}」→「{newStatus}」に変更しました',
      en: 'Task status changed from "{oldStatus}" to "{newStatus}"',
    },
    'logs.message.tagAdded': { ja: '{tag}が追加されました', en: '{tag} added' },
    'logs.message.tagDeleted': {
      ja: '{tag}が削除されました',
      en: '{tag} deleted',
    },
    // ルーム情報（設定画面）
    'settings.roomInfo.title': { ja: 'ルーム情報', en: 'Room Information' },
    'settings.roomInfo.subtitle': {
      ja: 'このルームの情報を表示します',
      en: 'Display information for this room',
    },
    'settings.roomInfo.roomName': { ja: 'ルーム名', en: 'Room Name' },
    'settings.roomInfo.roomId': { ja: 'ルームID', en: 'Room ID' },
    'settings.roomInfo.password': { ja: 'パスワード', en: 'Password' },
    'settings.roomInfo.copy': { ja: 'コピー', en: 'Copy' },
    // タスク検索画面
    'taskSearch.title': { ja: 'タスク検索', en: 'Task Search' },
    'taskSearch.description': {
      ja: 'アプリ内のタスクを検索できます',
      en: 'Search for tasks in the app',
    },
    'taskSearch.filters': { ja: '検索条件', en: 'Search Filters' },
    'taskSearch.assignee': { ja: '担当者', en: 'Assignee' },
    'taskSearch.priority': { ja: '優先度', en: 'Priority' },
    'taskSearch.status': { ja: 'ステータス', en: 'Status' },
    'taskSearch.tags': { ja: 'タグ', en: 'Tags' },
    'taskSearch.noTags': { ja: 'タグがありません', en: 'No tags available' },
    'taskSearch.noTagsHint': {
      ja: 'ルーム内にタグが設定されたタスクがありません',
      en: 'No tasks with tags found in the room',
    },
    'taskSearch.freeWord': { ja: 'フリーワード', en: 'Free Word' },
    'taskSearch.freeWordPlaceholder': { ja: 'フリーワード', en: 'Free word' },
    'taskSearch.searching': { ja: '検索中...', en: 'Searching...' },
    'taskSearch.search': { ja: '検索', en: 'Search' },
    'taskSearch.clear': { ja: 'クリア', en: 'Clear' },
    'taskSearch.results': { ja: '検索結果', en: 'Search Results' },
    'taskSearch.resultsCount': {
      ja: '件のタスクが見つかりました',
      en: 'tasks found',
    },
    'taskSearch.noResults': {
      ja: '検索結果が見つかりません',
      en: 'No search results found',
    },
    'taskSearch.noResultsDesc': {
      ja: '検索条件を変更して再度検索してください。',
      en: 'Please modify your search criteria and try again.',
    },
    'taskSearch.project': { ja: 'プロジェクト：', en: 'Project: ' },
    'taskSearch.parentTask': { ja: '親タスク：', en: 'Parent Task: ' },
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
