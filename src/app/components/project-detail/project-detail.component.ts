import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import {
  ProgressService,
  ProjectProgress,
} from '../../services/progress.service';
import { IProject } from '../../models/project.model';
import { Task } from '../../models/task.model';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TaskFormComponent } from '../task-form/task-form.component';
import { ProjectFormDialogComponent } from '../project-form-dialog/project-form-dialog.component';
import { ProgressCircleComponent } from '../progress/projects-overview/progress-circle.component';
import { ProjectChatComponent } from '../project-chat/project-chat.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatSnackBarModule,
    ProgressCircleComponent,
    ProjectChatComponent,
  ],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css'],
})
export class ProjectDetailComponent implements OnInit {
  project: IProject | null = null;
  projectId: string | null = null;
  projectProgress: ProjectProgress | null = null;
  tasks: Task[] = [];
  filteredTasks: Task[] = [];

  // フィルター用のプロパティ
  filterStatus: string = '';
  filterPriority: string = '';
  filterAssignee: string = '';
  filterDueDate: string = '';

  // フィルターオプション
  statusOptions = ['未着手', '作業中', '完了'];
  priorityOptions = ['高', '中', '低'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private progressService: ProgressService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId');
    console.log('選択されたプロジェクトID:', this.projectId);

    if (this.projectId) {
      this.projectService
        .getProjectById(this.projectId)
        .subscribe(async (data) => {
          this.project = data;
          console.log('Firestoreから取得したプロジェクト:', data);

          // プロジェクトの進捗率を取得
          const progress = await this.progressService.getProjectProgress(
            this.projectId!
          );
          this.projectProgress = progress;
          console.log('プロジェクト進捗:', progress);
        });

      // プロジェクトのタスク一覧を取得
      this.loadTasks();
    }
  }

  /** プロジェクト編集ダイアログを開く */
  openEditProjectDialog() {
    if (!this.project) return;

    const dialogRef = this.dialog.open(ProjectFormDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
      disableClose: false,
      autoFocus: true,
      data: { project: this.project },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.deleted) {
        // プロジェクトが削除された場合、一覧画面にリダイレクト
        this.router.navigate(['/projects-overview']);
      } else if (result === 'success') {
        console.log('プロジェクトが更新されました');
        // プロジェクト情報を再読み込み
        if (this.projectId) {
          this.projectService
            .getProjectById(this.projectId)
            .subscribe((data) => {
              this.project = data;
              console.log('更新されたプロジェクト:', data);
            });
        }
      }
    });
  }

  /** ✅ 「＋タスク」ボタン押下でフォームを開く */
  openAddTaskDialog() {
    if (!this.project) return;

    console.log('📤 ダイアログに渡すprojectName:', this.project?.projectName);
    const dialogRef = this.dialog.open(TaskFormComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
      data: { projectName: this.project.projectName }, // ✅ 自動で渡す
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result || !this.projectId) return;

      try {
        await this.projectService.addTaskToProject(this.projectId, result);
        console.log('タスク追加成功:', result);
      } catch (error) {
        console.error('Firestoreへの追加失敗:', error);
        alert('保存に失敗しました。');
      }
    });
  }

  /** タスク一覧を読み込み */
  loadTasks() {
    if (!this.projectId) return;

    this.projectService
      .getTasksByProjectId(this.projectId)
      .subscribe((tasks) => {
        this.tasks = tasks;
        this.filteredTasks = [...tasks];
        console.log('プロジェクトのタスク一覧:', tasks);
      });
  }

  /** フィルターを適用 */
  applyFilter() {
    this.filteredTasks = this.tasks.filter((task) => {
      const statusMatch =
        !this.filterStatus || task.status === this.filterStatus;
      const priorityMatch =
        !this.filterPriority || task.priority === this.filterPriority;
      const assigneeMatch =
        !this.filterAssignee ||
        task.assignee.toLowerCase().includes(this.filterAssignee.toLowerCase());
      const dueDateMatch =
        !this.filterDueDate || task.dueDate === this.filterDueDate;

      return statusMatch && priorityMatch && assigneeMatch && dueDateMatch;
    });
  }

  /** フィルターをリセット */
  resetFilter() {
    this.filterStatus = '';
    this.filterPriority = '';
    this.filterAssignee = '';
    this.filterDueDate = '';
    this.filteredTasks = [...this.tasks];
  }

  /** タスク詳細画面に遷移 */
  goToTaskDetail(taskId: string) {
    if (!this.projectId) {
      console.error('プロジェクトIDが設定されていません');
      return;
    }
    this.router.navigate(['/project', this.projectId, 'task', taskId]);
  }

  /** CSV出力 */
  exportToCSV() {
    if (!this.project || this.filteredTasks.length === 0) {
      alert('出力するデータがありません');
      return;
    }

    const csvData = this.generateCSVData();
    this.downloadCSV(csvData, `${this.project.projectName}_tasks.csv`);
  }

  /** CSVデータを生成 */
  generateCSVData(): string {
    const headers = [
      'タスク名',
      'ステータス',
      '期日',
      '優先度',
      '担当者',
      '開始日',
      '説明',
    ];
    const rows = this.filteredTasks.map((task) => [
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

    return '\uFEFF' + csvContent; // BOMを追加してUTF-8エンコーディングを指定
  }

  /** CSVファイルをダウンロード */
  downloadCSV(csvData: string, filename: string) {
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

  /** ステータスの色を取得 */
  getStatusColor(status: string): string {
    switch (status) {
      case '完了':
        return 'primary';
      case '作業中':
        return 'accent';
      case '未着手':
        return 'warn';
      default:
        return '';
    }
  }

  /** 優先度の色を取得 */
  getPriorityColor(priority: string): string {
    switch (priority) {
      case '高':
        return 'warn';
      case '中':
        return 'accent';
      case '低':
        return 'primary';
      default:
        return '';
    }
  }
}
