import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { ProjectService } from '../../services/project.service';

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
  };

  constructor(
    private projectService: ProjectService,
    private dialogRef: MatDialogRef<ProjectFormDialogComponent>
  ) {}

  async onSubmit() {
    await this.projectService.addProject(this.project);
    this.dialogRef.close('success');
  }

  onCancel() {
    this.dialogRef.close();
  }
}
