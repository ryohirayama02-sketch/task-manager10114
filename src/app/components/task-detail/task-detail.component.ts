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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Auth } from '@angular/fire/auth';
import { ProjectService } from '../../services/project.service';
import { TaskService } from '../../services/task.service';
import { MemberManagementService } from '../../services/member-management.service';
import { CalendarService } from '../../services/calendar.service';
import { TaskAttachmentService } from '../../services/task-attachment.service';
import { TaskFormComponent } from '../task-form/task-form.component';
import { Task, Project, ChatMessage, TaskAttachment } from '../../models/task.model';
import { Member } from '../../models/member.model';
import { ProjectChatComponent } from '../project-chat/project-chat.component';
import {
  DEFAULT_PROJECT_THEME_COLOR,
  resolveProjectThemeColor,
} from '../../constants/project-theme-colors';

import { TranslatePipe } from '../../pipes/translate.pipe';

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
    MatDialogModule,
    MatTabsModule,
    MatExpansionModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatSnackBarModule,
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
  private dialog = inject(MatDialog);
  private location = inject(Location);
  private auth = inject(Auth);
  private calendarService = inject(CalendarService);
  private snackBar = inject(MatSnackBar);
  private attachmentService = inject(TaskAttachmentService);

  @Output() taskUpdated = new EventEmitter<any>();

  task: Task | null = null;
  project: Project | null = null;
  isEditing = false;
  isDetailSettingsOpen = false;
  isLoading = true;
  isSaving = false;
  isCalendarSyncSaving = false;

  // メンバー関連
  members: Member[] = [];
  selectedMemberId: string = '';
  membersLoading = false;
  notificationRecipientOptions: string[] = [];
  childTasks: Task[] = [];
  filteredChildTasks: Task[] = [];
  childFilterStatus = '';
  childFilterPriority = '';
  childFilterAssignee = '';
  childFilterDueDate = '';
  childAssigneeOptions: string[] = [];
  projectThemeColor = DEFAULT_PROJECT_THEME_COLOR;
  parentTaskName: string | null = null;
  projectMembers: Member[] = [];
  selectedAssignedMemberIds: string[] = [];

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
  hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i.toString().padStart(2, '0'),
    label: i.toString().padStart(2, '0'),
  }));
  minuteOptions = Array.from({ length: 60 }, (_, i) => ({
    value: i.toString().padStart(2, '0'),
    label: i.toString().padStart(2, '0'),
  }));
  estimatedHours = { hour: '00', minute: '00' };
  actualHours = { hour: '00', minute: '00' };

  // ステータスと優先度のオプション
  statusOptions = ['未着手', '作業中', '完了'];
  priorityOptions = ['高', '中', '低'];

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const taskId = params.get('taskId');
      const projectId = params.get('projectId');

      console.log('ルートパラメータ:', { taskId, projectId });

      if (taskId && projectId) {
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
  }

  /** タスク詳細を読み込み */
  loadTaskDetails(projectId: string, taskId: string) {
    console.log('タスク詳細を読み込み中...', { projectId, taskId });
    this.parentTaskName = null;

    // プロジェクト情報とタスク情報を並行して取得
    this.projectService.getProjectById(projectId).subscribe((project) => {
      console.log('プロジェクト情報:', project);
      this.project = project;
      this.projectThemeColor = resolveProjectThemeColor(project);
      this.updateNotificationRecipientOptions();
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
        this.task = tasksWithProjectId.find((t) => t.id === taskId);
        console.log('見つかったタスク:', this.task);

        if (this.task) {
          this.taskData = {
            projectId: this.task.projectId || projectId,
            projectName: this.task.projectName || '',
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
            assignedMembers: this.task.assignedMembers || [],
            urls: this.task.urls || [],
          };
          // 添付ファイルを初期化
          this.editableAttachments = (this.task.attachments || []).map(
            (attachment) => ({ ...attachment })
          );
          this.initializeDetailSettings((this.task as any).detailSettings);
          this.updateNotificationRecipientOptions();
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

        this.updateNotificationRecipientOptions();
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

  /** プロジェクトメンバーを読み込み */
  private loadProjectMembers(projectId: string): void {
    this.membersLoading = true;
    this.memberService.getMembers().subscribe({
      next: (members) => {
        this.projectMembers = members;
        this.membersLoading = false;
        console.log(
          'プロジェクトメンバーを読み込みました:',
          members.length,
          '件'
        );
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
  }

  getMemberNameById(memberId: string): string {
    const member = this.projectMembers.find((m) => m.id === memberId);
    return member ? member.name : memberId;
  }

  /** 編集モードを切り替え */
  toggleEdit() {
    if (this.isEditing) {
      // 編集中から読み取りモードへ
      this.saveTask();
    } else {
      // 読み取りモードから編集中へ
      this.isEditing = true;
    }
  }

  /** タスクを保存 */
  async saveTask() {
    if (!this.task || !this.task.projectId || !this.task.id) {
      return;
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
      this.taskData.attachments = this.editableAttachments;

      await this.taskService.updateTask(
        this.task.id,
        this.taskData,
        this.task,
        this.task.projectId
      );

      console.log('タスクが更新されました');
      this.isEditing = false;
      this.isSaving = false;
    } catch (error: Error | unknown) {
      console.error('タスク更新エラー:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      alert(`タスクの保存に失敗しました: ${errorMessage}`);
      this.isSaving = false;
    }
  }

  /** キャンセル */
  cancel() {
    console.log('編集をキャンセルします');
    this.isEditing = false;

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
      this.selectedAssignedMemberIds = [];
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
    this.isDetailSettingsOpen = true;
  }

  /** 詳細設定を閉じる */
  closeDetailSettings() {
    this.isDetailSettingsOpen = false;
  }

  /** 子タスクを作成 */
  createSubtask() {
    if (this.task?.parentTaskId) {
      return;
    }

    const ref = this.dialog.open(TaskFormComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
      data: {
        projectName: this.project?.projectName,
        parentTaskId: this.task?.id,
        parentTaskName: this.task?.taskName,
      },
    });

    ref.afterClosed().subscribe((result) => {
      if (result && this.task) {
        // 子タスクとして保存
        this.projectService
          .addTaskToProject(this.task.projectId, {
            ...result,
            parentTaskId: this.task.id,
          })
          .then(() => {
            console.log('子タスクが作成されました');
            if (this.task && this.task.projectId && this.task.id) {
              this.loadTaskDetails(this.task.projectId, this.task.id);
            }
          });
      }
    });
  }

  /** タスクを複製 */
  duplicateTask() {
    const ref = this.dialog.open(TaskFormComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
      data: {
        projectName: this.project?.projectName,
        duplicateData: this.taskData,
      },
    });

    ref.afterClosed().subscribe((result) => {
      if (result && this.task) {
        this.projectService
          .addTaskToProject(this.task.projectId, result)
          .then(() => {
            console.log('タスクが複製されました');
          });
      }
    });
  }

  /** タスクを削除 */
  deleteTask() {
    if (
      confirm(
        `タスク「${this.taskData.taskName}」を削除してもよろしいですか？この操作は元に戻せません。`
      )
    ) {
      if (this.task && this.task.projectId && this.task.id) {
        this.taskService
          .deleteTask(this.task.id, this.taskData, this.task.projectId)
          .then(() => {
            console.log('タスクが削除されました');
            this.goBack();
          })
          .catch((error: Error) => {
            console.error('タスク削除エラー:', error);
            alert('タスクの削除に失敗しました');
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

    const nextValue = !(this.taskData.calendarSyncEnabled ?? false);
    this.taskData.calendarSyncEnabled = nextValue;
    this.isCalendarSyncSaving = true;

    try {
      // ON の場合のみ Googleカレンダーにタスクを追加
      if (nextValue) {
        await this.calendarService.addTaskToCalendar(
          this.taskData.taskName,
          this.taskData.dueDate
        );
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

      const errorMsg = error?.message || 'エラーが発生しました';
      alert(`カレンダー連携に失敗しました: ${errorMsg}`);
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

    if (nextValue) {
      this.ensureNotificationRecipients();
    }

    this.updateNotificationRecipientOptions();
  }

  onNotificationRecipientsChange(): void {
    if (!this.detailSettings.notifications.recipients) {
      this.detailSettings.notifications.recipients = [];
    }

    this.detailSettings.notifications.recipients = Array.from(
      new Set(
        this.detailSettings.notifications.recipients
          .map((name) => name?.trim())
          .filter((name): name is string => !!name)
      )
    );

    this.updateNotificationRecipientOptions();
  }

  onEstimatedTimeChange(): void {
    this.detailSettings.workTime.estimatedHours = `${this.estimatedHours.hour}:${this.estimatedHours.minute}`;
  }

  onActualTimeChange(): void {
    this.detailSettings.workTime.actualHours = `${this.actualHours.hour}:${this.actualHours.minute}`;
  }

  /** タグを追加 */
  addTag(tag: string) {
    if (tag && this.taskData.tags && !this.taskData.tags.includes(tag)) {
      this.taskData.tags.push(tag);
    }
  }

  /** タグを削除 */
  removeTag(tag: string) {
    if (this.taskData.tags) {
      this.taskData.tags = this.taskData.tags.filter((t: string) => t !== tag);
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

      if (this.detailSettings.notifications.recipients) {
        this.detailSettings.notifications.recipients = Array.from(
          new Set(
            this.detailSettings.notifications.recipients
              .map((name) => name?.trim())
              .filter((name) => !!name)
          )
        );
      }

      this.updateNotificationRecipientOptions();

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
          this.closeDetailSettings();
        });
    }
  }

  /** 戻る */
  goBack() {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/kanban']);
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
        actualHours: '00:00',
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

    const storedRecipients = storedSettings?.notifications?.recipients;
    if (Array.isArray(storedRecipients)) {
      this.detailSettings.notifications.recipients = storedRecipients
        .map((rec: any) =>
          typeof rec === 'string'
            ? rec
            : rec?.name || rec?.label || rec?.email || ''
        )
        .filter(Boolean);
    } else if (!this.detailSettings.notifications.recipients) {
      this.detailSettings.notifications.recipients = [];
    }

    if (this.detailSettings.notifications.beforeDeadline) {
      this.ensureNotificationRecipients();
    }
    this.updateNotificationRecipientOptions();
    void this.reopenParentTaskIfNeeded(this.childTasks);
  }

  private ensureNotificationRecipients(): void {
    if (!this.detailSettings.notifications.recipients) {
      this.detailSettings.notifications.recipients = [];
    }

    if (
      this.detailSettings.notifications.recipients.length === 0 &&
      this.detailSettings.notifications.beforeDeadline
    ) {
      const defaults = this.getDefaultNotificationRecipients();
      if (defaults.length > 0) {
        this.detailSettings.notifications.recipients = defaults;
      }
    }
  }

  private getDefaultNotificationRecipients(): string[] {
    const set = new Set<string>();
    if (this.taskData.assignee) {
      set.add(this.taskData.assignee);
    }
    return Array.from(set);
  }

  private async reopenParentTaskIfNeeded(children: Task[]): Promise<void> {
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

    alert(
      `「親タスク：${
        this.task.taskName || '名称未設定'
      }」のステータスを作業中に変更します`
    );

    const previousStatus = this.task.status;
    this.task.status = '作業中';
    this.taskData.status = '作業中';

    try {
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
    }
  }

  private setupChildTasks(tasks: Task[], parentId: string): void {
    const children = this.sortTasksByDueDate(
      tasks.filter((task) => task.parentTaskId === parentId)
    );
    this.childTasks = children;
    this.childAssigneeOptions = [
      ...new Set(
        children.map((task) => task.assignee).filter((name) => !!name)
      ),
    ];

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

    void this.reopenParentTaskIfNeeded(children);
  }

  applyChildFilter(): void {
    const filtered = this.childTasks.filter((task) => {
      const statusMatch =
        !this.childFilterStatus || task.status === this.childFilterStatus;
      const priorityMatch =
        !this.childFilterPriority || task.priority === this.childFilterPriority;
      const assigneeMatch =
        !this.childFilterAssignee ||
        task.assignee
          .toLowerCase()
          .includes(this.childFilterAssignee.toLowerCase());
      const dueDateMatch =
        !this.childFilterDueDate || task.dueDate === this.childFilterDueDate;

      return statusMatch && priorityMatch && assigneeMatch && dueDateMatch;
    });

    this.filteredChildTasks = this.sortTasksByDueDate(filtered);
  }

  resetChildFilter(): void {
    this.childFilterStatus = '';
    this.childFilterPriority = '';
    this.childFilterAssignee = '';
    this.childFilterDueDate = '';
    this.filteredChildTasks = [...this.childTasks];
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
      alert('出力する子タスクがありません');
      return;
    }

    const csvData = this.generateChildCSVData();
    const parentName = this.taskData.taskName || 'task';
    this.downloadCSV(csvData, `${parentName}_subtasks.csv`);
  }

  private generateChildCSVData(): string {
    const headers = [
      'タスク名',
      'ステータス',
      '期日',
      '優先度',
      '担当者',
      '開始日',
      '説明',
    ];
    const rows = this.filteredChildTasks.map((task) => [
      task.taskName,
      task.status,
      task.dueDate,
      task.priority,
      task.assignee,
      task.startDate,
      task.description || '',
    ]);

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

  updateNotificationRecipientOptions(): void {
    const options = new Set<string>();

    if (this.taskData.assignee) {
      options.add(this.taskData.assignee);
    }

    if (this.project?.responsible) {
      options.add(this.project.responsible);
    }

    if (this.project?.members) {
      this.project.members
        .split(',')
        .map((name: string) => name.trim())
        .filter((name: string) => !!name)
        .forEach((name: string) => options.add(name));
    }

    (this.detailSettings.notifications.recipients || []).forEach(
      (name: string) => {
        if (name) {
          options.add(name);
        }
      }
    );

    this.notificationRecipientOptions = Array.from(options).sort((a, b) =>
      a.localeCompare(b, 'ja')
    );

    if (this.detailSettings.notifications.beforeDeadline) {
      this.ensureNotificationRecipients();
    }

    this.rebuildTimePickers();
  }

  private rebuildTimePickers(): void {
    this.estimatedHours = this.splitTimeString(
      this.detailSettings.workTime.estimatedHours
    );
    this.actualHours = this.splitTimeString(
      this.detailSettings.workTime.actualHours
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

  private async uploadPendingFiles(
    taskId: string
  ): Promise<TaskAttachment[]> {
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
