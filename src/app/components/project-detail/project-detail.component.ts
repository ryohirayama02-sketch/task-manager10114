import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { IProject } from '../../models/project.model';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TaskFormComponent } from '../task-form/task-form.component';
import { ProjectFormDialogComponent } from '../project-form-dialog/project-form-dialog.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatDialogModule],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css'],
})
export class ProjectDetailComponent implements OnInit {
  project: IProject | null = null;
  projectId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId');
    console.log('選択されたプロジェクトID:', this.projectId);

    if (this.projectId) {
      this.projectService.getProjectById(this.projectId).subscribe((data) => {
        this.project = data;
        console.log('Firestoreから取得したプロジェクト:', data);
      });
    }
  }

  /** プロジェクト編集ダイアログを開く */
  openEditProjectDialog() {
    if (!this.project) return;

    const dialogRef = this.dialog.open(ProjectFormDialogComponent, {
      width: '500px',
      data: { project: this.project },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'success') {
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
      width: '420px',
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
}
