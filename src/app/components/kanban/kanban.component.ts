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
import { doc, updateDoc } from '@angular/fire/firestore';
import { TaskService } from '../../services/task.service';
import { ProjectService } from '../../services/project.service';
import { ProjectFormDialogComponent } from '../project-form-dialog/project-form-dialog.component';
import { TaskFormComponent } from '../task-form/task-form.component';
import { Task, Project } from '../../models/task.model';

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
  ],
  templateUrl: './kanban.component.html',
  styleUrls: ['./kanban.component.css'],
})
export class KanbanComponent implements OnInit {
  tasks: Task[] = [];
  projects: Project[] = [];
  selectedProjectIds: string[] = [];
  allTasks: Task[] = []; // 全プロジェクトのタスクを保持
  statuses = ['未着手', '作業中', '完了'];

  constructor(
    private taskService: TaskService,
    private projectService: ProjectService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    // プロジェクト一覧を取得
    this.projectService.getProjects().subscribe((projects) => {
      this.projects = projects;
      console.log('プロジェクト一覧:', projects);

      // 全プロジェクトのタスクを読み込み
      this.loadAllTasks();

      // 最初のプロジェクトを選択（「アプリ A改善プロジェクト」がある場合）
      const appProject = projects.find(
        (p) => p.projectName === 'アプリ A改善プロジェクト'
      );
      if (appProject) {
        this.selectedProjectIds = [appProject.id];
        this.filterTasksBySelectedProjects();
      }
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
              projectId: project.id!,
              projectName: project.projectName,
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
    this.filterTasksBySelectedProjects();
  }

  /** プロジェクトが選択されているかチェック */
  isProjectSelected(projectId: string): boolean {
    return this.selectedProjectIds.includes(projectId);
  }

  /** プロジェクト選択をトグル */
  toggleProjectSelection(projectId: string) {
    const index = this.selectedProjectIds.indexOf(projectId);
    if (index > -1) {
      this.selectedProjectIds.splice(index, 1);
    } else {
      this.selectedProjectIds.push(projectId);
    }
    this.filterTasksBySelectedProjects();
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
  changeTaskStatus(taskId: string, newStatus: string) {
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

    // プロジェクト内のタスクのステータスを更新
    const taskRef = doc(
      this.projectService['firestore'],
      `projects/${task.projectId}/tasks/${taskId}`
    );
    updateDoc(taskRef, { status: newStatus })
      .then(() => {
        console.log('タスクのステータスを更新しました');
        // ローカルのタスクも更新
        const taskIndex = this.allTasks.findIndex((t) => t.id === taskId);
        if (taskIndex > -1) {
          this.allTasks[taskIndex].status = newStatus as
            | '未着手'
            | '作業中'
            | '完了';
          this.filterTasksBySelectedProjects();
        }
      })
      .catch((error) => {
        console.error('ステータス更新エラー:', error);
      });
  }

  /** ＋プロジェクト：ダイアログを開く */
  openProjectDialog() {
    const ref = this.dialog.open(ProjectFormDialogComponent, {
      width: '450px',
    });
    ref.afterClosed().subscribe((result) => {
      if (result === 'success') {
        console.log('新しいプロジェクトが登録されました');
      }
    });
  }

  /** ＋タスク：ダイアログを開く */
  openTaskDialog() {
    if (this.selectedProjectIds.length === 0) {
      alert('タスクを追加するプロジェクトを選択してください');
      return;
    }

    if (this.selectedProjectIds.length > 1) {
      alert(
        '複数プロジェクトが選択されています。タスクを追加するには1つのプロジェクトのみを選択してください'
      );
      return;
    }

    // 選択されたプロジェクトの名前を取得
    const selectedProject = this.projects.find(
      (p) => p.id === this.selectedProjectIds[0]
    );
    const projectName = selectedProject ? selectedProject.projectName : '';

    const ref = this.dialog.open(TaskFormComponent, {
      width: '450px',
      data: { projectName: projectName }, // プロジェクト名を渡す
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
