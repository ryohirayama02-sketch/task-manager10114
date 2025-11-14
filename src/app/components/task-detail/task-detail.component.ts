import { Component, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { ProjectService } from '../../services/project.service';
import { TaskService } from '../../services/task.service';
import { MemberManagementService } from '../../services/member-management.service';
import { CalendarService } from '../../services/calendar.service';
import { TaskAttachmentService } from '../../services/task-attachment.service';
import { NavigationHistoryService } from '../../services/navigation-history.service';
import {
  Task,
  Project,
  ChatMessage,
  TaskAttachment,
} from '../../models/task.model';
import { Member } from '../../models/member.model';
import { ProjectChatComponent } from '../project-chat/project-chat.component';
import {
  DEFAULT_PROJECT_THEME_COLOR,
  resolveProjectThemeColor,
} from '../../constants/project-theme-colors';

import { TranslatePipe } from '../../pipes/translate.pipe';
import {
  getMemberNamesAsString,
  getMemberNames,
} from '../../utils/member-utils';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatIconModule,
    MatTabsModule,
    MatExpansionModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatDatepickerModule,
    MatNativeDateModule,
    ProjectChatComponent,
    TranslatePipe,
  ],
  templateUrl: './task-detail.component.html',
  styleUrl: './task-detail.component.css',
})
export class TaskDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private taskService = inject(TaskService);
  private memberService = inject(MemberManagementService);
  private location = inject(Location);
  private auth = inject(Auth);
  private calendarService = inject(CalendarService);
  private snackBar = inject(MatSnackBar);
  private attachmentService = inject(TaskAttachmentService);
  private navigationHistory = inject(NavigationHistoryService);
  private firestore = inject(Firestore);
  private languageService = inject(LanguageService);

  @Output() taskUpdated = new EventEmitter<any>();

  task: Task | null = null;
  project: Project | null = null;
  isEditing = false;
  isDetailSettingsOpen = false;
  isLoading = true;
  isSaving = false;
  isCalendarSyncSaving = false;
  private originalTaskSnapshot: Task | null = null; // 編集モードON時のタスクのスナップショット

  // メンバー関連
  members: Member[] = [];
  selectedMemberId: string = '';
  membersLoading = false;
  notificationRecipientOptions: string[] = [];
  childTasks: Task[] = [];
  filteredChildTasks: Task[] = [];
  childFilterStatus: string[] = [];
  childFilterPriority: string[] = [];
  childFilterAssignee: string[] = [];
  childFilterDueDateObj: Date | null = null; // Material date picker用（子タスクフィルター）
  childFilterDueDate = ''; // デフォルトは選択無し
  childAssigneeOptions: string[] = [];
  projectThemeColor = DEFAULT_PROJECT_THEME_COLOR;
  taskStartDateObj: Date | null = null; // Material date picker用（編集モードの開始日）
  taskDueDateObj: Date | null = null; // Material date picker用（編集モードの終了日）
  minDate: Date; // 当月から3か月前の1日
  maxDate: Date; // 当月から3か月後の月末日
  maxTaskDueDate: Date | null = null; // 開始日から30日後の日付
  parentTaskName: string | null = null;
  projectMembers: Member[] = [];
  selectedAssignedMemberIds: string[] = [];
  private isReopeningParentTask = false; // 親タスクを再オープン中かどうかのフラグ

  constructor() {
    // 日付選択範囲を設定（当月±3か月）
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // 3か月前の1日
    const minDate = new Date(currentYear, currentMonth - 3, 1);
    this.minDate = minDate;

    // 3か月後の月末日
    const maxDate = new Date(currentYear, currentMonth + 4, 0); // 翌月の0日 = 今月の月末
    this.maxDate = maxDate;
  }

  // 添付ファイル関連
  editableAttachments: TaskAttachment[] = [];
  pendingFiles: { id: string; file: File }[] = [];
  attachmentsToRemove: TaskAttachment[] = [];
  isUploading = false;
  readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
  readonly fileAccept =
    '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.bmp,.heic,.webp,.svg,.txt,.csv,.zip';

  // URL入力
  newUrlInput: string = '';

  // タスクの基本情報
  taskData: Task = {
    projectId: '',
    projectName: '',
    taskName: '',
    description: '',
    startDate: '',
    dueDate: '',
    assignee: '',
    status: '未着手',
    priority: '中',
    calendarSyncEnabled: false,
    tags: [],
    relatedFiles: [],
    urls: [],
  };

  // 詳細設定
  detailSettings = this.createDefaultDetailSettings();
  // 作業予定時間入力用の時間オプション（0〜49時間）
  hourOptions = Array.from({ length: 50 }, (_, i) => ({
    value: i.toString().padStart(2, '0'),
    label: i.toString().padStart(2, '0'),
  }));
  minuteOptions = Array.from({ length: 60 }, (_, i) => ({
    value: i.toString().padStart(2, '0'),
    label: i.toString().padStart(2, '0'),
  }));
  estimatedHours = { hour: '00', minute: '00' };

  // ステータスと優先度のオプション
  statusOptions = ['未着手', '作業中', '完了'];
  priorityOptions = ['高', '中', '低'];

  // ステータスの表示テキストを取得（タスクカード用：英語時は短縮形）
  getStatusDisplay(status: string, short: boolean = false): string {
    const currentLanguage = this.languageService.getCurrentLanguage();
    const useShort = short && currentLanguage === 'en';

    const statusMap: Record<string, string> = {
      未着手: useShort
        ? this.languageService.translate('taskDetail.status.notStarted.short')
        : this.languageService.translate('taskDetail.status.notStarted'),
      作業中: useShort
        ? this.languageService.translate('taskDetail.status.inProgress.short')
        : this.languageService.translate('taskDetail.status.inProgress'),
      完了: useShort
        ? this.languageService.translate('taskDetail.status.completed.short')
        : this.languageService.translate('taskDetail.status.completed'),
    };
    return statusMap[status] || status;
  }

  // 優先度の表示テキストを取得（タスクカード用：英語時は短縮形）
  getPriorityDisplay(priority: string, short: boolean = false): string {
    const currentLanguage = this.languageService.getCurrentLanguage();
    const useShort = short && currentLanguage === 'en';

    const priorityMap: Record<string, string> = {
      高: useShort
        ? this.languageService.translate('taskDetail.priority.high.short')
        : this.languageService.translate('taskDetail.priority.high'),
      中: useShort
        ? this.languageService.translate('taskDetail.priority.medium.short')
        : this.languageService.translate('taskDetail.priority.medium'),
      低: useShort
        ? this.languageService.translate('taskDetail.priority.low.short')
        : this.languageService.translate('taskDetail.priority.low'),
    };
    return priorityMap[priority] || priority;
  }

  // 期間表示用の日付フォーマット
  formatDateForDisplay(date: string | null | undefined): string {
    if (!date) {
      return this.languageService.translate('taskDetail.notSet');
    }
    const currentLanguage = this.languageService.getCurrentLanguage();
    const locale = currentLanguage === 'en' ? 'en-US' : 'ja-JP';
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  ngOnInit() {
    // パラメータとクエリパラメータの両方を監視して、再読み込みを確実にする
    // パラメータとクエリパラメータの両方を監視
    this.route.paramMap.subscribe((params) => {
      const taskId = params.get('taskId');
      const projectId = params.get('projectId');

      console.log('[ngOnInit] ルートパラメータ変更:', { taskId, projectId });

      if (taskId && projectId) {
        // タスクが切り替わったときは編集モードをリセット
        this.isEditing = false;
        this.originalTaskSnapshot = null;
        this.isLoading = true;
        this.childTasks = [];
        this.filteredChildTasks = [];
        this.loadTaskDetails(projectId, taskId);
        this.loadMembers();
      } else {
        console.error('必要なパラメータが不足しています:', {
          taskId,
          projectId,
        });
      }
    });

    // クエリパラメータの変更も監視（子タスク作成後の再読み込み用）
    this.route.queryParamMap.subscribe((queryParams) => {
      const refresh = queryParams.get('refresh');
      const taskId = this.route.snapshot.paramMap.get('taskId');
      const projectId = this.route.snapshot.paramMap.get('projectId');

      console.log('[ngOnInit] クエリパラメータ変更:', {
        refresh,
        taskId,
        projectId,
        allQueryParams: Object.fromEntries(
          queryParams.keys.map((key) => [key, queryParams.get(key)])
        ),
      });

      if (refresh && taskId && projectId) {
        console.log('[ngOnInit] クエリパラメータによる再読み込み実行:', {
          refresh,
          taskId,
          projectId,
        });
        // 少し待機してから再読み込み（Firestoreの同期を待つ）
        setTimeout(() => {
          // タスクが切り替わったときは編集モードをリセット
          this.isEditing = false;
          this.originalTaskSnapshot = null;
          this.isLoading = true;
          this.childTasks = [];
          this.filteredChildTasks = [];
          this.loadTaskDetails(projectId, taskId);
        }, 300);
      }
    });
  }

  /** タスク詳細を読み込み */
  loadTaskDetails(projectId: string, taskId: string) {
    console.log('タスク詳細を読み込み中...', { projectId, taskId });
    // タスクが切り替わったときは編集モードをリセット
    this.isEditing = false;
    this.originalTaskSnapshot = null;
    this.parentTaskName = null;

    // プロジェクト情報とタスク情報を並行して取得
    this.projectService.getProjectById(projectId).subscribe((project) => {
      console.log('プロジェクト情報:', project);
      if (!project) {
        // プロジェクトが見つからない場合はメッセージを表示しない
        this.router.navigate(['/projects']);
        return;
      }
      this.project = project;
      this.projectThemeColor = resolveProjectThemeColor(project);
      // プロジェクト名を最新の情報で更新
      if (this.taskData) {
        this.taskData.projectName = project.projectName;
      }
      // プロジェクトメンバーを読み込み
      this.loadProjectMembers(projectId);
    });

    // タスク情報を取得
    this.projectService.getTasksByProjectId(projectId).subscribe({
      next: (tasks) => {
        console.log('取得したタスク一覧:', tasks);
        // タスクデータにprojectIdを追加
        const tasksWithProjectId = tasks.map((task) => ({
          ...task,
          projectId: projectId,
        }));
        this.task =
          tasksWithProjectId.find((t): t is Task => t.id === taskId) || null;
        console.log('見つかったタスク:', this.task);

        if (this.task) {
          // プロジェクト名はプロジェクトオブジェクトから取得（最新の情報を優先）
          const currentProjectName =
            this.project?.projectName || this.task.projectName || '';
          this.taskData = {
            projectId: this.task.projectId || projectId,
            projectName: currentProjectName,
            taskName: this.task.taskName || '',
            description: this.task.description || '',
            startDate: this.task.startDate || '',
            dueDate: this.task.dueDate || '',
            assignee: this.task.assignee || '',
            status: this.task.status || '未着手',
            priority: this.task.priority || '中',
            calendarSyncEnabled: this.task.calendarSyncEnabled ?? false,
            tags: this.task.tags || [],
            relatedFiles: this.task.relatedFiles || [],
            assignedMembers: Array.isArray(this.task.assignedMembers)
              ? [...this.task.assignedMembers]
              : this.task.assignedMembers
              ? [this.task.assignedMembers]
              : [],
            urls: this.task.urls || [],
          };

          console.log('タスクデータ設定:', {
            taskId: this.task.id,
            assignee: this.task.assignee,
            assignedMembers: this.task.assignedMembers,
            taskDataAssignedMembers: this.taskData.assignedMembers,
          });

          // 添付ファイルを初期化
          this.editableAttachments = (this.task.attachments || []).map(
            (attachment) => ({ ...attachment })
          );
          this.initializeDetailSettings((this.task as any).detailSettings);
          this.setupChildTasks(tasksWithProjectId, taskId);
          if (this.task.parentTaskId) {
            const parent = tasksWithProjectId.find(
              (candidate) => candidate.id === this.task?.parentTaskId
            );
            this.parentTaskName = parent?.taskName || null;
          } else {
            this.parentTaskName = null;
          }
          console.log('設定されたタスクデータ:', this.taskData);
        } else {
          console.error('タスクが見つかりませんでした');
          console.log(
            '利用可能なタスクID:',
            tasks.map((t) => t.id)
          );
          console.log('検索対象のタスクID:', taskId);
          this.childTasks = [];
          this.filteredChildTasks = [];
          this.parentTaskName = null;
          this.editableAttachments = [];
          // タスクが見つからない場合はメッセージを表示しない
          this.router.navigate(['/projects']);
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('タスク取得エラー:', error);
        this.childTasks = [];
        this.filteredChildTasks = [];
        this.isLoading = false;
      },
    });
  }

  /** メンバー一覧を読み込み */
  loadMembers(): void {
    this.membersLoading = true;
    this.memberService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
        this.membersLoading = false;
        console.log('メンバー一覧を読み込みました:', members.length, '件');

        // 現在の担当者に基づいてselectedMemberIdを設定
        if (this.taskData.assignee) {
          const member = members.find((m) => m.name === this.taskData.assignee);
          if (member) {
            this.selectedMemberId = member.id || '';
          }
        }
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
        this.membersLoading = false;
      },
    });
  }

  /** 担当者選択の変更 */
  onMemberSelectionChange(memberId: string): void {
    console.log('担当者選択変更:', memberId);

    if (!memberId) {
      this.taskData.assignee = '';
      this.taskData.assigneeEmail = '';
      return;
    }

    const selectedMember = this.members.find(
      (member) => member.id === memberId
    );

    if (selectedMember) {
      this.taskData.assignee = selectedMember.name;
      this.taskData.assigneeEmail = selectedMember.email;
      console.log('選択された担当者:', selectedMember);
    } else {
      console.warn('メンバーが見つかりません:', memberId);
      this.taskData.assignee = '';
      this.taskData.assigneeEmail = '';
    }
  }

  /** プロジェクトメンバーを読み込み（プロジェクトのメンバーのみ） */
  private loadProjectMembers(projectId: string): void {
    this.membersLoading = true;
    this.memberService.getMembers().subscribe({
      next: (members) => {
        // プロジェクト情報を取得して、プロジェクトのメンバーのみをフィルタリング
        this.projectService.getProjectById(projectId).subscribe({
          next: (project) => {
            if (project?.members && project.members.trim().length > 0) {
              // プロジェクトのmembersフィールドはメンバー名のカンマ区切り文字列
              const projectMemberNames = project.members
                .split(',')
                .map((name) => name.trim())
                .filter((name) => name.length > 0);

              // プロジェクトのメンバー名に一致するメンバーのみをフィルタリング
              this.projectMembers = members.filter((member) =>
                projectMemberNames.includes(member.name || '')
              );
            } else {
              // プロジェクトのメンバーが設定されていない場合は全メンバーを表示
              this.projectMembers = members;
            }

            this.membersLoading = false;
            console.log(
              'プロジェクトメンバーを読み込みました:',
              this.projectMembers.length,
              '件（全メンバー:',
              members.length,
              '件）'
            );

            // 編集モードがONの場合は、担当者を初期化
            if (this.isEditing) {
              console.log('編集モードON中なので、担当者を初期化します');
              this.initializeAssigneeForEdit();
            } else {
              // 読み取りモードの場合も、assignedMembers を selectedAssignedMemberIds に反映
              if (
                this.task?.assignedMembers &&
                this.task.assignedMembers.length > 0
              ) {
                this.selectedAssignedMemberIds = [...this.task.assignedMembers];
              } else if (
                this.taskData.assignedMembers &&
                this.taskData.assignedMembers.length > 0
              ) {
                this.selectedAssignedMemberIds = [
                  ...this.taskData.assignedMembers,
                ];
              }
            }
          },
          error: (error) => {
            console.error('プロジェクト情報の取得エラー:', error);
            // エラー時は全メンバーを表示
            this.projectMembers = members;
            this.membersLoading = false;
          },
        });
      },
      error: (error) => {
        console.error('プロジェクトメンバーの読み込みエラー:', error);
        this.membersLoading = false;
      },
    });
  }

  /** 複数メンバー選択の変更 */
  onAssignedMembersChange(selectedIds: string[]): void {
    console.log('割り当てメンバー選択変更:', selectedIds);
    this.selectedAssignedMemberIds = selectedIds || [];
    this.taskData.assignedMembers = selectedIds || [];

    // 最初のメンバーを assignee に設定（後方互換性のため）
    if (selectedIds && selectedIds.length > 0) {
      const firstMember = this.projectMembers.find(
        (m) => m.id === selectedIds[0]
      );
      if (firstMember) {
        this.taskData.assignee = firstMember.name;
        this.taskData.assigneeEmail = firstMember.email;
      }
    } else {
      this.taskData.assignee = '';
      this.taskData.assigneeEmail = '';
    }
  }

  getMemberNameById(memberId: string): string {
    // まずprojectMembersから検索
    let member = this.projectMembers.find((m) => m.id === memberId);
    // 見つからない場合は全メンバーから検索
    if (!member) {
      member = this.members.find((m) => m.id === memberId);
    }
    // メンバーが見つかった場合は名前を返す、見つからない場合は「（不明）」を返す
    return member ? member.name : '（不明）';
  }

  /**
   * メンバー名から最新のメンバー名を取得（メンバー名が更新された場合に対応）
   * メンバー管理画面に存在しない名前の場合は空文字列を返す
   */
  getCurrentMemberNameByName(memberName: string | null | undefined): string {
    if (!memberName) {
      return '—';
    }

    // まずメールアドレスで検索（より確実）
    if (this.taskData.assigneeEmail) {
      const memberByEmail =
        this.projectMembers.find(
          (m) => m.email === this.taskData.assigneeEmail
        ) || this.members.find((m) => m.email === this.taskData.assigneeEmail);
      if (memberByEmail && memberByEmail.name) {
        return memberByEmail.name;
      }
    }

    // メールアドレスで見つからない場合、メンバー名で検索
    const member =
      this.projectMembers.find((m) => m.name === memberName) ||
      this.members.find((m) => m.name === memberName);

    if (member && member.name) {
      return member.name;
    }

    // 見つからない場合は、メンバー管理画面に存在しない名前なので空文字列を返す
    return '';
  }

  /** 担当者をカンマ区切りで表示 */
  getAssignedMembersDisplay(): string {
    if (
      !this.taskData.assignedMembers ||
      this.taskData.assignedMembers.length === 0
    ) {
      const name = this.getCurrentMemberNameByName(this.taskData.assignee);
      return name || '—';
    }

    const display = getMemberNamesAsString(
      this.taskData.assignedMembers,
      this.projectMembers,
      ', ',
      this.languageService
    );

    // '未設定' の場合は '—' に変換
    const notSetText = this.languageService.translate('common.notSet');
    return display === notSetText ? '—' : display;
  }

  /** 編集モードを切り替え */
  toggleEdit() {
    if (this.isEditing) {
      // 編集中から読み取りモードへ
      if (!this.canSaveTask()) {
        return;
      }
      // 変更がない場合は保存処理をスキップ
      if (!this.hasTaskChanges()) {
        this.isEditing = false;
        this.originalTaskSnapshot = null; // スナップショットをクリア
        return;
      }
      // originalTaskSnapshotを保存（saveTask()で使用するため、nullに設定される前に保持）
      const snapshotToUse = this.originalTaskSnapshot
        ? {
            ...this.originalTaskSnapshot,
            tags: this.originalTaskSnapshot.tags
              ? [...this.originalTaskSnapshot.tags]
              : [],
          }
        : null;
      this.saveTask(snapshotToUse);
      // 保存後にスナップショットをクリア
      this.originalTaskSnapshot = null;
    } else {
      // 読み取りモードから編集中へ
      this.isEditing = true;
      // Dateオブジェクトを初期化
      this.taskStartDateObj = this.taskData.startDate
        ? new Date(this.taskData.startDate)
        : null;
      this.taskDueDateObj = this.taskData.dueDate
        ? new Date(this.taskData.dueDate)
        : null;

      // 開始日から30日後の日付を計算
      if (this.taskStartDateObj) {
        const maxDueDate = new Date(this.taskStartDateObj);
        maxDueDate.setDate(maxDueDate.getDate() + 30);
        this.maxTaskDueDate = maxDueDate;
      } else {
        this.maxTaskDueDate = null;
      }

      // 編集モードON時にタスクのスナップショットを保持（リアルタイム更新でthis.taskが変更される前に）
      if (this.task) {
        // 深いコピーを作成（tagsは特に重要）
        const tagsCopy =
          this.task.tags && Array.isArray(this.task.tags)
            ? JSON.parse(JSON.stringify(this.task.tags))
            : [];

        this.originalTaskSnapshot = {
          ...this.task,
          tags: tagsCopy,
          assignedMembers: this.task.assignedMembers
            ? [...this.task.assignedMembers]
            : [],
          attachments: this.task.attachments
            ? this.task.attachments.map((a) => ({ ...a }))
            : [],
          urls: this.task.urls ? [...this.task.urls] : [],
        };
        console.log('編集モードON: タスクのスナップショットを保持:', {
          originalTaskSnapshot: this.originalTaskSnapshot,
          originalTaskSnapshotTags: this.originalTaskSnapshot.tags,
          taskTags: this.task.tags,
        });
      }

      // 現在の担当者を編集モード用の選択状態に設定
      this.initializeAssigneeForEdit();
    }
  }

  canSaveTask(): boolean {
    // タスク名の必須チェック
    if (!this.taskData.taskName?.trim()) {
      return false;
    }

    // 開始日と終了日の必須チェック
    if (!this.taskData.startDate || !this.taskData.dueDate) {
      return false;
    }

    // 開始日と終了日の逆転チェック
    if (this.taskData.startDate && this.taskData.dueDate) {
      const startDate = new Date(this.taskData.startDate);
      const dueDate = new Date(this.taskData.dueDate);
      if (startDate > dueDate) {
        return false;
      }
    }

    // 担当者の必須チェック
    if (
      !this.selectedAssignedMemberIds ||
      this.selectedAssignedMemberIds.length === 0
    ) {
      return false;
    }

    return true;
  }

  /** タスクに変更があるかどうかをチェック */
  private hasTaskChanges(): boolean {
    // スナップショットが存在する場合はそれを使用、なければthis.taskを使用
    const baseTask = this.originalTaskSnapshot || this.task;
    if (!baseTask) {
      return false;
    }

    console.log('hasTaskChanges: 比較ベースタスク:', {
      baseTaskTags: baseTask.tags,
      taskDataTags: this.taskData.tags,
      baseTaskAssignedMembers: baseTask.assignedMembers,
      taskDataAssignedMembers: this.taskData.assignedMembers,
    });

    // タスク名の変更チェック
    if (baseTask.taskName !== this.taskData.taskName?.trim()) {
      return true;
    }

    // 説明の変更チェック
    if ((baseTask.description || '') !== (this.taskData.description || '')) {
      return true;
    }

    // 開始日の変更チェック
    if ((baseTask.startDate || '') !== (this.taskData.startDate || '')) {
      return true;
    }

    // 期限日の変更チェック
    if ((baseTask.dueDate || '') !== (this.taskData.dueDate || '')) {
      return true;
    }

    // ステータスの変更チェック
    if ((baseTask.status || '未着手') !== (this.taskData.status || '未着手')) {
      return true;
    }

    // 優先度の変更チェック
    if ((baseTask.priority || '中') !== (this.taskData.priority || '中')) {
      return true;
    }

    // 担当者の変更チェック（assignedMembersを比較）
    const oldAssignedMembers = (baseTask.assignedMembers || []).sort();
    const newAssignedMembers = (this.taskData.assignedMembers || []).sort();
    if (
      JSON.stringify(oldAssignedMembers) !== JSON.stringify(newAssignedMembers)
    ) {
      console.log('hasTaskChanges: 担当者に変更あり');
      return true;
    }

    // タグの変更チェック
    const oldTags = (baseTask.tags || []).sort();
    const newTags = (this.taskData.tags || []).sort();
    if (JSON.stringify(oldTags) !== JSON.stringify(newTags)) {
      console.log('hasTaskChanges: タグに変更あり', {
        oldTags,
        newTags,
        oldTagsStr: JSON.stringify(oldTags),
        newTagsStr: JSON.stringify(newTags),
      });
      return true;
    }

    // URLの変更チェック
    const oldUrls = (baseTask.urls || []).sort();
    const newUrls = (this.taskData.urls || []).sort();
    if (JSON.stringify(oldUrls) !== JSON.stringify(newUrls)) {
      return true;
    }

    // 添付ファイルの変更チェック（追加・削除されたファイルがあるか）
    const oldAttachments = (baseTask.attachments || []).map((a) => a.id).sort();
    const newAttachments = this.editableAttachments.map((a) => a.id).sort();
    if (JSON.stringify(oldAttachments) !== JSON.stringify(newAttachments)) {
      return true;
    }

    // 保留中のファイルがあるか
    if (this.pendingFiles.length > 0) {
      return true;
    }

    // 削除予定のファイルがあるか
    if (this.attachmentsToRemove.length > 0) {
      return true;
    }

    return false;
  }

  /** 開始日変更時の処理 */
  onTaskStartDateChange(): void {
    if (this.taskStartDateObj) {
      const year = this.taskStartDateObj.getFullYear();
      const month = String(this.taskStartDateObj.getMonth() + 1).padStart(
        2,
        '0'
      );
      const day = String(this.taskStartDateObj.getDate()).padStart(2, '0');
      this.taskData.startDate = `${year}-${month}-${day}`;

      // 開始日から30日後の日付を計算
      const maxDueDate = new Date(this.taskStartDateObj);
      maxDueDate.setDate(maxDueDate.getDate() + 30);
      // maxDate（当月+3か月の月末）を超えないようにする
      this.maxTaskDueDate =
        maxDueDate > this.maxDate ? this.maxDate : maxDueDate;

      // 終了日が30日を超えている場合は調整
      if (this.taskDueDateObj && this.taskDueDateObj > this.maxTaskDueDate) {
        this.taskDueDateObj = new Date(this.maxTaskDueDate);
        this.onTaskDueDateChange();
        this.snackBar.open(
          this.languageService.translate('taskDetail.error.dateRangeExceeded'),
          this.languageService.translate('common.close'),
          { duration: 3000 }
        );
      }
    } else {
      this.taskData.startDate = '';
      this.maxTaskDueDate = null;
    }
  }

  onTaskDueDateChange(): void {
    if (this.taskDueDateObj) {
      const year = this.taskDueDateObj.getFullYear();
      const month = String(this.taskDueDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(this.taskDueDateObj.getDate()).padStart(2, '0');
      this.taskData.dueDate = `${year}-${month}-${day}`;

      // 開始日から30日を超えている場合はエラー
      if (this.taskStartDateObj && this.taskDueDateObj) {
        const daysDiff = Math.floor(
          (this.taskDueDateObj.getTime() - this.taskStartDateObj.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 30) {
          const maxDueDate = new Date(this.taskStartDateObj);
          maxDueDate.setDate(maxDueDate.getDate() + 30);
          // maxDate（当月+3か月の月末）を超えないようにする
          const limitedMaxDueDate =
            maxDueDate > this.maxDate ? this.maxDate : maxDueDate;
          this.taskDueDateObj = new Date(limitedMaxDueDate);
          this.onTaskDueDateChange();
          this.snackBar.open(
            this.languageService.translate(
              'taskDetail.error.dateRangeExceeded'
            ),
            this.languageService.translate('common.close'),
            { duration: 3000 }
          );
        }
      }
    } else {
      this.taskData.dueDate = '';
    }
  }

  onStartDateChange(): void {
    if (this.taskData.startDate && this.taskData.dueDate) {
      const startDate = new Date(this.taskData.startDate);
      const dueDate = new Date(this.taskData.dueDate);
      // 開始日が期限日より後の場合は、期限日を開始日に合わせる
      if (startDate > dueDate) {
        this.taskData.dueDate = this.taskData.startDate;
      }
    }
  }

  /** 期限日変更時の処理 */
  onDueDateChange(): void {
    if (this.taskData.startDate && this.taskData.dueDate) {
      const startDate = new Date(this.taskData.startDate);
      const dueDate = new Date(this.taskData.dueDate);
      // 期限日が開始日より前の場合は、開始日を期限日に合わせる
      if (dueDate < startDate) {
        this.taskData.startDate = this.taskData.dueDate;
      }
    }
  }

  /** 編集モード用に担当者を初期化 */
  private initializeAssigneeForEdit(): void {
    // projectMembers がまだ読み込まれていて、読み込み中の場合は待つ
    if (this.projectMembers.length === 0 && this.membersLoading) {
      console.log(
        'プロジェクトメンバー読み込み中。読み込み完了後に再初期化します。'
      );
      return;
    }

    // まず task.assignedMembers を確認（最新のデータ）
    if (this.task?.assignedMembers && this.task.assignedMembers.length > 0) {
      console.log(
        'task.assignedMembers から初期化:',
        this.task.assignedMembers
      );
      this.selectedAssignedMemberIds = [...this.task.assignedMembers];
      this.taskData.assignedMembers = [...this.task.assignedMembers];
      return;
    }

    // 次に taskData.assignedMembers を確認
    if (
      this.taskData.assignedMembers &&
      this.taskData.assignedMembers.length > 0
    ) {
      console.log(
        'taskData.assignedMembers から初期化:',
        this.taskData.assignedMembers
      );
      this.selectedAssignedMemberIds = [...this.taskData.assignedMembers];
      return;
    }

    // assignedMembers が設定されていない場合、taskData.assignee から変換
    // ただし、projectMembers が読み込まれている場合のみ
    if (this.taskData.assignee && this.projectMembers.length > 0) {
      // assignee がカンマ区切りの場合も処理
      const assigneeNames = this.taskData.assignee
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      const memberIds: string[] = [];
      assigneeNames.forEach((name) => {
        const member = this.projectMembers.find((m) => m.name === name);
        if (member && member.id) {
          memberIds.push(member.id);
        }
      });

      if (memberIds.length > 0) {
        console.log(
          'taskData.assignee から初期化:',
          assigneeNames,
          '→',
          memberIds
        );
        this.selectedAssignedMemberIds = memberIds;
        this.taskData.assignedMembers = memberIds;
        return;
      }
    }

    // projectMembers が空で、assignedMembers も assignee も設定されていない場合
    if (this.projectMembers.length === 0) {
      console.log(
        'プロジェクトメンバーがまだ読み込まれていません。読み込み完了後に再初期化します。'
      );
      return;
    }

    // 担当者が設定されていない場合
    console.log('担当者が設定されていません');
    this.selectedAssignedMemberIds = [];
    this.taskData.assignedMembers = [];
  }

  /** タスクを保存 */
  async saveTask(snapshotToUse?: Task | null) {
    if (!this.task || !this.task.projectId || !this.task.id) {
      return;
    }

    // タスク名の必須チェック
    const taskName = this.taskData.taskName?.trim();
    if (!taskName) {
      this.snackBar.open(
        this.languageService.translate('taskDetail.error.taskNameRequired'),
        this.languageService.translate('common.close'),
        {
          duration: 3000,
        }
      );
      return;
    }

    // 開始日と終了日の必須チェック
    if (!this.taskData.startDate || !this.taskData.dueDate) {
      this.snackBar.open(
        this.languageService.translate('taskDetail.error.datesRequired'),
        this.languageService.translate('common.close'),
        {
          duration: 3000,
        }
      );
      return;
    }

    // 開始日と終了日の逆転チェック
    if (this.taskData.startDate && this.taskData.dueDate) {
      const startDate = new Date(this.taskData.startDate);
      const dueDate = new Date(this.taskData.dueDate);
      if (startDate > dueDate) {
        this.snackBar.open(
          this.languageService.translate(
            'taskDetail.error.startDateAfterDueDate'
          ),
          this.languageService.translate('common.close'),
          {
            duration: 3000,
          }
        );
        return;
      }

      // 開始日から終了日までの期間が30日を超えていないかチェック
      const daysDiff = Math.floor(
        (dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff > 30) {
        this.snackBar.open(
          this.languageService.translate('taskDetail.error.dateRangeExceeded'),
          this.languageService.translate('common.close'),
          { duration: 3000 }
        );
        return;
      }
    }

    // 担当者の必須チェック
    if (
      !this.selectedAssignedMemberIds ||
      this.selectedAssignedMemberIds.length === 0
    ) {
      this.snackBar.open(
        this.languageService.translate('taskDetail.error.assigneeRequired'),
        this.languageService.translate('common.close'),
        {
          duration: 3000,
        }
      );
      return;
    }

    // タスク名の重複チェック
    if (taskName) {
      try {
        const isSubtask = !!this.task.parentTaskId;
        if (isSubtask && this.task.parentTaskId) {
          // 子タスクの場合
          const exists = await this.taskService.childTaskNameExists(
            this.task.projectId,
            this.task.parentTaskId,
            taskName,
            this.task.id
          );
          if (exists) {
            this.snackBar.open(
              this.languageService.translate(
                'taskDetail.error.childTaskNameExists'
              ),
              this.languageService.translate('common.close'),
              {
                duration: 5000,
              }
            );
            return;
          }
        } else {
          // 親タスクの場合
          const exists = await this.taskService.taskNameExists(
            this.task.projectId,
            taskName,
            this.task.id
          );
          if (exists) {
            this.snackBar.open(
              this.languageService.translate('taskDetail.error.taskNameExists'),
              this.languageService.translate('common.close'),
              {
                duration: 5000,
              }
            );
            return;
          }
        }
      } catch (error) {
        console.error('タスク名重複チェックエラー:', error);
        // エラーが発生してもタスク保存は続行
      }
    }

    this.isSaving = true;
    try {
      // 保留中のファイルをアップロード
      const uploadedAttachments = await this.uploadPendingFiles(this.task.id);

      // アップロードされたファイルを追加
      this.editableAttachments.push(...uploadedAttachments);

      // 削除済みファイルをFirebase Storageから削除
      await this.deleteMarkedAttachments(this.task.id);

      // タスクデータに添付ファイル情報を追加
      this.taskData.attachments = this.editableAttachments || [];

      // tagsが未初期化の場合は空配列に設定
      if (!this.taskData.tags) {
        this.taskData.tags = [];
      }

      // urlsが未初期化の場合は空配列に設定
      if (!this.taskData.urls) {
        this.taskData.urls = [];
      }

      // スナップショットが存在する場合はそれを使用、なければthis.taskを使用（oldTaskDataとして）
      // 引数として渡されたsnapshotToUseを優先使用（toggleEdit()でnullに設定される前に保持されたもの）
      // 次にthis.originalTaskSnapshotを使用（まだ存在する場合）
      // 最後にthis.taskを使用（リアルタイム更新で変更されている可能性があるため、最後の手段）
      const oldTaskData = snapshotToUse
        ? snapshotToUse
        : this.originalTaskSnapshot
        ? {
            ...this.originalTaskSnapshot,
            tags: this.originalTaskSnapshot.tags
              ? [...this.originalTaskSnapshot.tags]
              : [],
          } // 深いコピーを作成
        : this.task;

      console.log('[saveTask] タグ比較デバッグ:', {
        snapshotToUseExists: !!snapshotToUse,
        snapshotToUseTags: snapshotToUse?.tags,
        originalTaskSnapshotExists: !!this.originalTaskSnapshot,
        originalTaskSnapshotTags: this.originalTaskSnapshot?.tags,
        originalTaskSnapshotTagsType: typeof this.originalTaskSnapshot?.tags,
        originalTaskSnapshotTagsIsArray: Array.isArray(
          this.originalTaskSnapshot?.tags
        ),
        taskTags: this.task?.tags,
        taskDataTags: this.taskData.tags,
        oldTaskDataTags: oldTaskData?.tags,
        oldTaskDataTagsType: typeof oldTaskData?.tags,
        oldTaskDataTagsIsArray: Array.isArray(oldTaskData?.tags),
        oldTaskDataKeys: oldTaskData ? Object.keys(oldTaskData) : [],
        taskDataKeys: Object.keys(this.taskData),
      });

      // taskDataを明示的に設定（undefinedを防ぐため）
      // 必要なフィールドのみを明示的に設定し、undefinedを確実に除外
      const taskDataToSave: any = {};

      // 必須フィールドを設定
      if (this.taskData.projectId !== undefined)
        taskDataToSave.projectId = this.taskData.projectId;
      if (this.taskData.projectName !== undefined)
        taskDataToSave.projectName = this.taskData.projectName;
      if (this.taskData.taskName !== undefined)
        taskDataToSave.taskName = this.taskData.taskName;
      if (this.taskData.description !== undefined)
        taskDataToSave.description = this.taskData.description || '';
      if (this.taskData.startDate !== undefined)
        taskDataToSave.startDate = this.taskData.startDate;
      if (this.taskData.dueDate !== undefined)
        taskDataToSave.dueDate = this.taskData.dueDate;
      if (this.taskData.assignee !== undefined)
        taskDataToSave.assignee = this.taskData.assignee || '';
      if (this.taskData.status !== undefined)
        taskDataToSave.status = this.taskData.status;
      if (this.taskData.priority !== undefined)
        taskDataToSave.priority = this.taskData.priority;

      // オプショナルフィールド（undefinedでない場合のみ設定）
      if (this.taskData.tags !== undefined)
        taskDataToSave.tags = this.taskData.tags || [];
      if (this.taskData.urls !== undefined)
        taskDataToSave.urls = this.taskData.urls || [];
      if (this.taskData.attachments !== undefined)
        taskDataToSave.attachments = this.taskData.attachments || [];
      if (this.taskData.assignedMembers !== undefined)
        taskDataToSave.assignedMembers = this.taskData.assignedMembers || [];
      if (this.taskData.calendarSyncEnabled !== undefined)
        taskDataToSave.calendarSyncEnabled =
          this.taskData.calendarSyncEnabled ?? false;
      if (
        this.taskData.parentTaskId !== undefined &&
        this.taskData.parentTaskId !== null
      )
        taskDataToSave.parentTaskId = this.taskData.parentTaskId;
      if (
        this.taskData.assigneeEmail !== undefined &&
        this.taskData.assigneeEmail !== null
      )
        taskDataToSave.assigneeEmail = this.taskData.assigneeEmail;
      if (this.taskData.relatedFiles !== undefined)
        taskDataToSave.relatedFiles = this.taskData.relatedFiles || [];
      if (
        this.taskData.projectThemeColor !== undefined &&
        this.taskData.projectThemeColor !== null
      )
        taskDataToSave.projectThemeColor = this.taskData.projectThemeColor;
      if (
        this.taskData.detailSettings !== undefined &&
        this.taskData.detailSettings !== null
      )
        taskDataToSave.detailSettings = this.taskData.detailSettings;

      console.log('保存するタスクデータ:', {
        ...taskDataToSave,
        tags: taskDataToSave.tags,
        tagsLength: taskDataToSave.tags.length,
      });

      await this.taskService.updateTask(
        this.task.id,
        taskDataToSave,
        oldTaskData,
        this.task.projectId
      );

      // 保存後、this.task を更新（次回編集モードON時に正しいデータが使われるように）
      if (this.task) {
        this.task = {
          ...this.task,
          ...this.taskData,
          assignedMembers: this.taskData.assignedMembers || [],
        };
      }

      console.log('タスクが更新されました');

      this.isEditing = false;
      this.isSaving = false;
    } catch (error: Error | unknown) {
      console.error('タスク更新エラー:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : this.languageService.translate('taskDetail.error.unknownError');
      const alertMessage = this.languageService.translateWithParams(
        'taskDetail.error.saveFailed',
        { errorMessage }
      );
      alert(alertMessage);
      this.isSaving = false;
    }
  }

  /** キャンセル */
  cancel() {
    console.log('編集をキャンセルします');
    this.isEditing = false;
    this.originalTaskSnapshot = null; // スナップショットをクリア

    // 元のデータに戻す
    if (this.task) {
      this.taskData = {
        projectId: this.task.projectId || '',
        projectName: this.task.projectName || '',
        taskName: this.task.taskName || '',
        description: this.task.description || '',
        startDate: this.task.startDate || '',
        dueDate: this.task.dueDate || '',
        assignee: this.task.assignee || '',
        status: this.task.status || '未着手',
        priority: this.task.priority || '中',
        tags: this.task.tags || [],
        relatedFiles: this.task.relatedFiles || [],
        assignedMembers: this.task.assignedMembers || [],
        urls: this.task.urls || [],
      };
      // 添付ファイルを元に戻す
      this.editableAttachments = (this.task.attachments || []).map(
        (attachment) => ({ ...attachment })
      );
      // assignedMembers を selectedAssignedMemberIds に反映
      this.selectedAssignedMemberIds = this.task.assignedMembers
        ? [...this.task.assignedMembers]
        : [];
      this.pendingFiles = [];
      this.attachmentsToRemove = [];
      console.log('データを元に戻しました');
    }
  }

  /** 詳細設定を開く */
  openDetailSettings() {
    if (this.task) {
      this.initializeDetailSettings((this.task as any).detailSettings);
    } else {
      this.initializeDetailSettings(undefined);
    }
    // 作業予定時間を読み込んで、estimatedHoursプロパティを初期化
    this.rebuildTimePickers();
    this.isDetailSettingsOpen = true;
  }

  /** 詳細設定を閉じる */
  closeDetailSettings() {
    this.isDetailSettingsOpen = false;
  }

  /** 子タスクを作成 */
  async createSubtask() {
    if (!this.task?.projectId || !this.task?.id) {
      return;
    }

    // 子タスク数の制限をチェック
    try {
      const childTaskCount = await this.taskService.getChildTaskCount(
        this.task.projectId,
        this.task.id
      );
      const maxChildTasks = 5;
      if (childTaskCount >= maxChildTasks) {
        this.snackBar.open(
          this.languageService.translateWithParams(
            'taskDetail.error.maxChildTasks',
            {
              count: maxChildTasks.toString(),
            }
          ),
          this.languageService.translate('common.close'),
          { duration: 5000 }
        );
        return;
      }
    } catch (error) {
      console.error('子タスク数チェックエラー:', error);
      this.snackBar.open(
        this.languageService.translate(
          'taskDetail.error.childTaskCountCheckFailed'
        ),
        this.languageService.translate('common.close'),
        {
          duration: 3000,
        }
      );
      return;
    }
    if (this.task?.parentTaskId) {
      return;
    }

    this.router.navigate(['/task-create'], {
      queryParams: { parentTaskId: this.task?.id },
      state: {
        projectName: this.project?.projectName,
        projectId: this.task?.projectId,
        returnUrl: this.router.url,
      },
    });
  }

  /** タスクを複製 */
  duplicateTask() {
    if (!this.task || !this.project) {
      return;
    }

    // タスク作成画面に遷移し、複製データを渡す
    // 資料情報（attachments, urls）は引き継がない
    const { attachments, urls, ...taskDataWithoutMaterials } = this.taskData;
    const navigationState: any = {
      projectName: this.project.projectName,
      projectId: this.task.projectId,
      returnUrl: this.router.url,
      duplicateData: {
        ...taskDataWithoutMaterials,
        parentTaskId: this.task.parentTaskId || undefined, // 子タスクの場合は親タスクIDを保持
      },
    };

    // 子タスクの場合は、queryParamsにparentTaskIdを追加
    const queryParams: any = {};
    if (this.task.parentTaskId) {
      queryParams.parentTaskId = this.task.parentTaskId;
    }

    this.router.navigate(['/task-create'], {
      queryParams:
        Object.keys(queryParams).length > 0 ? queryParams : undefined,
      state: navigationState,
    });
  }

  /** タスクを削除 */
  deleteTask() {
    const childTasksCount = this.childTasks?.length || 0;
    let confirmMessage = this.languageService.translateWithParams(
      'taskDetail.deleteConfirm.message',
      { taskName: this.taskData.taskName || '' }
    );

    if (childTasksCount > 0) {
      confirmMessage +=
        '\n\n' +
        this.languageService.translateWithParams(
          'taskDetail.deleteConfirm.childTasksWarning',
          { count: childTasksCount.toString() }
        );
    }

    if (confirm(confirmMessage)) {
      if (this.task && this.task.projectId && this.task.id) {
        const projectId = this.task.projectId;
        const isSubtask = !!this.task.parentTaskId;
        const parentTaskId = this.task.parentTaskId;

        this.taskService
          .deleteTask(this.task.id, this.taskData, projectId)
          .then(() => {
            console.log('タスクが削除されました');
            if (childTasksCount > 0) {
              console.log(`${childTasksCount}件の子タスクも削除されました`);
            }

            // 子タスクの場合は親タスク詳細へ、親タスクの場合はプロジェクト詳細へ
            if (isSubtask && parentTaskId) {
              // 子タスク: 親タスク詳細へ
              this.router.navigate(
                ['/project', projectId, 'task', parentTaskId],
                { replaceUrl: true }
              );
            } else {
              // 親タスク: プロジェクト詳細へ
              this.router.navigate(['/project', projectId], {
                replaceUrl: true,
              });
            }
          })
          .catch((error: Error) => {
            console.error('タスク削除エラー:', error);
            alert(
              this.languageService.translate('taskDetail.error.deleteFailed')
            );
          });
      }
    }
  }

  /** カレンダー連携のON/OFFを切り替え */
  async toggleCalendarSync(): Promise<void> {
    if (!this.task || !this.task.projectId || !this.task.id) {
      console.warn('カレンダー連携の切り替えに必要な情報が不足しています');
      return;
    }

    const currentValue = this.taskData.calendarSyncEnabled ?? false;
    const taskCalendarSyncEnabled = this.task.calendarSyncEnabled ?? false;
    const nextValue = !currentValue;

    console.log('カレンダー連携切り替え:', {
      currentValue,
      taskCalendarSyncEnabled,
      nextValue,
      taskId: this.task.id,
    });

    // 既にカレンダー連携が有効な場合は、追加処理をスキップ
    if (nextValue && (currentValue || taskCalendarSyncEnabled)) {
      console.log('カレンダー連携は既に有効です。追加処理をスキップします。');
      // フラグのみ更新（カレンダーには追加しない）
      this.taskData.calendarSyncEnabled = nextValue;
      await this.projectService.updateTask(this.task.projectId, this.task.id, {
        calendarSyncEnabled: nextValue,
      });
      this.task.calendarSyncEnabled = nextValue;
      return;
    }

    this.taskData.calendarSyncEnabled = nextValue;
    this.isCalendarSyncSaving = true;

    try {
      // ON の場合のみ Googleカレンダーにタスクを追加
      // ただし、既にカレンダー連携が有効な場合は追加しない（重複防止）
      if (nextValue && !currentValue && !taskCalendarSyncEnabled) {
        console.log('カレンダーに追加します');
        await this.calendarService.addTaskToCalendar(
          this.taskData.taskName,
          this.taskData.dueDate
        );
      } else {
        console.log('カレンダーに追加をスキップします（既に有効）');
      }

      // タスクの calendarSyncEnabled フラグを更新
      await this.projectService.updateTask(this.task.projectId, this.task.id, {
        calendarSyncEnabled: nextValue,
      });

      this.task.calendarSyncEnabled = nextValue;
      console.log(
        `カレンダー連携を${nextValue ? 'ON' : 'OFF'}に更新しました (taskId: ${
          this.task.id
        })`
      );
    } catch (error: any) {
      console.error('カレンダー連携の更新に失敗しました', error);

      const errorMsg =
        error?.message ||
        this.languageService.translate('taskDetail.error.unknownErrorOccurred');
      const alertMessage = this.languageService.translateWithParams(
        'taskDetail.error.calendarSyncFailed',
        { errorMessage: errorMsg }
      );
      alert(alertMessage);
      this.taskData.calendarSyncEnabled = !nextValue;
      this.task.calendarSyncEnabled = this.taskData.calendarSyncEnabled;
    } finally {
      this.isCalendarSyncSaving = false;
    }
  }

  /** タスク期限通知を切り替え */
  toggleTaskDeadlineNotification(): void {
    const current = this.detailSettings.notifications.beforeDeadline ?? true;
    const nextValue = !current;
    this.detailSettings.notifications.beforeDeadline = nextValue;

    // 通知先は常に担当者に設定（通知先フィールドは削除されたため）
    if (nextValue) {
      this.detailSettings.notifications.recipients =
        this.getDefaultNotificationRecipients();
    }
  }

  onEstimatedTimeChange(): void {
    this.detailSettings.workTime.estimatedHours = `${this.estimatedHours.hour}:${this.estimatedHours.minute}`;
  }

  /** タグを追加 */
  async addTag(tag: string) {
    const trimmedTag = tag?.trim();
    if (!trimmedTag) {
      return;
    }

    // tagsが未初期化の場合は初期化
    if (!this.taskData.tags) {
      this.taskData.tags = [];
    }

    // タグの数が3つを超えないようにチェック
    if (this.taskData.tags.length >= 3) {
      this.snackBar.open(
        this.languageService.translate('taskDetail.error.maxTagsReached'),
        this.languageService.translate('common.close'),
        { duration: 3000 }
      );
      return;
    }

    // 既に存在する場合は追加しない
    if (!this.taskData.tags.includes(trimmedTag)) {
      this.taskData.tags.push(trimmedTag);
      console.log('タグを追加:', trimmedTag, '現在のタグ:', this.taskData.tags);

      // 編集モードの場合、自動保存
      if (this.isEditing && this.task && this.task.projectId && this.task.id) {
        await this.saveTagsOnly();
      }
    }
  }

  /** タグを削除 */
  async removeTag(tag: string) {
    if (this.taskData.tags) {
      this.taskData.tags = this.taskData.tags.filter((t: string) => t !== tag);

      // 編集モードの場合、自動保存
      if (this.isEditing && this.task && this.task.projectId && this.task.id) {
        await this.saveTagsOnly();
      }
    }
  }

  /** タグのみを保存（メッセージと編集ログなし、this.taskは更新しない） */
  private async saveTagsOnly(): Promise<void> {
    if (!this.task || !this.task.projectId || !this.task.id) {
      return;
    }

    try {
      // tagsが未初期化の場合は空配列に設定
      if (!this.taskData.tags) {
        this.taskData.tags = [];
      }

      // 直接Firestoreを更新して編集ログを記録しない
      // 注意: this.taskは更新しない（編集モードOFF時にhasTaskChanges()で変更を検出できるようにするため）
      const taskRef = doc(
        this.firestore,
        `projects/${this.task.projectId}/tasks/${this.task.id}`
      );
      await updateDoc(taskRef, {
        tags: this.taskData.tags,
      });

      console.log('タグを保存しました（自動保存）:', this.taskData.tags);
      console.log(
        'this.task.tagsは更新していません（編集モードOFF時に変更検出のため）'
      );
    } catch (error) {
      console.error('タグの保存エラー:', error);
      // エラー時はユーザーに通知しない（タグ追加・削除時の自動保存のため）
    }
  }

  /** 関連資料を追加 */
  addRelatedFile(file: string) {
    if (
      file &&
      this.taskData.relatedFiles &&
      !this.taskData.relatedFiles.includes(file)
    ) {
      this.taskData.relatedFiles.push(file);
    }
  }

  /** 関連資料を削除 */
  removeRelatedFile(file: string) {
    if (this.taskData.relatedFiles) {
      this.taskData.relatedFiles = this.taskData.relatedFiles.filter(
        (f: string) => f !== file
      );
    }
  }

  /** URLかどうかを判定 */
  isUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  /** URLをクリック時に新しいウィンドウで開く */
  openUrl(url: string) {
    if (this.isUrl(url)) {
      window.open(url, '_blank');
    }
  }

  /** URLのラベルを抽出 */
  extractUrlLabel(url: string): string {
    try {
      const urlObj = new URL(url);
      // ホスト名またはパス名から短いラベルを作成
      const hostname = urlObj.hostname.replace('www.', '');
      return hostname || url.substring(0, 30);
    } catch {
      return url.substring(0, 30);
    }
  }

  /** URLを追加 */
  addUrl(url: string): void {
    if (url && url.trim()) {
      const trimmedUrl = url.trim();
      if (!this.taskData.urls) {
        this.taskData.urls = [];
      }

      // ファイルとURLの合計が3つを超えないようにチェック
      const currentTotal =
        this.taskData.urls.length +
        this.editableAttachments.length +
        this.pendingFiles.length;
      if (currentTotal >= 3) {
        this.snackBar.open(
          this.languageService.translate(
            'taskDetail.error.maxAttachmentsReached'
          ),
          this.languageService.translate('common.close'),
          { duration: 3000 }
        );
        return;
      }

      if (!this.taskData.urls.includes(trimmedUrl)) {
        this.taskData.urls.push(trimmedUrl);
        this.newUrlInput = '';
      }
    }
  }

  /** URLを削除 */
  removeUrl(url: string): void {
    if (this.taskData.urls) {
      this.taskData.urls = this.taskData.urls.filter((u: string) => u !== url);
    }
  }

  /** 詳細設定を保存 */
  saveDetailSettings() {
    if (this.task && this.task.projectId && this.task.id) {
      if (
        this.detailSettings.notifications.beforeDeadline === undefined ||
        this.detailSettings.notifications.beforeDeadline === null
      ) {
        this.detailSettings.notifications.beforeDeadline = true;
      }

      // 作業予定時間を保存（estimatedHoursからdetailSettings.workTime.estimatedHoursに反映）
      this.detailSettings.workTime.estimatedHours = `${this.estimatedHours.hour}:${this.estimatedHours.minute}`;

      // 通知先は常に担当者に設定（通知先フィールドは削除されたため）
      this.detailSettings.notifications.recipients =
        this.getDefaultNotificationRecipients();

      this.projectService
        .updateTask(this.task.projectId, this.task.id, {
          detailSettings: this.detailSettings,
        })
        .then(() => {
          console.log('詳細設定が保存されました');
          this.task = {
            ...this.task,
            detailSettings: { ...this.detailSettings },
          } as Task;
          // 詳細設定保存時のメッセージは表示しない
          this.closeDetailSettings();
        })
        .catch((error) => {
          console.error('詳細設定の保存エラー:', error);
          this.snackBar.open(
            this.languageService.translate(
              'taskDetail.error.detailSettingsSaveFailed'
            ),
            this.languageService.translate('common.close'),
            {
              duration: 3000,
            }
          );
        });
    }
  }

  /** 戻る */
  goBack() {
    if (!this.task) {
      // タスク情報が読み込まれていない場合は、プロジェクト一覧に戻る
      const projectId = this.route.snapshot.paramMap.get('projectId');
      if (projectId) {
        this.router.navigate(['/project', projectId]);
      } else {
        this.router.navigate(['/kanban']);
      }
      return;
    }

    const projectId = this.task.projectId;

    // 子タスクの場合は親タスク詳細へ、親タスクの場合はプロジェクト詳細へ
    if (this.task.parentTaskId) {
      // 子タスク: 親タスク詳細へ
      this.router.navigate([
        '/project',
        projectId,
        'task',
        this.task.parentTaskId,
      ]);
    } else {
      // 親タスク: プロジェクト詳細へ
      this.router.navigate(['/project', projectId]);
    }
  }

  private createDefaultDetailSettings() {
    return {
      notifications: {
        beforeDeadline: true,
        recipients: [] as string[],
      },
      taskOrder: {
        requireSubtaskCompletion: false,
        subtaskOrder: [] as string[],
      },
      workTime: {
        estimatedHours: '00:00',
      },
    };
  }

  private initializeDetailSettings(storedSettings: any) {
    const defaults = this.createDefaultDetailSettings();

    this.detailSettings = {
      notifications: {
        ...defaults.notifications,
        ...(storedSettings?.notifications ?? {}),
      },
      taskOrder: {
        ...defaults.taskOrder,
        ...(storedSettings?.taskOrder ?? {}),
        subtaskOrder: storedSettings?.taskOrder?.subtaskOrder
          ? [...storedSettings.taskOrder.subtaskOrder]
          : [...defaults.taskOrder.subtaskOrder],
      },
      workTime: {
        ...defaults.workTime,
        ...(storedSettings?.workTime ?? {}),
      },
    };

    if (
      this.detailSettings.notifications.beforeDeadline === undefined ||
      this.detailSettings.notifications.beforeDeadline === null
    ) {
      this.detailSettings.notifications.beforeDeadline = true;
    }

    // 通知先は常に担当者に設定（通知先フィールドは削除されたため）
    // 保存されたrecipientsは無視し、常に現在の担当者を使用
    if (this.detailSettings.notifications.beforeDeadline) {
      this.ensureNotificationRecipients();
    }

    // 作業予定時間を読み込んで、estimatedHoursプロパティを初期化
    this.rebuildTimePickers();

    // reopenParentTaskIfNeededはsetupChildTasksで呼び出されるため、ここでは呼び出さない
  }

  private ensureNotificationRecipients(): void {
    // 通知先は常に担当者に設定（通知先フィールドは削除されたため）
    this.detailSettings.notifications.recipients =
      this.getDefaultNotificationRecipients();
  }

  private getDefaultNotificationRecipients(): string[] {
    const set = new Set<string>();

    // assignee をカンマ区切りで分割して追加
    if (this.taskData.assignee) {
      const assignees = this.taskData.assignee
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
      assignees.forEach((assignee) => set.add(assignee));
    }

    // assignedMembers から名前を取得して追加
    if (
      this.taskData.assignedMembers &&
      this.taskData.assignedMembers.length > 0
    ) {
      const memberNames = getMemberNames(
        this.taskData.assignedMembers,
        this.projectMembers
      );
      memberNames.forEach((name) => set.add(name));
    }

    return Array.from(set);
  }

  private async reopenParentTaskIfNeeded(children: Task[]): Promise<void> {
    // 既に実行中の場合はスキップ（重複実行を防ぐ）
    if (this.isReopeningParentTask) {
      console.log('親タスクの再オープン処理は既に実行中です。スキップします。');
      return;
    }

    if (!this.task || !this.task.id || !this.task.projectId) {
      return;
    }

    if (this.task.status !== '完了') {
      return;
    }

    const requireCompletion =
      this.task.detailSettings?.taskOrder?.requireSubtaskCompletion === true;
    if (!requireCompletion) {
      return;
    }

    const incompleteChild = children.find((child) => child.status !== '完了');
    if (!incompleteChild) {
      return;
    }

    // フラグを立てて重複実行を防ぐ
    this.isReopeningParentTask = true;

    try {
      // alertの代わりにsnackBarを使用（ブロッキングしない）
      this.snackBar.open(
        this.languageService.translateWithParams(
          'taskDetail.alert.parentTaskStatusChange',
          {
            taskName:
              this.task.taskName ||
              this.languageService.translate('common.nameNotSet'),
          }
        ),
        this.languageService.translate('common.close'),
        { duration: 3000 }
      );

      const previousStatus = this.task.status;
      this.task.status = '作業中';
      this.taskData.status = '作業中';

      await this.taskService.updateTaskStatus(
        this.task.id,
        '作業中',
        previousStatus,
        this.task.projectId,
        this.task.projectName
      );
      console.log('親タスクを作業中に戻しました');
    } catch (error) {
      console.error('親タスクのステータス更新に失敗しました', error);
      this.snackBar.open(
        this.languageService.translate(
          'taskDetail.error.parentTaskStatusUpdateFailed'
        ),
        this.languageService.translate('common.close'),
        {
          duration: 3000,
        }
      );
    } finally {
      // 処理完了後にフラグをリセット
      this.isReopeningParentTask = false;
    }
  }

  private setupChildTasks(tasks: Task[], parentId: string): void {
    console.log('[setupChildTasks] 開始:', {
      parentId,
      totalTasks: tasks.length,
      tasksWithParentId: tasks.filter((task) => task.parentTaskId === parentId)
        .length,
    });
    const children = this.sortTasksByDueDate(
      tasks.filter((task) => task.parentTaskId === parentId)
    );
    console.log('[setupChildTasks] 子タスク:', {
      childrenCount: children.length,
      childrenIds: children.map((c) => c.id),
      childrenNames: children.map((c) => c.taskName),
    });
    this.childTasks = children;
    // ✅ 修正：assignedMembers（メンバーID配列）からだけ選択肢を生成
    const assigneeSet = new Set<string>();

    // 各タスクの担当者を取得（assignedMembersから最新のメンバー名を取得）
    children.forEach((task) => {
      // assignedMembers から取得（メンバーIDからメンバー名に変換）
      if (
        Array.isArray(task.assignedMembers) &&
        task.assignedMembers.length > 0
      ) {
        // projectMembersが空の場合は全メンバーから取得
        const membersToUse =
          this.projectMembers.length > 0 ? this.projectMembers : this.members;
        const memberNames = getMemberNames(task.assignedMembers, membersToUse);
        memberNames.forEach((name) => assigneeSet.add(name));
      }
    });

    // プロジェクトのメンバー一覧からも取得（assignedMembersに含まれていないメンバーも選択肢に含める）
    // projectMembersが空の場合は全メンバーから取得
    const membersToUse =
      this.projectMembers.length > 0 ? this.projectMembers : this.members;
    membersToUse.forEach((member) => {
      if (member.name) {
        assigneeSet.add(member.name);
      }
    });

    this.childAssigneeOptions = Array.from(assigneeSet).sort();

    if (
      this.childFilterStatus ||
      this.childFilterPriority ||
      this.childFilterAssignee ||
      this.childFilterDueDate
    ) {
      this.applyChildFilter();
    } else {
      this.filteredChildTasks = [...children];
    }

    console.log('[setupChildTasks] 完了:', {
      childTasksCount: this.childTasks.length,
      filteredChildTasksCount: this.filteredChildTasks.length,
    });

    void this.reopenParentTaskIfNeeded(children);
  }

  onChildDueDateChange(): void {
    this.childFilterDueDate = this.formatChildFilterDate(
      this.childFilterDueDateObj
    );
    this.applyChildFilter();
  }

  private formatChildFilterDate(date: Date | null): string {
    if (!date) {
      return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  applyChildFilter(): void {
    const filtered = this.childTasks.filter((task) => {
      const statusMatch =
        this.childFilterStatus.length === 0 ||
        this.childFilterStatus.includes(task.status);
      const priorityMatch =
        this.childFilterPriority.length === 0 ||
        this.childFilterPriority.includes(task.priority);

      // 担当者フィルター（カンマ区切り対応 + メンバーIDをメンバー名に変換）
      let assigneeMatch = true;
      if (this.childFilterAssignee.length > 0) {
        // assignee をカンマで分割（プロジェクトのメンバーのみを対象）
        const assignees = (task.assignee || '')
          .split(',')
          .map((name) => name.trim().toLowerCase())
          .filter((name) => name.length > 0)
          .filter((name) => {
            // プロジェクトのメンバーのみを対象
            return this.projectMembers.some(
              (m) => m.name.toLowerCase() === name
            );
          });

        // assignedMembers も含める（メンバーIDをメンバー名に変換）
        if (Array.isArray((task as any).assignedMembers)) {
          const memberNames = getMemberNames(
            (task as any).assignedMembers,
            this.projectMembers
          );
          assignees.push(...memberNames.map((name) => name.toLowerCase()));
        }

        // フィルター値とマッチするか確認（複数選択対応）
        if (assignees.length === 0) {
          assigneeMatch = false;
        } else {
          const filterAssigneeLower = this.childFilterAssignee.map((a) =>
            a.toLowerCase()
          );
          assigneeMatch = assignees.some((assignee) =>
            filterAssigneeLower.includes(assignee)
          );
        }
      }

      const dueDateMatch =
        !this.childFilterDueDate || task.dueDate === this.childFilterDueDate;

      return statusMatch && priorityMatch && assigneeMatch && dueDateMatch;
    });

    this.filteredChildTasks = this.sortTasksByDueDate(filtered);
  }

  resetChildFilter(): void {
    this.childFilterStatus = [];
    this.childFilterPriority = [];
    this.childFilterAssignee = [];
    this.childFilterDueDate = '';
    this.childFilterDueDateObj = null;
    this.filteredChildTasks = [...this.childTasks];
  }

  /** 子タスクの担当者をカンマ区切りで表示 */
  getChildTaskAssigneeDisplay(child: Task): string {
    const unassignedText = this.languageService.translate(
      'taskDetail.unassigned'
    );
    if (child.assignedMembers && child.assignedMembers.length > 0) {
      const display = getMemberNamesAsString(
        child.assignedMembers,
        this.projectMembers,
        ', ',
        this.languageService
      );
      const notSetText = this.languageService.translate('common.notSet');
      return display === notSetText ? unassignedText : display;
    }

    // assignedMembers がない場合は assignee から最新のメンバー名を取得
    if (!child.assignee) {
      return unassignedText;
    }

    // assignee がカンマ区切りの場合を考慮
    const assigneeNames = child.assignee.split(',').map((name) => name.trim());
    const updatedNames = assigneeNames
      .map((name) => {
        const member =
          this.projectMembers.find((m) => m.name === name) ||
          this.members.find((m) => m.name === name);
        return member ? member.name : null;
      })
      .filter((name): name is string => name !== null);

    return updatedNames.length > 0 ? updatedNames.join(', ') : unassignedText;
  }

  openChildTaskDetail(task: Task): void {
    if (!task.id || !task.projectId) {
      return;
    }
    this.router.navigate(['/project', task.projectId, 'task', task.id]);
  }

  openChildDatePicker(input: HTMLInputElement | null): void {
    if (!input) {
      return;
    }

    const picker = (input as any).showPicker;
    if (typeof picker === 'function') {
      picker.call(input);
    } else {
      input.focus();
      input.click();
    }
  }

  exportChildTasksToCSV(): void {
    if (!this.filteredChildTasks.length) {
      alert(
        this.languageService.translate('taskDetail.error.noChildTasksToExport')
      );
      return;
    }

    const csvData = this.generateChildCSVData();
    const parentName = this.taskData.taskName || 'task';
    this.downloadCSV(csvData, `${parentName}_subtasks.csv`);
  }

  private generateChildCSVData(): string {
    const headers = [
      this.languageService.translate('projectDetail.csv.header.taskName'),
      this.languageService.translate('projectDetail.csv.header.status'),
      this.languageService.translate('projectDetail.csv.header.dueDate'),
      this.languageService.translate('projectDetail.csv.header.priority'),
      this.languageService.translate('projectDetail.csv.header.assignee'),
      this.languageService.translate('projectDetail.csv.header.startDate'),
      this.languageService.translate('projectDetail.csv.header.description'),
    ];
    const rows = this.filteredChildTasks.map((task) => {
      // 担当者名を取得（assignedMembersから複数名を取得）
      let assigneeDisplay = '';
      if (task.assignedMembers && task.assignedMembers.length > 0) {
        assigneeDisplay = getMemberNamesAsString(
          task.assignedMembers,
          this.projectMembers,
          ', ',
          this.languageService
        );
      } else if (task.assignee) {
        // assignedMembersがない場合はassigneeを使用（後方互換性）
        assigneeDisplay = task.assignee;
      }

      return [
        task.taskName,
        task.status,
        task.dueDate,
        task.priority,
        assigneeDisplay,
        task.startDate,
        task.description || '',
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => `"${field}"`).join(','))
      .join('\n');

    return '\uFEFF' + csvContent;
  }

  private downloadCSV(csvData: string, filename: string): void {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getChildTasksSectionBackground(): string {
    return '#ffffff';
  }

  private sortTasksByDueDate(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      const isCompletedA = a.status === '完了' ? 1 : 0;
      const isCompletedB = b.status === '完了' ? 1 : 0;

      if (isCompletedA !== isCompletedB) {
        return isCompletedA - isCompletedB;
      }

      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return dateA - dateB;
    });
  }

  private rebuildTimePickers(): void {
    this.estimatedHours = this.splitTimeString(
      this.detailSettings.workTime.estimatedHours
    );
  }

  private splitTimeString(time: string | undefined): {
    hour: string;
    minute: string;
  } {
    if (typeof time === 'string' && /^\d{2}:\d{2}$/.test(time)) {
      const [hour, minute] = time.split(':');
      return {
        hour: hour.padStart(2, '0'),
        minute: minute.padStart(2, '0'),
      };
    }
    return { hour: '00', minute: '00' };
  }

  // ===== 添付ファイル関連メソッド =====

  trackAttachment(_index: number, attachment: TaskAttachment): string {
    return attachment.id;
  }

  onFilesSelected(event: Event): void {
    if (!this.isEditing) {
      return;
    }
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }

    // ファイルとURLの合計が3つを超えないようにチェック
    const currentTotal =
      (this.taskData.urls?.length || 0) +
      this.editableAttachments.length +
      this.pendingFiles.length;
    if (currentTotal >= 3) {
      this.snackBar.open(
        this.languageService.translate(
          'taskDetail.error.maxAttachmentsReached'
        ),
        this.languageService.translate('common.close'),
        { duration: 3000 }
      );
      input.value = '';
      return;
    }

    Array.from(files).forEach((file) => {
      // ファイルとURLの合計が3つを超えないようにチェック
      const total =
        (this.taskData.urls?.length || 0) +
        this.editableAttachments.length +
        this.pendingFiles.length;
      if (total >= 3) {
        this.snackBar.open(
          this.languageService.translate(
            'taskDetail.error.maxAttachmentsReached'
          ),
          this.languageService.translate('common.close'),
          { duration: 3000 }
        );
        return;
      }

      if (file.size > this.MAX_FILE_SIZE) {
        this.snackBar.open(
          `${file.name} は5MBを超えています。別のファイルを選択してください。`,
          '閉じる',
          { duration: 4000 }
        );
        return;
      }
      this.pendingFiles.push({ id: this.generateId(), file });
    });

    input.value = '';
  }

  removeAttachment(attachment: TaskAttachment): void {
    this.editableAttachments = this.editableAttachments.filter(
      (item) => item.id !== attachment.id
    );

    if (attachment.type === 'file' && attachment.storagePath) {
      this.attachmentsToRemove.push(attachment);
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${bytes} B`;
  }

  private async uploadPendingFiles(taskId: string): Promise<TaskAttachment[]> {
    const uploaded: TaskAttachment[] = [];

    for (const pending of this.pendingFiles) {
      try {
        const attachment = await this.attachmentService.uploadAttachment(
          taskId,
          pending.file
        );
        uploaded.push(attachment);
      } catch (error) {
        console.error('添付ファイルのアップロードに失敗しました:', error);
        this.snackBar.open(
          `${pending.file.name} のアップロードに失敗しました`,
          '閉じる',
          { duration: 4000 }
        );
      }
    }

    this.pendingFiles = [];
    return uploaded;
  }

  private async deleteMarkedAttachments(taskId: string): Promise<void> {
    for (const attachment of this.attachmentsToRemove) {
      try {
        await this.attachmentService.deleteAttachment(attachment);
      } catch (error) {
        console.error('添付ファイルの削除に失敗しました:', error);
        this.snackBar.open('添付ファイルの削除に失敗しました', '閉じる', {
          duration: 3000,
        });
      }
    }
    this.attachmentsToRemove = [];
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}
