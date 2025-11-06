import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { ProjectSelectionService } from '../../services/project-selection.service';
import { TaskFormComponent } from '../task-form/task-form.component';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../services/auth.service';
import { Task } from '../../models/task.model';
import { IProject } from '../../models/project.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { combineLatest, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatDialogModule,
    MatMenuModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatChipsModule,
    FormsModule,
    TranslatePipe,
  ],
  templateUrl: './kanban.component.html',
  styleUrls: ['./kanban.component.css'],
})
export class KanbanComponent implements OnInit {
  tasks: Task[] = [];
  projects: IProject[] = [];
  selectedProjectIds: string[] = [];
  allTasks: Task[] = []; // 全プロジェクトのタスクを保持
  statuses = ['未着手', '作業中', '完了'];

  constructor(
    private taskService: TaskService,
    private projectService: ProjectService,
    private projectSelectionService: ProjectSelectionService,
    private dialog: MatDialog,
    private router: Router,
    private languageService: LanguageService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    combineLatest([
      this.authService.currentUserEmail$,
      this.authService.currentMemberName$,
    ])
      .pipe(
        switchMap(([userEmail, userName]) => {
          console.log('🔑 現在のユーザー情報:', { userEmail, userName });
          if (!userEmail) {
            this.resetProjectState(true);
            return of([]);
          }
          return this.projectService.getUserProjects(userEmail, userName || null);
        })
      )
      .subscribe((projects) => {
        console.log('🎯 フィルタ済みプロジェクト一覧:', projects);
        this.projects = projects;

        if (projects.length === 0) {
          this.resetProjectState();
          this.projectSelectionService.clearSelection();
          return;
        }

        const storedSelection =
          this.projectSelectionService.getSelectedProjectIdsSync();
        const availableIds = new Set(
          projects
            .map((project) => project.id)
            .filter((id): id is string => !!id)
        );

        let nextSelection = storedSelection.filter((id) =>
          availableIds.has(id)
        );

        if (nextSelection.length === 0) {
          const preferredProject = projects.find(
            (p) => p.projectName === 'アプリ A改善プロジェクト'
          );
          const fallbackProject = preferredProject ?? projects[0];
          if (fallbackProject?.id) {
            nextSelection = [fallbackProject.id];
          }
        }

        if (nextSelection.length > 0) {
          this.projectSelectionService.setSelectedProjectIds(nextSelection);
        } else {
          this.projectSelectionService.clearSelection();
        }
        this.selectedProjectIds = nextSelection;

        this.loadAllTasks();
        this.filterTasksBySelectedProjects();
      });

    // プロジェクト選択状態の変更を監視
    this.projectSelectionService
      .getSelectedProjectIds()
      .subscribe((projectIds: string[]) => {
        this.selectedProjectIds = projectIds;
        this.filterTasksBySelectedProjects();
      });
  }

  /** 全プロジェクトのタスクを読み込み */
  loadAllTasks() {
    this.allTasks = [];
    this.projects.forEach((project) => {
      if (project.id) {
        this.projectService
          .getTasksByProjectId(project.id)
          .subscribe((tasks) => {
            // プロジェクト情報をタスクに追加
            const tasksWithProject = tasks.map((task) => ({
              ...task,
              projectId: task.projectId || project.id!,
              projectName: task.projectName || project.projectName,
            }));

            // 既存のタスクを更新または追加
            this.allTasks = this.allTasks.filter(
              (t) => t.projectId !== project.id
            );
            this.allTasks = [...this.allTasks, ...tasksWithProject];

            // 選択されたプロジェクトのタスクをフィルタリング
            this.filterTasksBySelectedProjects();
          });
      }
    });
  }

  private resetProjectState(includeSelection = false): void {
    this.projects = [];
    this.selectedProjectIds = [];
    this.allTasks = [];
    this.tasks = [];
    if (includeSelection) {
      this.projectSelectionService.clearSelection();
    }
  }

  /** 選択されたプロジェクトのタスクをフィルタリング */
  filterTasksBySelectedProjects() {
    if (this.selectedProjectIds.length === 0) {
      this.tasks = [];
    } else {
      this.tasks = this.allTasks.filter((task) =>
        this.selectedProjectIds.includes(task.projectId)
      );
    }
    console.log('フィルタリング後のタスク:', this.tasks);
  }

  /** プロジェクト選択が変更された時の処理 */
  onProjectSelectionChange() {
    this.projectSelectionService.setSelectedProjectIds(this.selectedProjectIds);
  }

  /** プロジェクトが選択されているかチェック */
  isProjectSelected(projectId: string): boolean {
    return this.selectedProjectIds.includes(projectId);
  }

  /** プロジェクトをすべて選択 */
  selectAllProjects() {
    const allIds = this.projects
      .map((project) => project.id)
      .filter((id): id is string => !!id);
    this.selectedProjectIds = allIds;
    this.projectSelectionService.setSelectedProjectIds(allIds);
  }

