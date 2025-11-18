import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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
import { AuthService } from '../../services/auth.service';
import { filter, take, switchMap, takeUntil } from 'rxjs/operators';
import { Subject, timer, firstValueFrom, race } from 'rxjs';
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
export class TaskCreatePageComponent implements OnInit, OnDestroy {
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
  isGoogleUser = false; // Googleでログインしているかどうか

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
  private destroy$ = new Subject<void>();
  private navigationTimeoutId: NodeJS.Timeout | null = null; // ✅ 修正: setTimeoutのクリーンアップ用

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
    private languageService: LanguageService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Googleユーザーかどうかを確認
    this.isGoogleUser = this.authService.isGoogleUser();

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

    // ✅ 修正: projectIdが空の場合のエラーメッセージを追加（queryParams購読内で処理）

    // 複製データがある場合は、フォームに設定
    if (navState?.duplicateData) {
      const duplicateData = navState.duplicateData;
      
      // ✅ 修正: statusがstatusOptionsに存在する値かどうかを検証
      const validStatus = this.statusOptions.includes(duplicateData.status)
        ? duplicateData.status
        : this.statusOptions[0];
      
      // ✅ 修正: priorityがpriorityOptionsに存在する値かどうかを検証
      const validPriority = this.priorityOptions.includes(duplicateData.priority)
        ? duplicateData.priority
        : this.priorityOptions[1];
      
      this.taskForm = {
        taskName: duplicateData.taskName || '',
        status: validStatus,
        priority: validPriority,
        assignee: duplicateData.assignee || '',
        assignedMembers: [], // 後で検証後に設定
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

      // ✅ 修正: assignedMembersがprojectMembersに存在するIDかどうかを検証
      // 注意: この時点ではprojectMembersがまだ読み込まれていない可能性があるため、
      // loadMembers()の完了後に検証する必要があるが、ここでは基本的な検証のみ行う
      if (
        Array.isArray(duplicateData.assignedMembers) &&
        duplicateData.assignedMembers.length > 0
      ) {
        // 基本的な配列のコピーを作成（後でloadMembers()完了後に検証）
        this.selectedMemberIds = [...duplicateData.assignedMembers];
        this.taskForm.assignedMembers = [...duplicateData.assignedMembers];
      }

      // ✅ 修正: 開始日と終了日をDateオブジェクトに変換して設定（範囲チェック付き）
      if (duplicateData.startDate) {
        const startDate = new Date(duplicateData.startDate);
        if (!isNaN(startDate.getTime())) {
          // ✅ 修正: minDateとmaxDateの範囲内かどうかをチェック
          if (startDate >= this.minDate && startDate <= this.maxDate) {
            this.startDateObj = startDate;
          } else {
            console.warn(
              '[ngOnInit] 複製データの開始日が範囲外です:',
              startDate,
              '範囲:',
              this.minDate,
              '-',
              this.maxDate
            );
            // 範囲外の場合はnullに設定（ユーザーが再選択する必要がある）
            this.startDateObj = null;
            this.taskForm.startDate = '';
          }
        }
      }
      if (duplicateData.dueDate) {
        const dueDate = new Date(duplicateData.dueDate);
        if (!isNaN(dueDate.getTime())) {
          // ✅ 修正: minDateとmaxDateの範囲内かどうかをチェック
          if (dueDate >= this.minDate && dueDate <= this.maxDate) {
            this.dueDateObj = dueDate;
          } else {
            console.warn(
              '[ngOnInit] 複製データの終了日が範囲外です:',
              dueDate,
              '範囲:',
              this.minDate,
              '-',
              this.maxDate
            );
            // 範囲外の場合はnullに設定（ユーザーが再選択する必要がある）
            this.dueDateObj = null;
            this.taskForm.dueDate = '';
          }
        }
      }

      // 子タスクの複製の場合は、parentTaskIdを設定
      if (duplicateData.parentTaskId) {
        this.parentTaskId = duplicateData.parentTaskId;
        this.isSubtaskCreation = true;
      }
    }

    // ✅ 修正: プロジェクトのテーマ色を取得（roomIdが設定されるまで待つ）
    if (this.projectId) {
      this.authService.currentRoomId$
        .pipe(
          filter((roomId) => !!roomId),
          take(1),
          switchMap((roomId) => {
            console.log('🔑 roomIdが設定されました（タスク作成・テーマ色）:', roomId);
            return this.projectService.getProjectById(this.projectId);
          }),
          takeUntil(this.destroy$)
        )
        .subscribe((project) => {
          if (project) {
            this.projectThemeColor = resolveProjectThemeColor(project);
          }
        });
    }

    // Check for parentTaskId query parameter
    this.activatedRoute.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
      // ✅ 修正: projectIdが空の場合、queryParamsから取得を試みる
      if (!this.projectId && params['projectId']) {
        this.projectId = params['projectId'];
      }
      // ✅ 修正: projectIdがまだ空の場合はエラーメッセージを表示
      if (!this.projectId) {
        console.warn('[TaskCreate] projectIdが設定されていません');
        this.snackBar.open(
          this.languageService.translate('taskCreate.error.projectIdRequired'),
          this.languageService.translate('taskCreate.close'),
          { duration: 5000 }
        );
        // 3秒後にカンバンに戻る
        // ✅ 修正: setTimeoutのクリーンアップ用にIDを保存
        this.navigationTimeoutId = setTimeout(() => {
          this.router.navigate(['/kanban'], { replaceUrl: true });
          this.navigationTimeoutId = null;
        }, 3000);
        return;
      }
      
      if (params['parentTaskId']) {
        this.parentTaskId = params['parentTaskId'];
        this.isSubtaskCreation = true;

        // Fetch parent task information
        if (this.projectId && this.parentTaskId) {
          this.projectService
            .getTask(this.projectId, this.parentTaskId)
            .pipe(takeUntil(this.destroy$))
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
            .pipe(takeUntil(this.destroy$))
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
    this.memberService.getMembers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (members) => {
        this.members = members;
        console.log('🔍 [TaskCreate] 全メンバー数:', members.length, '件');
        console.log(
          '🔍 [TaskCreate] 全メンバー一覧:',
          members.map((m) => ({ id: m.id, name: m.name }))
        );

        // ✅ 修正: プロジェクト情報を取得して、プロジェクトのメンバーのみをフィルタリング（roomIdが設定されるまで待つ）
        if (this.projectId) {
          console.log('🔍 [TaskCreate] プロジェクトID:', this.projectId);
          this.authService.currentRoomId$
            .pipe(
              filter((roomId) => !!roomId),
              take(1),
              switchMap((roomId) => {
                console.log('🔑 roomIdが設定されました（タスク作成・メンバー）:', roomId);
                return this.projectService.getProjectById(this.projectId);
              }),
              takeUntil(this.destroy$)
            )
            .subscribe({
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
              
              // ✅ 修正: 複製データのassignedMembersがprojectMembersに存在するIDかどうかを検証
              if (this.selectedMemberIds.length > 0) {
                const validMemberIds = this.selectedMemberIds.filter((id) =>
                  this.projectMembers.some((m) => m.id === id)
                );
                
                if (validMemberIds.length !== this.selectedMemberIds.length) {
                  console.warn(
                    '[loadMembers] 複製データのassignedMembersに無効なIDが含まれています',
                    {
                      originalIds: this.selectedMemberIds,
                      validIds: validMemberIds,
                      projectMembers: this.projectMembers.map((m) => m.id),
                    }
                  );
                }
                
                // 有効なIDのみを設定
                this.selectedMemberIds = validMemberIds;
                this.taskForm.assignedMembers = validMemberIds;
                
                // assigneeも更新
                if (validMemberIds.length > 0) {
                  const firstMember = this.projectMembers.find(
                    (m) => m.id === validMemberIds[0]
                  );
                  if (firstMember) {
                    this.taskForm.assignee = firstMember.name;
                  }
                } else {
                  this.taskForm.assignee = '';
                }
              }
            },
            error: (error) => {
              console.error(
                '🔍 [TaskCreate] プロジェクト情報の取得エラー:',
                error
              );
              // エラー時は全メンバーを表示
              this.projectMembers = members;
              
              // ✅ 修正: エラー時もassignedMembersの検証を行う
              if (this.selectedMemberIds.length > 0) {
                const validMemberIds = this.selectedMemberIds.filter((id) =>
                  this.projectMembers.some((m) => m.id === id)
                );
                this.selectedMemberIds = validMemberIds;
                this.taskForm.assignedMembers = validMemberIds;
              }
            },
          });
        } else {
          console.log('🔍 [TaskCreate] プロジェクトIDが設定されていません');
          // プロジェクトIDがない場合は全メンバーを表示
          this.projectMembers = members;
          
          // ✅ 修正: プロジェクトIDがない場合もassignedMembersの検証を行う
          if (this.selectedMemberIds.length > 0) {
            const validMemberIds = this.selectedMemberIds.filter((id) =>
              this.projectMembers.some((m) => m.id === id)
            );
            this.selectedMemberIds = validMemberIds;
            this.taskForm.assignedMembers = validMemberIds;
          }
        }
      },
      error: (error) => {
        console.error('🔍 [TaskCreate] メンバー一覧の読み込みエラー:', error);
      },
    });
  }

  onMembersSelectionChange(memberIds: string[]) {
    // ✅ 修正: 選択されたメンバーIDがprojectMembersに存在するかどうかを検証
    const validMemberIds = (memberIds || []).filter((id) =>
      this.projectMembers.some((m) => m.id === id)
    );
    
    // 無効なIDが含まれている場合は警告を表示
    if (validMemberIds.length !== (memberIds || []).length) {
      console.warn(
        '[onMembersSelectionChange] 無効なメンバーIDが含まれています',
        {
          selectedIds: memberIds,
          validIds: validMemberIds,
          projectMembers: this.projectMembers.map((m) => m.id),
        }
      );
    }
    
    this.selectedMemberIds = validMemberIds;
    // assignedMembers（ID配列）を設定（有効なIDのみ）
    this.taskForm.assignedMembers = validMemberIds;

    // 後方互換性のため、最初のメンバーを assignee にも設定
    if (validMemberIds.length > 0) {
      const firstMember = this.projectMembers.find(
        (m) => m.id === validMemberIds[0]
      );
      if (firstMember) {
        this.taskForm.assignee = firstMember.name;
      } else {
        // 念のため、見つからない場合は空文字列に設定
        this.taskForm.assignee = '';
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

    // ✅ 修正: タグの長さ制限を追加（30文字）
    const MAX_TAG_LENGTH = 30;
    if (trimmedTag.length > MAX_TAG_LENGTH) {
      this.snackBar.open(
        this.languageService.translateWithParams(
          'taskCreate.error.tagTooLong',
          { maxLength: MAX_TAG_LENGTH.toString() }
        ),
        this.languageService.translate('taskCreate.close'),
        { duration: 3000 }
      );
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

    // ✅ 修正: 重複タグ追加時にユーザーに通知
    if (!this.taskForm.tags.includes(trimmedTag)) {
      this.taskForm.tags.push(trimmedTag);
    } else {
      this.snackBar.open(
        this.languageService.translate('taskCreate.error.tagAlreadyAdded'),
        this.languageService.translate('taskCreate.close'),
        { duration: 3000 }
      );
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

      // ✅ 修正: 同じファイル名の重複チェックを追加
      const isDuplicate = this.pendingFiles.some(
        (pending) => pending.file.name === file.name && pending.file.size === file.size
      );
      if (isDuplicate) {
        this.snackBar.open(
          this.languageService.translateWithParams(
            'taskCreate.error.fileAlreadyAdded',
            { fileName: file.name }
          ),
          this.languageService.translate('taskCreate.close'),
          { duration: 3000 }
        );
        return;
      }

      if (file.size > this.MAX_FILE_SIZE) {
        // ✅ 修正: ファイルサイズエラーメッセージを国際化
        this.snackBar.open(
          this.languageService.translateWithParams(
            'taskCreate.error.fileSizeExceeded',
            { fileName: file.name }
          ),
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
      let trimmedUrl = url.trim();
      
      // ✅ 修正: URLの長さ制限を追加（2048文字）
      const MAX_URL_LENGTH = 2048;
      if (trimmedUrl.length > MAX_URL_LENGTH) {
        this.snackBar.open(
          this.languageService.translateWithParams(
            'taskCreate.error.urlTooLong',
            { maxLength: MAX_URL_LENGTH.toString() }
          ),
          this.languageService.translate('taskCreate.close'),
          { duration: 3000 }
        );
        return;
      }
      
      // ✅ 修正: プロトコルがない場合は自動的にhttps://を追加
      if (
        !trimmedUrl.startsWith('http://') &&
        !trimmedUrl.startsWith('https://')
      ) {
        trimmedUrl = 'https://' + trimmedUrl;
      }

      // ✅ 修正: プロトコル追加後の長さもチェック
      if (trimmedUrl.length > MAX_URL_LENGTH) {
        this.snackBar.open(
          this.languageService.translateWithParams(
            'taskCreate.error.urlTooLong',
            { maxLength: MAX_URL_LENGTH.toString() }
          ),
          this.languageService.translate('taskCreate.close'),
          { duration: 3000 }
        );
        return;
      }

      // URLのバリデーション：有効なURLかチェック
      try {
        new URL(trimmedUrl);
      } catch {
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

      // ✅ 修正: 重複URL追加時にユーザーに通知
      if (!this.taskForm.urls.includes(trimmedUrl)) {
        this.taskForm.urls.push(trimmedUrl);
        this.newUrlInput = '';
      } else {
        this.snackBar.open(
          this.languageService.translate('taskCreate.error.urlAlreadyAdded'),
          this.languageService.translate('taskCreate.close'),
          { duration: 3000 }
        );
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
    // ✅ 修正: 負の値やNaNの処理を追加
    if (!bytes || bytes <= 0 || isNaN(bytes)) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    // ✅ 修正: インデックスが範囲外の場合の処理を追加
    const sizeIndex = Math.min(i, sizes.length - 1);
    return Math.round((bytes / Math.pow(k, sizeIndex)) * 100) / 100 + ' ' + sizes[sizeIndex];
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

    // ✅ 修正: 日付の有効性チェックを追加
    if (this.startDateObj && isNaN(this.startDateObj.getTime())) {
      return false;
    }
    if (this.dueDateObj && isNaN(this.dueDateObj.getTime())) {
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

      // ✅ 修正: 開始日が終了日より後の場合は、終了日を開始日に合わせる
      if (this.dueDateObj && this.startDateObj > this.dueDateObj) {
        this.dueDateObj = new Date(this.startDateObj);
        const dueYear = this.dueDateObj.getFullYear();
        const dueMonth = String(this.dueDateObj.getMonth() + 1).padStart(2, '0');
        const dueDay = String(this.dueDateObj.getDate()).padStart(2, '0');
        this.taskForm.dueDate = `${dueYear}-${dueMonth}-${dueDay}`;
      }

      // 開始日から30日後の日付を計算
      const maxDueDate = new Date(this.startDateObj);
      maxDueDate.setDate(maxDueDate.getDate() + 30);
      // maxDate（当月+3か月の月末）を超えないようにする
      this.maxDueDate = maxDueDate > this.maxDate ? this.maxDate : maxDueDate;

      // 終了日が30日を超えている場合は調整
      // ✅ 修正: maxDueDateがnullの場合のチェックを追加
      if (this.dueDateObj && this.maxDueDate && this.dueDateObj > this.maxDueDate) {
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
          
          // ✅ 修正: 無限再帰を防ぐため、調整前の日付と調整後の日付が異なる場合のみ再帰呼び出し
          const adjustedDate = new Date(limitedMaxDueDate);
          const currentDate = new Date(this.dueDateObj);
          
          // 日付が実際に変更される場合のみ再帰呼び出し
          if (adjustedDate.getTime() !== currentDate.getTime()) {
            this.dueDateObj = adjustedDate;
            // 日付を更新した後、再帰的に呼び出してtaskForm.dueDateも更新
            this.onDueDateChange();
          }
          
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
    // ✅ 修正: 重複送信を防ぐ
    if (this.isSaving || this.isUploading) {
      return;
    }

    if (!this.taskForm.taskName.trim()) {
      // ✅ 修正: alert()をsnackBar.open()に変更
      this.snackBar.open(
        this.languageService.translate('taskCreate.error.taskNameRequired'),
        this.languageService.translate('taskCreate.close'),
        { duration: 3000 }
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

    // ✅ 修正: 日付が有効かどうかのチェックを追加
    if (this.startDateObj && isNaN(this.startDateObj.getTime())) {
      this.snackBar.open(
        this.languageService.translate('taskCreate.error.invalidStartDate'),
        this.languageService.translate('taskCreate.close'),
        { duration: 3000 }
      );
      return;
    }
    if (this.dueDateObj && isNaN(this.dueDateObj.getTime())) {
      this.snackBar.open(
        this.languageService.translate('taskCreate.error.invalidDueDate'),
        this.languageService.translate('taskCreate.close'),
        { duration: 3000 }
      );
      return;
    }

    // 開始日と終了日の逆転チェック
    if (this.startDateObj && this.dueDateObj) {
      if (this.startDateObj > this.dueDateObj) {
        this.snackBar.open(
          this.languageService.translate('taskCreate.error.startDateAfterDueDate'),
          this.languageService.translate('taskCreate.close'),
          {
            duration: 3000,
          }
        );
        return;
      }

      // 開始日から終了日までの期間が30日を超えていないかチェック
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
      // ✅ 修正: alert()をsnackBar.open()に変更
      this.snackBar.open(
        this.languageService.translate('taskCreate.error.projectNotSpecified'),
        this.languageService.translate('taskCreate.close'),
        { duration: 3000 }
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
          // ✅ 修正: translateWithParams()を使用して国際化対応
          this.snackBar.open(
            this.languageService.translateWithParams(
              'taskCreate.error.maxChildTasks',
              { count: maxChildTasks.toString() }
            ),
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
          // ✅ 修正: translateWithParams()を使用して国際化対応
          this.snackBar.open(
            this.languageService.translateWithParams(
              'taskCreate.error.maxParentTasks',
              { count: maxParentTasks.toString() }
            ),
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

    // ✅ 修正: 子タスク作成時にparentTaskIdの存在チェックを追加
    if (isSubtask && !this.parentTaskId) {
      this.snackBar.open(
        this.languageService.translate('taskCreate.error.parentTaskIdRequired'),
        this.languageService.translate('taskCreate.close'),
        { duration: 5000 }
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

      // ✅ 修正: assignedMembersに無効なIDが含まれていないか検証
      const validAssignedMembers = (this.taskForm.assignedMembers || []).filter(
        (id) => this.projectMembers.some((m) => m.id === id)
      );
      
      // 無効なIDが含まれている場合は警告を表示
      if (validAssignedMembers.length !== (this.taskForm.assignedMembers || []).length) {
        console.warn(
          '[save] assignedMembersに無効なIDが含まれています',
          {
            originalIds: this.taskForm.assignedMembers,
            validIds: validAssignedMembers,
            projectMembers: this.projectMembers.map((m) => m.id),
          }
        );
      }

      // Step 1: タスクを作成（URL は含める）
      const taskDataToCreate = {
        ...this.taskForm,
        taskName: this.taskForm.taskName.trim(), // ✅ 修正: trim()済みのtaskNameを使用
        description: this.taskForm.description?.trim() || '', // ✅ 修正: descriptionにtrim()を適用
        assignedMembers: validAssignedMembers, // ✅ 修正: 有効なIDのみを含める
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
      
      // ✅ 修正: taskIdがundefined/nullの場合のチェックを追加
      if (!taskId) {
        console.error('[save] タスクIDが取得できませんでした:', {
          result,
          projectId: this.projectId,
        });
        this.snackBar.open(
          this.languageService.translate('taskCreate.error.taskIdNotReturned'),
          this.languageService.translate('taskCreate.close'),
          { duration: 5000 }
        );
        return;
      }
      
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
          if (taskId) {
            await this.projectService.updateTask(this.projectId, taskId, {
              calendarSyncEnabled: true,
            });
            console.log('カレンダー連携フラグを保存しました');
          }
        } catch (error: any) {
          console.error('Calendar sync error:', error);
          const errorMsg =
            error?.message ||
            this.languageService.translate('taskCreate.error.saveFailed');
          // ✅ 修正: translateWithParams()を使用して国際化対応
          this.snackBar.open(
            this.languageService.translateWithParams(
              'taskCreate.error.calendarSyncFailed',
              { error: errorMsg }
            ),
            this.languageService.translate('taskCreate.close'),
            { duration: 5000 }
          );
          // エラーが発生した場合、calendarSyncEnabled を false に設定
          // ✅ 修正: updateTaskのエラーハンドリングを追加
          if (taskId) {
            try {
              await this.projectService.updateTask(this.projectId, taskId, {
                calendarSyncEnabled: false,
              });
            } catch (updateError: any) {
              console.error('[save] カレンダー連携フラグの更新に失敗しました:', updateError);
              // エラーが発生しても続行（タスクは既に作成されている）
            }
          }
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

              if (validAttachments.length > 0 && taskId) {
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

      // Step 5: リスト初期化（成功時のみ）
      // ✅ 修正: エラー時はデータを保持するため、成功時のみクリア
      this.pendingFiles = [];
      this.taskForm.urls = [];

      console.log('[save] Step 5完了: 処理完了', {
        taskId,
        projectId: this.projectId,
        parentTaskId: this.parentTaskId,
        isSubtask: !!this.parentTaskId,
      });

      // 作成したタスク詳細画面に遷移
      // ✅ 修正: taskIdがundefined/nullの場合のチェックを追加
      if (!taskId) {
        console.error('[save] タスクIDが取得できませんでした。プロジェクト詳細画面に遷移します。');
        this.snackBar.open(
          this.languageService.translate('taskCreate.error.taskIdNotReturned'),
          this.languageService.translate('taskCreate.close'),
          { duration: 5000 }
        );
        // タスクIDが取得できない場合はプロジェクト詳細画面に遷移
        this.router.navigate(['/project', this.projectId], {
          replaceUrl: true,
        });
        return;
      }
      
      console.log('[save] 作成したタスク詳細画面に遷移:', {
        projectId: this.projectId,
        parentTaskId: this.parentTaskId,
        createdTaskId: taskId,
        isSubtask: !!this.parentTaskId,
      });
      // Firestoreの同期を待つため、少し待機してから遷移
      // ✅ 修正: コンポーネントが破棄されていないかチェックしながら待機
      try {
        await firstValueFrom(
          race([
            timer(1000), // 1秒待機
            this.destroy$, // コンポーネントが破棄された場合は即座に完了
          ]).pipe(take(1))
        );
      } catch {
        // コンポーネントが破棄された場合はナビゲーションをスキップ
        console.log('[save] コンポーネントが破棄されたため、ナビゲーションをスキップします');
        return;
      }
      
      // ✅ 修正: コンポーネントが破棄されていないかチェック
      if (this.destroy$.closed) {
        console.log('[save] コンポーネントが破棄されたため、ナビゲーションをスキップします');
        return;
      }
      
      console.log('[save] 遷移実行:', {
        projectId: this.projectId,
        taskId,
      });
      // 作成したタスク詳細画面に遷移
      this.router.navigate(['/project', this.projectId, 'task', taskId], {
        replaceUrl: true,
      });
    } catch (error: any) {
      // ✅ 修正: エラー時はpendingFilesとurlsを保持（ユーザーが再試行できるように）
      // pendingFilesとtaskForm.urlsはクリアしない
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
      // タスク作成失敗時はユーザーにエラーメッセージを表示
      const errorMessage =
        error instanceof Error
          ? error.message
          : this.languageService.translate('taskCreate.error.unknownError');
      this.snackBar.open(
        this.languageService.translateWithParams(
          'taskCreate.error.saveFailed',
          { errorMessage }
        ),
        this.languageService.translate('taskCreate.close'),
        { duration: 5000 }
      );
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
        // ✅ 修正: エラーメッセージを国際化
        this.snackBar.open(
          this.languageService.translateWithParams(
            'taskCreate.error.attachmentUploadFailed',
            { fileName: pending.file.name }
          ),
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
    // ✅ 修正: ファイル名とサイズで比較（uploadedFile.idが存在しない可能性があるため）
    const beforeFilterCount = this.pendingFiles.length;
    const uploadedFileNames = new Set(
      uploaded.map((att) => att.name || att.fileName || '').filter(Boolean)
    );
    this.pendingFiles = this.pendingFiles.filter((pending) => {
      // アップロード成功したファイル名と一致しない場合は残す
      return !uploadedFileNames.has(pending.file.name);
    });
    console.log('[uploadPendingFiles] pendingFiles更新:', {
      beforeCount: beforeFilterCount,
      afterCount: this.pendingFiles.length,
      removedCount: beforeFilterCount - this.pendingFiles.length,
    });

    return uploaded;
  }

  cancel() {
    // ✅ 修正: 状態をリセットしてから戻る
    this.isSaving = false;
    this.isUploading = false;
    this.goBack();
  }

  goBack() {
    // ✅ 修正: 状態をリセット
    this.isSaving = false;
    this.isUploading = false;
    
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

  ngOnDestroy(): void {
    // ✅ 修正: setTimeoutのクリーンアップ
    if (this.navigationTimeoutId !== null) {
      clearTimeout(this.navigationTimeoutId);
      this.navigationTimeoutId = null;
    }
    
    this.destroy$.next();
    this.destroy$.complete();
  }
}
