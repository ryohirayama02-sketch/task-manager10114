import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TaskFormComponent } from '../task-form/task-form.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatDialogModule],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css'],
})
export class ProjectDetailComponent implements OnInit {
  project: any;
  projectId: string | null = null;
  isEditing = false;
  tasks: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private dialog: MatDialog // ✅ ダイアログ追加
  ) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId');
    console.log('選択されたプロジェクトID:', this.projectId);

    if (this.projectId) {
      // ✅ Firestoreからプロジェクト情報取得
      this.projectService.getProjectById(this.projectId).subscribe((data) => {
        this.project = data;
        console.log('Firestoreから取得したプロジェクト:', data);
      });

      // ✅ 紐づくタスクを取得
      this.projectService
        .getTasksByProjectId(this.projectId)
        .subscribe((tasks) => {
          this.tasks = tasks;
          console.log('Firestoreからタスク取得:', tasks);
        });
    }
  }

  /** 編集モードのON/OFF切替 */
  toggleEdit() {
    this.isEditing = !this.isEditing;
  }

  /** 編集内容を保存（今は仮） */
  saveChanges() {
    alert('保存機能はこのあと実装します！');
    this.isEditing = false;
  }

  /** ✅ 「＋タスク」ボタン押下でフォームを開く */
  openAddTaskDialog() {
    const dialogRef = this.dialog.open(TaskFormComponent, { width: '400px' });

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
}
