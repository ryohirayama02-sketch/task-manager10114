import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule],
  templateUrl: './task-form.component.html',
  styleUrls: ['./task-form.component.css'],
})
export class TaskFormComponent {
  private dialogRef = inject(MatDialogRef<TaskFormComponent>);

  // 入力モデル（双方向バインディング用）
  model = {
    projectName: '',
    taskName: '',
    status: '未着手', // デフォルト
    priority: '中', // デフォルト
    assignee: '',
    dueDate: '', // 'YYYY-MM-DD'
  };

  save() {
    // 必須チェック（最小限）
    if (!this.model.taskName || !this.model.projectName) return;
    this.dialogRef.close(this.model); // 呼び出し元へ結果を返す
  }

  cancel() {
    this.dialogRef.close(); // 何も返さず閉じる
  }
}
