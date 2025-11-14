import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { FormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { ProjectService } from '../../services/project.service';
import { MemberManagementService } from '../../services/member-management.service';
import { TaskAttachmentService } from '../../services/task-attachment.service';
import { CalendarService } from '../../services/calendar.service';
import { TaskService } from '../../services/task.service';
import { Member } from '../../models/member.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import {
  DEFAULT_PROJECT_THEME_COLOR,
  resolveProjectThemeColor,
} from '../../constants/project-theme-colors';

@Component({
  selector: 'app-task-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDatepickerModule,
    MatNativeDateModule,
    TranslatePipe,
  ],
  templateUrl: './task-create.component.html',
  styleUrl: './task-create.component.css',
})
export class TaskCreatePageComponent implements OnInit {
  projectName: string = '';
  projectId: string = '';
  returnUrl: string = '';
  parentTaskId: string = '';
  parentTaskName: string = '';
  isSubtaskCreation: boolean = false;
  members: Member[] = [];
  projectMembers: Member[] = []; // プロジェクトのメンバーのみ
  isLoading = false;
  isSaving = false;

  taskForm = {
    taskName: '',
    status: '',
    priority: '',
    assignee: '', // 後方互換性のため残す
    assignedMembers: [] as string[], // ID配列で個人識別
    startDate: '',
    dueDate: '',
    tags: [] as string[],
    description: '',
    calendarSyncEnabled: false,
    attachments: [] as any[],
    urls: [] as string[],
  };

  // ファイル・URL管理
  pendingFiles: { id: string; file: File }[] = [];
  newUrlInput: string = '';
  isUploading = false;
  readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
  readonly fileAccept =
    '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.bmp,.heic,.webp,.svg,.txt,.csv,.zip';

  selectedMemberIds: string[] = [];
  statusOptions: string[] = [];
  priorityOptions: string[] = [];
  projectThemeColor = DEFAULT_PROJECT_THEME_COLOR;
  startDateObj: Date | null = null; // Material date picker用
  dueDateObj: Date | null = null; // Material date picker用
  minDate!: Date; // 当月から3か月前の1日（ngOnInitで初期化）
  maxDate!: Date; // 当月から3か月後の月末日（ngOnInitで初期化）
  maxDueDate: Date | null = null; // 開始日から30日後の日付

