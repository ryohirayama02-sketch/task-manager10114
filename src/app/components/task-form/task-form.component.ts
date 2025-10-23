import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogRef,
  MatDialogModule,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

interface TaskFormModel {
  projectName: string;
  taskName: string;
  status: string;
  priority: string;
  assignee: string;
  startDate: string;
  dueDate: string;
}

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule],
  templateUrl: './task-form.component.html',
  styleUrls: ['./task-form.component.css'],
})
export class TaskFormComponent {
  // ✅ inject 構文を使った依存注入
  private dialogRef = inject(MatDialogRef<TaskFormComponent>);
  private data = inject(MAT_DIALOG_DATA, { optional: true }); // ← 追加（projectNameを受け取る）

  // 入力モデル（双方向バインディング用）
  model: TaskFormModel = {
    projectName: '',
    taskName: '',
    status: '未着手',
    priority: '中',
    assignee: '',
    startDate: '',
    dueDate: '',
  };

  constructor() {
    // ダイアログ呼び出し時に受け取ったデータを初期セット
    if (this.data?.projectName) {
      this.model.projectName = this.data.projectName;
    }

    // 複製データがある場合は、フォームに設定
    if (this.data?.duplicateData) {
      const duplicateData = this.data.duplicateData;
      this.model = {
        ...this.model,
        projectName: this.data.projectName || duplicateData.projectName || '',
        taskName: duplicateData.taskName || '',
        status: duplicateData.status || '未着手',
        priority: duplicateData.priority || '中',
        assignee: duplicateData.assignee || '',
        startDate: duplicateData.startDate || '',
        dueDate: duplicateData.endDate || duplicateData.dueDate || '',
      };
    }
  }

  save() {
    if (!this.model.taskName) return;
    this.dialogRef.close(this.model);
  }

  cancel() {
    this.dialogRef.close();
  }
}
