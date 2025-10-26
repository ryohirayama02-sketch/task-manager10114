import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ProjectService } from '../../services/project.service';
import { Milestone } from '../../models/task.model';
import { IProject } from '../../models/project.model';

@Component({
  selector: 'app-project-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-form-dialog.component.html',
  styleUrls: ['./project-form-dialog.component.css'],
})
export class ProjectFormDialogComponent {
  project = {
    projectName: '',
    overview: '',
    startDate: '',
    members: '',
    tags: '',
    milestones: [] as Milestone[],
  };

  isEditMode: boolean = false;
  originalProject: IProject | null = null;

  constructor(
    private projectService: ProjectService,
    private dialogRef: MatDialogRef<ProjectFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { project?: IProject }
  ) {
    if (data && data.project) {
      this.isEditMode = true;
      this.originalProject = data.project;
      this.project = {
        projectName: data.project.projectName || '',
        overview: data.project.overview || '',
        startDate: data.project.startDate || '',
        members: data.project.members || '',
        tags: data.project.tags || '',
        milestones: data.project.milestones ? [...data.project.milestones] : [],
      };
    }
  }

  async onSubmit() {
    if (this.isEditMode && this.originalProject) {
      // 編集モードの場合
      const updatedProject: IProject = {
        ...this.originalProject,
        projectName: this.project.projectName,
        overview: this.project.overview,
        startDate: this.project.startDate,
        members: this.project.members,
        tags: this.project.tags,
        milestones: this.project.milestones,
      };
      await this.projectService.updateProject(
        this.originalProject.id,
        updatedProject
      );
    } else {
      // 新規作成モードの場合
      await this.projectService.addProject(this.project);
    }
    this.dialogRef.close('success');
  }

  onCancel() {
    this.dialogRef.close();
  }

  /** マイルストーンを追加 */
  addMilestone() {
    this.project.milestones.push({
      id: this.generateId(),
      name: '',
      date: '',
      description: '',
    });
  }

  /** マイルストーンを削除 */
  removeMilestone(index: number) {
    this.project.milestones.splice(index, 1);
  }

  /** IDを生成 */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