  private firestore = inject(Firestore);

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private location: Location,
    private projectService: ProjectService,
    private memberService: MemberManagementService,
    private attachmentService: TaskAttachmentService,
    private calendarService: CalendarService,
    private taskService: TaskService,
    private snackBar: MatSnackBar,
    private languageService: LanguageService
  ) {}

  ngOnInit() {
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

    // ステータスと優先度のオプションを言語設定に応じて初期化
    const currentLanguage = this.languageService.getCurrentLanguage();
    this.statusOptions = [
      this.languageService.translate('taskCreate.status.notStarted'),
      this.languageService.translate('taskCreate.status.inProgress'),
      this.languageService.translate('taskCreate.status.completed'),
    ];
    this.priorityOptions = [
      this.languageService.translate('taskCreate.priority.high'),
      this.languageService.translate('taskCreate.priority.medium'),
      this.languageService.translate('taskCreate.priority.low'),
    ];
    // デフォルト値を設定
    this.taskForm.status = this.statusOptions[0];
    this.taskForm.priority = this.priorityOptions[1];

    const navState = this.location.getState() as any;
    this.projectName = navState?.projectName || '';
    this.projectId = navState?.projectId || '';
    this.returnUrl = navState?.returnUrl || '/kanban';

    // 複製データがある場合は、フォームに設定
    if (navState?.duplicateData) {
      const duplicateData = navState.duplicateData;
      this.taskForm = {
        taskName: duplicateData.taskName || '',
        status: duplicateData.status || this.statusOptions[0],
        priority: duplicateData.priority || this.priorityOptions[1],
        assignee: duplicateData.assignee || '',
        assignedMembers: Array.isArray(duplicateData.assignedMembers)
          ? [...duplicateData.assignedMembers]
          : [],
        startDate: duplicateData.startDate || '',
        dueDate: duplicateData.dueDate || '',
        tags: Array.isArray(duplicateData.tags)
          ? [...duplicateData.tags]
          : duplicateData.tags
          ? [duplicateData.tags]
          : [],
        description: duplicateData.description || '',
        calendarSyncEnabled: duplicateData.calendarSyncEnabled ?? false,
        attachments: [], // 複製時は添付ファイルは含めない
        urls: [], // 複製時はURLリンクも含めない
      };

      // assignedMembersがある場合は、selectedMemberIdsに設定
      if (
        Array.isArray(duplicateData.assignedMembers) &&
        duplicateData.assignedMembers.length > 0
      ) {
        this.selectedMemberIds = [...duplicateData.assignedMembers];
      }

      // 開始日と終了日をDateオブジェクトに変換して設定
      if (duplicateData.startDate) {
        const startDate = new Date(duplicateData.startDate);
        if (!isNaN(startDate.getTime())) {
          this.startDateObj = startDate;
        }
      }
      if (duplicateData.dueDate) {
        const dueDate = new Date(duplicateData.dueDate);
        if (!isNaN(dueDate.getTime())) {
          this.dueDateObj = dueDate;
        }
      }

      // 子タスクの複製の場合は、parentTaskIdを設定
      if (duplicateData.parentTaskId) {
        this.parentTaskId = duplicateData.parentTaskId;
        this.isSubtaskCreation = true;
      }
    }

    // プロジェクトのテーマ色を取得
    if (this.projectId) {
      this.projectService
        .getProjectById(this.projectId)
        .subscribe((project) => {
          if (project) {
            this.projectThemeColor = resolveProjectThemeColor(project);
          }
        });
    }

    // Check for parentTaskId query parameter
    this.activatedRoute.queryParams.subscribe((params) => {
      if (params['parentTaskId']) {
        this.parentTaskId = params['parentTaskId'];
        this.isSubtaskCreation = true;

        // Fetch parent task information
        if (this.projectId && this.parentTaskId) {
          this.projectService
            .getTask(this.projectId, this.parentTaskId)
            .subscribe({
              next: (task) => {
                this.parentTaskName = task.taskName || '';
                // projectName already set from navState, but can be overridden from task if needed
                if (!this.projectName && task.projectName) {
                  this.projectName = task.projectName;
                }
              },
              error: (error) => {
                console.error(
                  this.languageService.translate(
                    'taskCreate.error.parentTaskFetchFailed'
                  ),
                  error
                );
              },
            });
        }
      } else if (this.parentTaskId && this.isSubtaskCreation) {
        // duplicateDataからparentTaskIdが設定された場合も、親タスク情報を取得
        if (this.projectId && this.parentTaskId) {
          this.projectService
            .getTask(this.projectId, this.parentTaskId)
            .subscribe({
              next: (task) => {
                this.parentTaskName = task.taskName || '';
                // projectName already set from navState, but can be overridden from task if needed
                if (!this.projectName && task.projectName) {
                  this.projectName = task.projectName;
                }
              },
              error: (error) => {
                console.error(
                  this.languageService.translate(
                    'taskCreate.error.parentTaskFetchFailed'
                  ),
                  error
                );
              },
            });
        }
      }
    });

    this.loadMembers();
  }

  /**
   * メンバーフィールドを正規化（文字列、配列、その他の型に対応）
   */
  private normalizeMembersField(members: any): string {
    if (!members) {
      return '';
    }
    if (typeof members === 'string') {
      return members;
    }
    if (Array.isArray(members)) {
      return members
        .map((member: any) => member?.memberName || member?.name || '')
        .filter((name: string) => !!name)
        .join(', ');
    }
    // その他の型の場合は空文字列を返す
    return '';
  }

  loadMembers() {
    this.memberService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
        console.log('🔍 [TaskCreate] 全メンバー数:', members.length, '件');
        console.log(
          '🔍 [TaskCreate] 全メンバー一覧:',
          members.map((m) => ({ id: m.id, name: m.name }))
        );

        // プロジェクト情報を取得して、プロジェクトのメンバーのみをフィルタリング
        if (this.projectId) {
          console.log('🔍 [TaskCreate] プロジェクトID:', this.projectId);
          this.projectService.getProjectById(this.projectId).subscribe({
            next: (project) => {
              console.log('🔍 [TaskCreate] プロジェクト情報:', project);
              console.log(
                '🔍 [TaskCreate] プロジェクトのmembersフィールド:',
                project?.members,
                '型:',
                typeof project?.members
              );

              // メンバーフィールドを正規化
              const membersString = this.normalizeMembersField(
                project?.members
              );
              console.log(
                '🔍 [TaskCreate] 正規化後のmembers文字列:',
                membersString
              );

              if (membersString && membersString.trim().length > 0) {
                // プロジェクトのmembersフィールドはメンバー名のカンマ区切り文字列
                const projectMemberNames = membersString
                  .split(',')
                  .map((name) => name.trim())
                  .filter((name) => name.length > 0);

                console.log(
                  '🔍 [TaskCreate] プロジェクトのメンバー名（カンマ区切り）:',
                  projectMemberNames
                );

                // プロジェクトのメンバー名に一致するメンバーのみをフィルタリング
                this.projectMembers = members.filter((member) => {
                  const memberName = member.name || '';
                  const isIncluded = projectMemberNames.includes(memberName);
                  if (isIncluded) {
                    console.log(
                      '🔍 [TaskCreate] マッチしたメンバー:',
                      memberName,
                      'ID:',
                      member.id
                    );
                  }
                  return isIncluded;
                });

                console.log(
                  '🔍 [TaskCreate] フィルタリング後のプロジェクトメンバー数:',
                  this.projectMembers.length,
                  '件'
                );
                console.log(
                  '🔍 [TaskCreate] フィルタリング後のプロジェクトメンバー:',
                  this.projectMembers.map((m) => ({ id: m.id, name: m.name }))
                );

                // マッチしないメンバー名を確認
                const unmatchedNames = projectMemberNames.filter(
                  (name) => !members.some((m) => m.name === name)
                );
                if (unmatchedNames.length > 0) {
                  console.warn(
                    '🔍 [TaskCreate] マッチしないメンバー名（メンバー管理に存在しない）:',
                    unmatchedNames
                  );
                }
              } else {
                console.log(
                  '🔍 [TaskCreate] プロジェクトのメンバーが設定されていないか、空文字列です'
                );
                console.log(
                  '🔍 [TaskCreate] project.members:',
                  project?.members
                );
                // プロジェクトのメンバーが設定されていない場合は全メンバーを表示
                this.projectMembers = members;
              }
            },
            error: (error) => {
              console.error(
                '🔍 [TaskCreate] プロジェクト情報の取得エラー:',
                error
              );
              // エラー時は全メンバーを表示
              this.projectMembers = members;
            },
          });
        } else {
          console.log('🔍 [TaskCreate] プロジェクトIDが設定されていません');
          // プロジェクトIDがない場合は全メンバーを表示
          this.projectMembers = members;
        }
      },
      error: (error) => {
        console.error('🔍 [TaskCreate] メンバー一覧の読み込みエラー:', error);
      },
    });
  }

  onMembersSelectionChange(memberIds: string[]) {
    this.selectedMemberIds = memberIds;
    // assignedMembers（ID配列）を設定
    this.taskForm.assignedMembers = memberIds || [];

    // 後方互換性のため、最初のメンバーを assignee にも設定
    if (memberIds && memberIds.length > 0) {
      const firstMember = this.projectMembers.find(
        (m) => m.id === memberIds[0]
      );
      if (firstMember) {
        this.taskForm.assignee = firstMember.name;
      }
    } else {
      this.taskForm.assignee = '';
    }
  }

  onTagInputEnter(event: any, tagInput: HTMLInputElement) {
    event.preventDefault();
    event.stopPropagation();
    this.addTag(tagInput.value);
    tagInput.value = '';
  }

  addTag(tag: string) {
    const trimmedTag = tag?.trim();
    if (!trimmedTag) {
      return;
    }

    // タグの数が3つを超えないようにチェック
    if ((this.taskForm.tags?.length || 0) >= 3) {
      this.snackBar.open(
        this.languageService.translate('taskCreate.error.maxTagsReached'),
        this.languageService.translate('taskCreate.close'),
        { duration: 3000 }
      );
      return;
    }

    if (!this.taskForm.tags.includes(trimmedTag)) {
      this.taskForm.tags.push(trimmedTag);
    }
  }

  removeTag(tag: string) {
    this.taskForm.tags = this.taskForm.tags.filter((t) => t !== tag);
  }

  // ファイル・URL関連メソッド
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }

    // ファイルとURLの合計が3つを超えないようにチェック
    const currentTotal =
      (this.taskForm.urls?.length || 0) + this.pendingFiles.length;
    if (currentTotal >= 3) {
      this.snackBar.open(
        this.languageService.translate(
          'taskCreate.error.maxAttachmentsReached'
        ),
        this.languageService.translate('taskCreate.close'),
        { duration: 3000 }
      );
      input.value = '';
      return;
    }

    Array.from(files).forEach((file) => {
      // ファイルとURLの合計が3つを超えないようにチェック
      if ((this.taskForm.urls?.length || 0) + this.pendingFiles.length >= 3) {
        this.snackBar.open(
          this.languageService.translate(
            'taskCreate.error.maxAttachmentsReached'
          ),
          this.languageService.translate('taskCreate.close'),
          { duration: 3000 }
        );
        return;
      }

      if (file.size > this.MAX_FILE_SIZE) {
        const message = this.languageService
          .translate('taskCreate.error.fileSizeExceeded')
          .replace('{{fileName}}', file.name);
        this.snackBar.open(
          message,
          this.languageService.translate('taskCreate.close'),
          { duration: 4000 }
        );
        return;
      }
      this.pendingFiles.push({ id: this.generateId(), file });
    });

    input.value = '';
  }

  addUrl(url: string): void {
    if (url && url.trim()) {
      const trimmedUrl = url.trim();
      // URLのバリデーション：http/httpsで始まるかチェック
      if (
        !trimmedUrl.startsWith('http://') &&
        !trimmedUrl.startsWith('https://')
      ) {
        this.snackBar.open(
          this.languageService.translate('taskCreate.error.invalidUrl'),
          this.languageService.translate('taskCreate.close'),
          { duration: 3000 }
        );
        return;
      }

      // ファイルとURLの合計が3つを超えないようにチェック
      if ((this.taskForm.urls?.length || 0) + this.pendingFiles.length >= 3) {
        this.snackBar.open(
          this.languageService.translate(
            'taskCreate.error.maxAttachmentsReached'
          ),
          this.languageService.translate('taskCreate.close'),
          { duration: 3000 }
        );
        return;
      }

      if (!this.taskForm.urls.includes(trimmedUrl)) {
        this.taskForm.urls.push(trimmedUrl);
        this.newUrlInput = '';
      }
    }
  }

  removeUrl(url: string): void {
    this.taskForm.urls = this.taskForm.urls.filter((u) => u !== url);
  }

  removePendingFile(fileId: string): void {
    this.pendingFiles = this.pendingFiles.filter((f) => f.id !== fileId);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  canSaveTask(): boolean {
    // タスク名の必須チェック
    if (!this.taskForm.taskName?.trim()) {
      return false;
    }

    // 開始日と終了日の必須チェック
    if (!this.taskForm.startDate || !this.taskForm.dueDate) {
      return false;
    }

    // 担当者の必須チェック
    if (!this.selectedMemberIds || this.selectedMemberIds.length === 0) {
      return false;
    }

    return true;
  }

  onStartDateChange(): void {
    if (this.startDateObj) {
      const year = this.startDateObj.getFullYear();
      const month = String(this.startDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(this.startDateObj.getDate()).padStart(2, '0');
      this.taskForm.startDate = `${year}-${month}-${day}`;

      // 開始日から30日後の日付を計算
      const maxDueDate = new Date(this.startDateObj);
      maxDueDate.setDate(maxDueDate.getDate() + 30);
      // maxDate（当月+3か月の月末）を超えないようにする
      this.maxDueDate = maxDueDate > this.maxDate ? this.maxDate : maxDueDate;

      // 終了日が30日を超えている場合は調整
      if (this.dueDateObj && this.dueDateObj > this.maxDueDate) {
        this.dueDateObj = new Date(this.maxDueDate);
        this.onDueDateChange();
        this.snackBar.open(
          this.languageService.translate('taskCreate.error.dateRangeExceeded'),
          this.languageService.translate('common.close'),
          { duration: 3000 }
        );
      }
    } else {
      this.taskForm.startDate = '';
      this.maxDueDate = null;
    }
  }

  onDueDateChange(): void {
    if (this.dueDateObj) {
      const year = this.dueDateObj.getFullYear();
      const month = String(this.dueDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(this.dueDateObj.getDate()).padStart(2, '0');
      this.taskForm.dueDate = `${year}-${month}-${day}`;

      // 開始日から30日を超えている場合はエラー
      if (this.startDateObj && this.dueDateObj) {
        const daysDiff = Math.floor(
          (this.dueDateObj.getTime() - this.startDateObj.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 30) {
          const maxDueDate = new Date(this.startDateObj);
          maxDueDate.setDate(maxDueDate.getDate() + 30);
          // maxDate（当月+3か月の月末）を超えないようにする
          const limitedMaxDueDate =
            maxDueDate > this.maxDate ? this.maxDate : maxDueDate;
          this.dueDateObj = new Date(limitedMaxDueDate);
          this.onDueDateChange();
          this.snackBar.open(
            this.languageService.translate(
              'taskCreate.error.dateRangeExceeded'
            ),
            this.languageService.translate('common.close'),
            { duration: 3000 }
          );
        }
      }
    } else {
      this.taskForm.dueDate = '';
    }
  }

  async save() {
    if (!this.taskForm.taskName.trim()) {
      alert(
        this.languageService.translate('taskCreate.error.taskNameRequired')
      );
      return;
    }

    if (!this.taskForm.startDate || !this.taskForm.dueDate) {
      this.snackBar.open(
        this.languageService.translate('taskCreate.error.datesRequired'),
        this.languageService.translate('taskCreate.close'),
        {
          duration: 3000,
        }
      );
      return;
    }

    // 開始日から終了日までの期間が30日を超えていないかチェック
    if (this.startDateObj && this.dueDateObj) {
      const daysDiff = Math.floor(
        (this.dueDateObj.getTime() - this.startDateObj.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysDiff > 30) {
        this.snackBar.open(
          this.languageService.translate('taskCreate.error.dateRangeExceeded'),
          this.languageService.translate('common.close'),
          { duration: 3000 }
        );
        return;
      }
    }

    if (!this.selectedMemberIds || this.selectedMemberIds.length === 0) {
      this.snackBar.open(
        this.languageService.translate('taskCreate.error.assigneeRequired'),
        this.languageService.translate('taskCreate.close'),
        {
          duration: 3000,
        }
      );
      return;
    }

    if (!this.projectId) {
      alert(
        this.languageService.translate('taskCreate.error.projectNotSpecified')
      );
      return;
    }

    // タスク数の制限をチェック
    const isSubtask = !!this.parentTaskId;
    try {
      if (isSubtask) {
        // 子タスクの場合
        const childTaskCount = await this.taskService.getChildTaskCount(
          this.projectId,
          this.parentTaskId
        );
        const maxChildTasks = 5;
        if (childTaskCount >= maxChildTasks) {
          const message = this.languageService
            .translate('taskCreate.error.maxChildTasks')
            .replace('{{count}}', maxChildTasks.toString());
          this.snackBar.open(
            message,
            this.languageService.translate('taskCreate.close'),
            { duration: 5000 }
          );
          return;
        }
      } else {
        // 親タスクの場合
        const parentTaskCount = await this.taskService.getParentTaskCount(
          this.projectId
        );
        const maxParentTasks = 10;
        if (parentTaskCount >= maxParentTasks) {
          const message = this.languageService
            .translate('taskCreate.error.maxParentTasks')
            .replace('{{count}}', maxParentTasks.toString());
          this.snackBar.open(
            message,
            this.languageService.translate('taskCreate.close'),
            { duration: 5000 }
          );
          return;
        }
      }
    } catch (error) {
      console.error('Task count check error:', error);
      this.snackBar.open(
        this.languageService.translate('taskCreate.error.taskCountCheckFailed'),
        this.languageService.translate('taskCreate.close'),
        {
          duration: 3000,
        }
      );
      return;
    }

    // タスク名の重複チェック
    const taskName = this.taskForm.taskName.trim();
    if (taskName) {
      try {
        if (isSubtask) {
          // 子タスクの場合
          const exists = await this.taskService.childTaskNameExists(
            this.projectId,
            this.parentTaskId,
            taskName
          );
          if (exists) {
            this.snackBar.open(
              this.languageService.translate(
                'taskCreate.error.childTaskNameExists'
              ),
              this.languageService.translate('taskCreate.close'),
              {
                duration: 5000,
              }
            );
            return;
          }
        } else {
          // 親タスクの場合
          const exists = await this.taskService.taskNameExists(
            this.projectId,
            taskName
          );
          if (exists) {
            this.snackBar.open(
              this.languageService.translate('taskCreate.error.taskNameExists'),
              this.languageService.translate('taskCreate.close'),
              {
                duration: 5000,
              }
            );
            return;
          }
        }
      } catch (error) {
        console.error('タスク名重複チェックエラー:', error);
        // エラーが発生してもタスク作成は続行
      }
    }

    this.isSaving = true;
    try {
      console.log('[save] タスク作成開始:', {
        projectId: this.projectId,
        parentTaskId: this.parentTaskId,
        isSubtask: !!this.parentTaskId,
        pendingFilesCount: this.pendingFiles.length,
        urlsCount: this.taskForm.urls?.length || 0,
      });

      // Step 1: タスクを作成（URL は含める）
      const taskDataToCreate = {
        ...this.taskForm,
        projectName: this.projectName,
        attachments: [], // 初期値は空配列
        ...(this.parentTaskId && { parentTaskId: this.parentTaskId }),
      };

      console.log('[save] Step 1開始: タスク作成', {
        taskDataToCreate: {
          ...taskDataToCreate,
          attachments: taskDataToCreate.attachments,
          urls: taskDataToCreate.urls,
          parentTaskId: taskDataToCreate.parentTaskId,
        },
        parentTaskId: this.parentTaskId,
        isSubtask: !!this.parentTaskId,
      });

      const result = await this.projectService.addTaskToProject(
        this.projectId,
        taskDataToCreate
      );
      const taskId = result.id;
      console.log('[save] Step 1完了: タスク作成成功', {
        taskId,
        projectId: this.projectId,
        parentTaskId: this.parentTaskId,
        createdTaskParentTaskId: taskDataToCreate.parentTaskId,
      });

      // 子タスクの場合、作成したタスクが正しく保存されているか確認
      if (this.parentTaskId) {
        console.log('[save] 子タスク作成確認: Firestoreから取得', {
          taskId,
          projectId: this.projectId,
          expectedParentTaskId: this.parentTaskId,
        });
        try {
          // 作成したタスクをFirestoreから取得して確認
          const taskRef = doc(
            this.firestore,
            `projects/${this.projectId}/tasks/${taskId}`
          );
          const taskDoc = await getDoc(taskRef);
          if (taskDoc.exists()) {
            const taskData = taskDoc.data();
            console.log('[save] 作成した子タスクの確認:', {
              taskId,
              savedParentTaskId: taskData['parentTaskId'],
              expectedParentTaskId: this.parentTaskId,
              match: taskData['parentTaskId'] === this.parentTaskId,
              allTaskData: taskData,
            });
            if (taskData['parentTaskId'] !== this.parentTaskId) {
              console.error('[save] 警告: parentTaskIdが一致しません', {
                saved: taskData['parentTaskId'],
                expected: this.parentTaskId,
              });
            }
          } else {
            console.error(
              '[save] エラー: 作成したタスクがFirestoreに見つかりません',
              {
                taskId,
              }
            );
          }
        } catch (verifyError: any) {
          console.error('[save] 子タスク確認エラー:', verifyError);
          // エラーが発生しても続行
        }
      }

      // Step 2: カレンダー連携が有効で期日が設定されている場合、Googleカレンダーに追加
      if (this.taskForm.calendarSyncEnabled && this.taskForm.dueDate) {
        try {
          await this.calendarService.addTaskToCalendar(
            this.taskForm.taskName,
            this.taskForm.dueDate
          );
          console.log('カレンダー連携: Googleカレンダーにタスクを追加しました');

          // カレンダー連携が成功した場合、タスクの calendarSyncEnabled フラグを確実に保存
          await this.projectService.updateTask(this.projectId, taskId, {
            calendarSyncEnabled: true,
          });
          console.log('カレンダー連携フラグを保存しました');
        } catch (error: any) {
          console.error('Calendar sync error:', error);
          const errorMsg =
            error?.message ||
            this.languageService.translate('taskCreate.error.saveFailed');
          const message = this.languageService
            .translate('taskCreate.error.calendarSyncFailed')
            .replace('{{error}}', errorMsg);
          this.snackBar.open(
            message,
            this.languageService.translate('taskCreate.close'),
            { duration: 5000 }
          );
          // エラーが発生した場合、calendarSyncEnabled を false に設定
          await this.projectService.updateTask(this.projectId, taskId, {
            calendarSyncEnabled: false,
          });
        }
      }

      // Step 3: ペンディングファイルをアップロード
      let uploadedAttachments: any[] = [];
      if (this.pendingFiles.length > 0) {
        console.log('[save] Step 3開始: ファイルアップロード', {
          pendingFilesCount: this.pendingFiles.length,
          taskId,
          projectId: this.projectId,
        });
        this.isUploading = true;
        try {
          uploadedAttachments = await this.uploadPendingFiles(taskId);
          console.log('[save] ファイルアップロード完了:', {
            uploadedCount: uploadedAttachments.length,
            uploadedAttachments,
          });

          // Step 4: アップロードされたファイル情報でタスクを更新
          if (uploadedAttachments.length > 0) {
            console.log('[save] Step 4開始: タスクの添付ファイル情報を更新', {
              taskId,
              projectId: this.projectId,
              attachmentsCount: uploadedAttachments.length,
            });
            try {
              // attachments配列にundefinedが含まれていないか確認
              const validAttachments = uploadedAttachments.filter(
                (att) => att !== undefined && att !== null
              );
              console.log('[save] 有効な添付ファイル:', {
                originalCount: uploadedAttachments.length,
                validCount: validAttachments.length,
                validAttachments,
              });

              if (validAttachments.length > 0) {
                await this.projectService.updateTask(
                  this.projectId,
                  taskId,
                  {
                    attachments: validAttachments,
                  },
                  true
                ); // skipLogging: true - 作成直後の添付ファイル更新はログに記録しない
                console.log('[save] タスクの添付ファイル情報を更新しました');
              } else {
                console.warn(
                  '[save] 有効な添付ファイルが0件のため、更新をスキップしました'
                );
              }
            } catch (updateError: any) {
              console.error('[save] タスク更新エラー:', updateError);
              console.error('[save] エラー詳細:', {
                errorMessage: updateError?.message,
                errorCode: updateError?.code,
                taskId,
                projectId: this.projectId,
                attachments: uploadedAttachments,
              });
              // タスク更新エラーは警告として記録するが、タスク作成は成功とみなす
              this.snackBar.open(
                this.languageService.translate(
                  'taskCreate.error.attachmentUpdateFailed'
                ) ||
                  'ファイル情報の更新に失敗しましたが、タスクは作成されました',
                this.languageService.translate('taskCreate.close'),
                { duration: 5000 }
              );
            }
          } else {
            // ファイルが選択されていたが、アップロードに失敗した場合
            console.warn(
              '[save] ファイルのアップロードに失敗しましたが、タスクは作成されました',
              {
                pendingFilesCount: this.pendingFiles.length,
              }
            );
          }
        } catch (error: any) {
          console.error('[save] ファイルアップロード処理エラー:', error);
          console.error('[save] エラー詳細:', {
            errorMessage: error?.message,
            errorCode: error?.code,
            taskId,
            projectId: this.projectId,
          });
          // ファイルアップロードエラーは警告として記録するが、タスク作成は成功とみなす
          // エラーメッセージはuploadPendingFiles内で既に表示されている
        } finally {
          this.isUploading = false;
        }
      }

      // Step 5: リスト初期化
      this.pendingFiles = [];
      this.taskForm.urls = [];

      console.log('[save] Step 5完了: 処理完了', {
        taskId,
        projectId: this.projectId,
        parentTaskId: this.parentTaskId,
        isSubtask: !!this.parentTaskId,
      });

      // 作成したタスク詳細画面に遷移
      console.log('[save] 作成したタスク詳細画面に遷移:', {
        projectId: this.projectId,
        parentTaskId: this.parentTaskId,
        createdTaskId: taskId,
        isSubtask: !!this.parentTaskId,
      });
      // Firestoreの同期を待つため、少し待機してから遷移
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('[save] 遷移実行:', {
        projectId: this.projectId,
        taskId,
      });
      // 作成したタスク詳細画面に遷移
      this.router.navigate(['/project', this.projectId, 'task', taskId], {
        replaceUrl: true,
      });
    } catch (error: any) {
      console.error('[save] タスク作成失敗:', error);
      console.error('[save] エラー詳細:', {
        errorMessage: error?.message,
        errorCode: error?.code,
        errorStack: error?.stack,
        projectId: this.projectId,
        parentTaskId: this.parentTaskId,
        taskForm: {
          taskName: this.taskForm.taskName,
          startDate: this.taskForm.startDate,
          dueDate: this.taskForm.dueDate,
        },
      });
      // タスク作成失敗時はコンソールにエラーを記録（メッセージは表示しない）
    } finally {
      this.isSaving = false;
      this.isUploading = false;
    }
  }

  /** ペンディングファイルをアップロード */
  private async uploadPendingFiles(taskId: string): Promise<any[]> {
    console.log('[uploadPendingFiles] 開始:', {
      taskId,
      pendingFilesCount: this.pendingFiles.length,
      pendingFiles: this.pendingFiles.map((p) => ({
        id: p.id,
        fileName: p.file.name,
        fileSize: p.file.size,
      })),
    });

    const uploaded: any[] = [];
    const filesToUpload = [...this.pendingFiles]; // コピーを作成（後でクリアするため）

    for (const pending of filesToUpload) {
      console.log('[uploadPendingFiles] ファイルアップロード開始:', {
        fileName: pending.file.name,
        fileSize: pending.file.size,
        fileType: pending.file.type,
        taskId,
      });
      try {
        const attachment = await this.attachmentService.uploadAttachment(
          taskId,
          pending.file
        );
        console.log('[uploadPendingFiles] ファイルアップロード成功:', {
          fileName: pending.file.name,
          attachment,
        });
        if (attachment) {
          uploaded.push(attachment);
        } else {
          console.warn(
            '[uploadPendingFiles] アップロード結果がnull/undefined:',
            {
              fileName: pending.file.name,
            }
          );
        }
      } catch (error: any) {
        console.error('[uploadPendingFiles] ファイルアップロード失敗:', {
          fileName: pending.file.name,
          error: error?.message || error,
          errorCode: error?.code,
          errorStack: error?.stack,
        });
        const message = this.languageService
          .translate('taskCreate.error.attachmentUploadFailed')
          .replace('{{fileName}}', pending.file.name);
        this.snackBar.open(
          message,
          this.languageService.translate('taskCreate.close'),
          { duration: 4000 }
        );
        // エラーが発生しても続行（他のファイルのアップロードを試みる）
      }
    }

    console.log('[uploadPendingFiles] 完了:', {
      uploadedCount: uploaded.length,
      uploadedAttachments: uploaded,
      failedCount: filesToUpload.length - uploaded.length,
    });

    // アップロードが完了したファイルをpendingFilesから削除
    // アップロードに失敗したファイルは残す（ユーザーに再試行の機会を与える）
    const beforeFilterCount = this.pendingFiles.length;
    this.pendingFiles = this.pendingFiles.filter((pending) => {
      return !filesToUpload.some(
        (uploadedFile) => uploadedFile.id === pending.id
      );
    });
    console.log('[uploadPendingFiles] pendingFiles更新:', {
      beforeCount: beforeFilterCount,
      afterCount: this.pendingFiles.length,
      removedCount: beforeFilterCount - this.pendingFiles.length,
    });

    return uploaded;
  }

  cancel() {
    this.goBack();
  }

  goBack() {
    if (!this.projectId) {
      // プロジェクトIDがない場合は、カンバンに戻る
      this.router.navigate(['/kanban']);
      return;
    }

    // 子タスクの場合は親タスク詳細へ、親タスクの場合はプロジェクト詳細へ
    if (this.parentTaskId) {
      // 子タスク: 親タスク詳細へ
      this.router.navigate([
        '/project',
        this.projectId,
        'task',
        this.parentTaskId,
      ]);
    } else {
      // 親タスク: プロジェクト詳細へ
      this.router.navigate(['/project', this.projectId]);
    }
  }
}
