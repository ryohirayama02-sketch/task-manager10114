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
import { TaskFormComponent } from '../task-form/task-form.component';
import { Task, Project, ChatMessage } from '../../models/task.model';

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
  ],
  templateUrl: './task-detail.component.html',
  styleUrl: './task-detail.component.css',
})
export class TaskDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private taskService = inject(TaskService);
  private dialog = inject(MatDialog);

  @Output() taskUpdated = new EventEmitter<any>();

  task: Task | null = null;
  project: Project | null = null;
  isEditing = false;
  isDetailSettingsOpen = false;
  isLoading = true;
  isSaving = false;

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
    tags: [],
    relatedFiles: [],
    chatMessages: [],
  };

  // 詳細設定
  detailSettings = {
    notifications: {
      beforeDeadline: true,
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

  // ステータスと優先度のオプション
  statusOptions = ['未着手', '作業中', '完了'];
  priorityOptions = ['高', '中', '低'];

  ngOnInit() {
    const taskId = this.route.snapshot.paramMap.get('taskId');
    const projectId = this.route.snapshot.paramMap.get('projectId');

    console.log('ルートパラメータ:', { taskId, projectId });

    if (taskId && projectId) {
      this.loadTaskDetails(projectId, taskId);
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
            tags: this.task.tags || [],
            relatedFiles: this.task.relatedFiles || [],
            chatMessages: (this.task.chatMessages || []).map((msg) => ({
              ...msg,
              timestamp:
                typeof msg.timestamp === 'string'
                  ? new Date(msg.timestamp)
                  : msg.timestamp,
            })),
          };
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

  /** 編集モードを切り替え */
  toggleEdit() {
    this.isEditing = !this.isEditing;
    console.log('編集モード:', this.isEditing ? 'ON' : 'OFF');
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
      chatMessages: (this.taskData.chatMessages || []).map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      })),
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
      chatMessages: Array.isArray(updatedTask.chatMessages),
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
        chatMessages: (this.task.chatMessages || []).map((msg) => ({
          ...msg,
          timestamp:
            typeof msg.timestamp === 'string'
              ? new Date(msg.timestamp)
              : msg.timestamp,
        })),
      };
      console.log('データを元に戻しました');
    }
  }

  /** 詳細設定を開く */
  openDetailSettings() {
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
      width: '450px',
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

  /** カレンダー連携 */
  syncWithCalendar() {
    // カレンダー連携の実装
    console.log('カレンダー連携機能');
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

  /** チャットメッセージを追加 */
  addChatMessage(content: string) {
    if (!content.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      content: content.trim(),
      timestamp: new Date().toISOString(), // 文字列として保存
      sender: '現在のユーザー', // 実際の実装では認証されたユーザー名を使用
    };

    if (this.taskData.chatMessages) {
      this.taskData.chatMessages.push(message);
    }

    // タスクを更新
    if (this.task && this.task.projectId && this.task.id) {
      this.projectService
        .updateTask(this.task.projectId, this.task.id, {
          chatMessages: this.taskData.chatMessages,
        })
        .then(() => {
          console.log('チャットメッセージが追加されました');
        });
    }
  }

  /** 詳細設定を保存 */
  saveDetailSettings() {
    if (this.task && this.task.projectId && this.task.id) {
      this.projectService
        .updateTask(this.task.projectId, this.task.id, {
          detailSettings: this.detailSettings,
        })
        .then(() => {
          console.log('詳細設定が保存されました');
          this.closeDetailSettings();
        });
    }
  }

  /** 戻る */
  goBack() {
    this.router.navigate(['/kanban']);
  }
}
