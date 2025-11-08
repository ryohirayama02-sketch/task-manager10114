import { Component, OnInit } from '@angular/core';
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
import { ProjectService } from '../../services/project.service';
import { MemberManagementService } from '../../services/member-management.service';
import { TaskAttachmentService } from '../../services/task-attachment.service';
import { CalendarService } from '../../services/calendar.service';
import { Member } from '../../models/member.model';
import { TranslatePipe } from '../../pipes/translate.pipe';

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
  isLoading = false;
  isSaving = false;

  taskForm = {
    taskName: '',
    status: '未着手',
    priority: '中',
    assignee: '',
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
  statusOptions = ['未着手', '作業中', '完了'];
  priorityOptions = ['高', '中', '低'];

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private location: Location,
    private projectService: ProjectService,
    private memberService: MemberManagementService,
    private attachmentService: TaskAttachmentService,
    private calendarService: CalendarService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    const navState = this.location.getState() as any;
    this.projectName = navState?.projectName || '';
    this.projectId = navState?.projectId || '';
    this.returnUrl = navState?.returnUrl || '/kanban';

    // 複製データがある場合は、フォームに設定
    if (navState?.duplicateData) {
      const duplicateData = navState.duplicateData;
      this.taskForm = {
        taskName: duplicateData.taskName || '',
        status: duplicateData.status || '未着手',
        priority: duplicateData.priority || '中',
        assignee: duplicateData.assignee || '',
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
        urls: Array.isArray(duplicateData.urls) 
          ? [...duplicateData.urls] 
          : duplicateData.urls 
            ? [duplicateData.urls] 
            : [],
      };

      // assignedMembersがある場合は、selectedMemberIdsに設定
      if (Array.isArray(duplicateData.assignedMembers) && duplicateData.assignedMembers.length > 0) {
        this.selectedMemberIds = [...duplicateData.assignedMembers];
      }

      // 子タスクの複製の場合は、parentTaskIdを設定
      if (duplicateData.parentTaskId) {
        this.parentTaskId = duplicateData.parentTaskId;
        this.isSubtaskCreation = true;
      }
    }

    // Check for parentTaskId query parameter
    this.activatedRoute.queryParams.subscribe((params) => {
      if (params['parentTaskId']) {
        this.parentTaskId = params['parentTaskId'];
        this.isSubtaskCreation = true;
        
        // Fetch parent task information
        if (this.projectId && this.parentTaskId) {
          this.projectService.getTask(this.projectId, this.parentTaskId).subscribe({
            next: (task) => {
              this.parentTaskName = task.taskName || '';
              // projectName already set from navState, but can be overridden from task if needed
              if (!this.projectName && task.projectName) {
                this.projectName = task.projectName;
              }
            },
            error: (error) => {
              console.error('親タスク情報の取得に失敗しました:', error);
            }
          });
        }
      } else if (this.parentTaskId && this.isSubtaskCreation) {
        // duplicateDataからparentTaskIdが設定された場合も、親タスク情報を取得
        if (this.projectId && this.parentTaskId) {
          this.projectService.getTask(this.projectId, this.parentTaskId).subscribe({
            next: (task) => {
              this.parentTaskName = task.taskName || '';
              // projectName already set from navState, but can be overridden from task if needed
              if (!this.projectName && task.projectName) {
                this.projectName = task.projectName;
              }
            },
            error: (error) => {
              console.error('親タスク情報の取得に失敗しました:', error);
            }
          });
        }
      }
    });

    this.loadMembers();
  }

  loadMembers() {
    this.memberService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
      },
    });
  }

  onMembersSelectionChange(memberIds: string[]) {
    this.selectedMemberIds = memberIds;
    this.taskForm.assignee = this.selectedMemberIds
      .map((id) => this.members.find((m) => m.id === id)?.name)
      .join(', ');
  }

  onTagInputEnter(event: any, tagInput: HTMLInputElement) {
    event.preventDefault();
    event.stopPropagation();
    this.addTag(tagInput.value);
    tagInput.value = '';
  }

  addTag(tag: string) {
    const trimmedTag = tag?.trim();
    if (trimmedTag && !this.taskForm.tags.includes(trimmedTag)) {
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

    Array.from(files).forEach((file) => {
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

  addUrl(url: string): void {
    if (url && url.trim()) {
      const trimmedUrl = url.trim();
      // URLのバリデーション：http/httpsで始まるかチェック
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        this.snackBar.open(
          'URLはhttp://またはhttps://で始まる必要があります',
          '閉じる',
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

  async save() {
    if (!this.taskForm.taskName.trim()) {
      alert('タスク名を入力してください');
      return;
    }

    if (!this.projectId) {
      alert('プロジェクトが指定されていません');
      return;
    }

    this.isSaving = true;
    try {
      // Step 1: タスクを作成（URL は含める）
      const taskDataToCreate = {
        ...this.taskForm,
        projectName: this.projectName,
        attachments: [], // 初期値は空配列
        ...(this.parentTaskId && { parentTaskId: this.parentTaskId }),
      };

      const result = await this.projectService.addTaskToProject(
        this.projectId,
        taskDataToCreate
      );
      const taskId = result.id;
      console.log('タスク作成成功:', taskId);

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
          console.error('カレンダー連携エラー:', error);
          const errorMsg = error?.message || 'エラーが発生しました';
          this.snackBar.open(
            `カレンダー連携に失敗しました: ${errorMsg}`,
            '閉じる',
            { duration: 5000 }
          );
          // エラーが発生した場合、calendarSyncEnabled を false に設定
          await this.projectService.updateTask(this.projectId, taskId, {
            calendarSyncEnabled: false,
          });
        }
      }

      // Step 3: ペンディングファイルをアップロード
      if (this.pendingFiles.length > 0) {
        this.isUploading = true;
        const uploadedAttachments = await this.uploadPendingFiles(taskId);
        
        // Step 4: アップロードされたファイル情報でタスクを更新
        if (uploadedAttachments.length > 0) {
          await this.projectService.updateTask(this.projectId, taskId, {
            attachments: uploadedAttachments,
          });
          console.log('タスクの添付ファイル情報を更新しました');
        }
        this.isUploading = false;
      }

      // Step 5: リスト初期化
      this.pendingFiles = [];
      this.taskForm.urls = [];

      // If this is a subtask creation, navigate to parent task detail
      if (this.parentTaskId) {
        this.router.navigate(
          ['/project', this.projectId, 'task', this.parentTaskId],
          { replaceUrl: true }
        );
      } else {
        this.goBack();
      }
    } catch (error) {
      console.error('タスク追加失敗:', error);
      alert('保存に失敗しました');
    } finally {
      this.isSaving = false;
      this.isUploading = false;
    }
  }

  /** ペンディングファイルをアップロード */
  private async uploadPendingFiles(taskId: string): Promise<any[]> {
    const uploaded: any[] = [];

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

  cancel() {
    this.goBack();
  }

  goBack() {
    if (this.returnUrl) {
      this.router.navigateByUrl(this.returnUrl);
    } else {
      this.location.back();
    }
  }
}