  /** プロジェクト選択を全て解除 */
  clearProjectSelection() {
    this.selectedProjectIds = [];
    this.projectSelectionService.clearSelection();
  }

  /** プロジェクト選択をトグル */
  toggleProjectSelection(projectId: string) {
    this.projectSelectionService.toggleProjectSelection(projectId);
  }

  /** プロジェクトIDからプロジェクト名を取得 */
  getProjectName(projectId: string): string {
    const project = this.projects.find((p) => p.id === projectId);
    return project ? project.projectName : '';
  }

  /** ステータスでタスクをフィルター */
  filterByStatus(status: string) {
    return this.tasks.filter((t) => t.status === status);
  }

  /** タスクのステータスを変更 */
  async changeTaskStatus(taskId: string, newStatus: string) {
    // 有効なステータスかチェック
    const validStatuses: ('未着手' | '作業中' | '完了')[] = [
      '未着手',
      '作業中',
      '完了',
    ];
    if (!validStatuses.includes(newStatus as '未着手' | '作業中' | '完了')) {
      console.error('無効なステータス:', newStatus);
      return;
    }

    // タスクのプロジェクトIDを取得
    const task = this.allTasks.find((t) => t.id === taskId);
    if (!task) return;

    // 古いステータスを保存
    const oldStatus = task.status;

    if (task.parentTaskId && newStatus !== '完了') {
      const parentTask = this.allTasks.find(
        (t) => t.id === task.parentTaskId
      );
      if (
        parentTask &&
        parentTask.status === '完了' &&
        parentTask.detailSettings?.taskOrder?.requireSubtaskCompletion
      ) {
        alert(
          this.languageService.translateWithParams('kanban.alert.parentTaskStatusChange', {
            taskName: parentTask.taskName || '名称未設定'
          })
        );
        try {
          await this.taskService.updateTaskStatus(
            parentTask.id!,
            '作業中',
            parentTask.status,
            parentTask.projectId,
            parentTask.projectName
          );
          parentTask.status = '作業中';
        } catch (error) {
          console.error('親タスクのステータス更新に失敗しました', error);
        }
        this.filterTasksBySelectedProjects();
      }
    }

    if (
      newStatus === '完了' &&
      task.detailSettings?.taskOrder?.requireSubtaskCompletion
    ) {
      const childTasks = this.allTasks.filter(
        (child) => child.parentTaskId === task.id
      );
      const incompleteChild = childTasks.find(
        (child) => child.status !== '完了'
      );

      if (incompleteChild) {
        const childName = incompleteChild.taskName || '名称未設定';
        alert(this.languageService.translateWithParams('kanban.alert.incompleteSubtask', {
          taskName: childName
        }));
        return;
      }
    }

    try {
      // TaskServiceを使用してステータスを更新（編集ログも記録される）
      await this.taskService.updateTaskStatus(
        taskId,
        newStatus,
        oldStatus,
        task.projectId,
        task.projectName
      );

      console.log('✅ カンバンでタスクのステータスを更新しました');

      // ローカルのタスクも更新
      const taskIndex = this.allTasks.findIndex((t) => t.id === taskId);
      if (taskIndex > -1) {
        this.allTasks[taskIndex].status = newStatus as
          | '未着手'
          | '作業中'
          | '完了';
        this.filterTasksBySelectedProjects();
      }
    } catch (error) {
      console.error('❌ ステータス更新エラー:', error);
    }
  }

  /** ＋プロジェクト：ダイアログを開く */
  openProjectDialog() {
    this.router.navigate(['/project-form'], {
      state: { returnUrl: this.router.url },
    });
  }

  /** ＋タスク：ダイアログを開く */
  openTaskDialog() {
    if (this.selectedProjectIds.length === 0) {
      alert(this.languageService.translate('kanban.selectProjectToAdd'));
      return;
    }

    if (this.selectedProjectIds.length > 1) {
      alert(
        this.languageService.translate('kanban.multipleProjectsSelected')
      );
      return;
    }

    // 選択されたプロジェクトを取得
    const selectedProject = this.projects.find(
      (p) => p.id === this.selectedProjectIds[0]
    );

    const ref = this.dialog.open(TaskFormComponent, {
      width: '450px',
      data: { project: selectedProject }, // プロジェクト全体を渡す
    });
    ref.afterClosed().subscribe((result) => {
      if (result && this.selectedProjectIds.length === 1) {
        console.log('保存するタスクデータ:', result); // デバッグ用ログ
        this.projectService
          .addTaskToProject(this.selectedProjectIds[0], result)
          .then(() => {
            console.log('新しいタスクが追加されました');
            // タスク一覧を再読み込み
            this.loadAllTasks();
          })
          .catch((error) => {
            console.error('タスク追加エラー:', error);
          });
      }
    });
  }

  /** タスク詳細画面を開く */
  openTaskDetail(task: Task) {
    if (task.projectId && task.id) {
      this.router.navigate(['/project', task.projectId, 'task', task.id]);
    }
  }
}
