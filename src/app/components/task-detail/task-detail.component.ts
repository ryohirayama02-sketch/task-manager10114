import { Component, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { ProjectService } from '../../services/project.service';
import { TaskService } from '../../services/task.service';
import { MemberManagementService } from '../../services/member-management.service';
import { TaskFormComponent } from '../task-form/task-form.component';
import { TaskEditDialogComponent } from './task-edit-dialog.component';
import { Task, Project, ChatMessage } from '../../models/task.model';
import { Member } from '../../models/member.model';
import { ProjectChatComponent } from '../project-chat/project-chat.component';

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
    TaskEditDialogComponent,
    ProjectChatComponent,
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
  };

  // 詳細設定
  detailSettings = this.createDefaultDetailSettings();

  // ステータスと優先度のオプション
  statusOptions = ['未着手', '作業中', '完了'];
  priorityOptions = ['高', '中', '低'];

  ngOnInit() {
    const taskId = this.route.snapshot.paramMap.get('taskId');
    const projectId = this.route.snapshot.paramMap.get('projectId');

    console.log('ルートパラメータ:', { taskId, projectId });

    if (taskId && projectId) {
      this.loadTaskDetails(projectId, taskId);
      this.loadMembers();
    } else {
      console.error('必要なパラメータが不足しています:', { taskId, projectId });
    }
  }

  /** タスク詳細を読み込み */
  loadTaskDetails(projectId: string, taskId: string) {
    console.log('タスク詳細を読み込み中...', { projectId, taskId });

    // プロジェクト情報とタスク情報を並行して取得
    this.projectService.getProjectById(projectId).subscribe((project) => {
      console.log('プロジェクト情報:', project);
      this.project = project;
      this.updateNotificationRecipientOptions();
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
          };
          this.initializeDetailSettings((this.task as any).detailSettings);
          this.updateNotificationRecipientOptions();
          console.log('設定されたタスクデータ:', this.taskData);
        } else {
          console.error('タスクが見つかりませんでした');
          console.log(
            '利用可能なタスクID:',
            tasks.map((t) => t.id)
          );
          console.log('検索対象のタスクID:', taskId);
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('タスク取得エラー:', error);
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

  /** 編集モードを切り替え */
  toggleEdit() {
    // 編集ダイアログを開く
    this.openEditDialog();
  }

  /** タスク編集ダイアログを開く */
  openEditDialog() {
    if (!this.task || !this.project) {
      return;
    }

    const dialogRef = this.dialog.open(TaskEditDialogComponent, {
      width: '90vw',
      maxWidth: '600px',
      maxHeight: '90vh',
      data: {
        task: this.task,
        projectId: this.project.id!,
        projectName: this.project.projectName || '',
        oldTaskData: { ...this.task }, // 古いタスクデータをコピーして渡す
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.deleted) {
        // タスクが削除された場合、プロジェクト詳細画面にリダイレクト
        this.router.navigate(['/project-detail', this.project!.id]);
      } else if (result?.success) {
        // タスクが更新された場合、データを再読み込み
        this.loadTaskDetails(this.project!.id!, this.task!.id!);
      }
    });
  }

  /** タスクを保存 */
  saveTask() {
    if (!this.task) {
      console.error('タスクが存在しません');
      return;
    }

    // バリデーション
    if (!this.taskData.taskName.trim()) {
      alert('タスク名を入力してください');
      return;
    }

    console.log('タスクを保存中...', this.taskData);

    // 更新するタスクデータを準備
    // バリデーション
    if (!this.taskData.taskName?.trim()) {
      alert('タスク名を入力してください');
      return;
    }

    const updatedTask = {
      taskName: this.taskData.taskName.trim(),
      description: this.taskData.description || '',
      startDate: this.taskData.startDate,
      dueDate: this.taskData.dueDate,
      assignee: this.taskData.assignee,
      status: this.taskData.status,
      priority: this.taskData.priority,
      tags: this.taskData.tags || [],
      relatedFiles: this.taskData.relatedFiles || [],
      updatedAt: new Date().toISOString(), // Date型を文字列に変換
    };

    // データの型チェック
    console.log('保存前のデータ検証:', {
      taskName: typeof updatedTask.taskName,
      description: typeof updatedTask.description,
      startDate: typeof updatedTask.startDate,
      dueDate: typeof updatedTask.dueDate,
      assignee: typeof updatedTask.assignee,
      status: typeof updatedTask.status,
      priority: typeof updatedTask.priority,
      tags: Array.isArray(updatedTask.tags),
      relatedFiles: Array.isArray(updatedTask.relatedFiles),
      updatedAt: typeof updatedTask.updatedAt,
    });

    // 期間の詳細ログ
    console.log('期間データの詳細:', {
      originalStartDate: this.taskData.startDate,
      originalDueDate: this.taskData.dueDate,
      updatedStartDate: updatedTask.startDate,
      updatedDueDate: updatedTask.dueDate,
    });

    // タスクを更新
    const projectId =
      this.task?.projectId || this.route.snapshot.paramMap.get('projectId');
    const taskId = this.task?.id;

    console.log('保存時のID確認:', { projectId, taskId, task: this.task });

    if (projectId && taskId) {
      this.isSaving = true;
      console.log('更新対象のタスク情報:', {
        projectId: projectId,
        taskId: taskId,
        updatedTask: updatedTask,
      });

      console.log('Firestoreに送信するデータ:', {
        projectId: projectId,
        taskId: taskId,
        updatedTask: updatedTask,
        dataType: typeof updatedTask,
        dataKeys: Object.keys(updatedTask),
      });

      this.projectService
        .updateTask(projectId, taskId, updatedTask)
        .then(() => {
          console.log('タスクが更新されました');
          // ローカルのタスクデータも更新
          this.task = {
            ...this.task!,
            ...updatedTask,
          };
          this.isEditing = false;
          this.isSaving = false;
          // 親コンポーネントに更新を通知
          this.taskUpdated.emit(this.task);
          alert('タスクが保存されました');
        })
        .catch((error) => {
          console.error('タスク更新エラーの詳細:', error);
          console.error('エラーコード:', error.code);
          console.error('エラーメッセージ:', error.message);
          console.error('エラーのスタックトレース:', error.stack);
          console.error('送信しようとしたデータ:', updatedTask);
          this.isSaving = false;
          alert(`タスクの保存に失敗しました: ${error.message}`);
        });
    } else {
      console.error('プロジェクトIDまたはタスクIDが不足しています:', {
        projectId: projectId,
        taskId: taskId,
        task: this.task,
        routeParams: {
          projectId: this.route.snapshot.paramMap.get('projectId'),
          taskId: this.route.snapshot.paramMap.get('taskId'),
        },
      });
      alert('タスクの保存に失敗しました');
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
      };
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
    const ref = this.dialog.open(TaskFormComponent, {
      width: '450px',
      data: {
        projectName: this.project?.projectName,
        parentTaskId: this.task?.id,
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
      await this.projectService.updateTask(this.task.projectId, this.task.id, {
        calendarSyncEnabled: nextValue,
        taskName: this.taskData.taskName,
      });
      this.task.calendarSyncEnabled = nextValue;
      console.log(
        `カレンダー連携を${nextValue ? 'ON' : 'OFF'}に更新しました (taskId: ${
          this.task.id
        })`
      );
    } catch (error) {
      console.error('カレンダー連携の更新に失敗しました', error);
      this.taskData.calendarSyncEnabled = !nextValue;
      this.task.calendarSyncEnabled = this.taskData.calendarSyncEnabled;
    } finally {
      this.isCalendarSyncSaving = false;
    }
  }

  /** タスク期限通知を切り替え */
  toggleTaskDeadlineNotification(): void {
    const current =
      this.detailSettings.notifications.beforeDeadline ?? true;
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
    this.router.navigate(['/kanban']);
  }

  private createDefaultDetailSettings() {
    return {
      notifications: {
        beforeDeadline: true,
        recipients: [] as string[],
        dailyReminder: false,
        weeklyReport: false,
      },
      taskOrder: {
        requireSubtaskCompletion: false,
        subtaskOrder: [] as string[],
      },
      workTime: {
        estimatedHours: 0,
        actualHours: 0,
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
  }
}
