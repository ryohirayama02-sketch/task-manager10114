import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogRef,
  MatDialogModule,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

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
  model = {
    projectName: '',
    taskName: '',
    status: '未着手',
    priority: '中',
    assignee: '',
    dueDate: '',
  };

  constructor() {
    // ✅ ダイアログ呼び出し時に受け取ったプロジェクト名を初期セット
    console.log('受け取ったデータ:', this.data); // ← 一旦ログで確認
    if (this.data?.projectName) {
      this.model.projectName = this.data.projectName;
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
