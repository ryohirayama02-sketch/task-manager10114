import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { TaskService } from '../../services/task.service';
import { TaskFormComponent } from '../task-form/task-form.component';

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatDialogModule,
    TaskFormComponent,
  ],
  templateUrl: './kanban.component.html',
  styleUrls: ['./kanban.component.css'],
})
export class KanbanComponent implements OnInit {
  tasks: any[] = [];

  constructor(private taskService: TaskService, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.taskService.getTasks().subscribe((data) => {
      this.tasks = data;
      console.log('Firestoreから取得:', data);
    });
  }

  filterByStatus(status: string) {
    return this.tasks.filter((t) => t.status === status);
  }

  /** ＋タスク：ダイアログを開く */
  openAddTaskDialog() {
    const ref = this.dialog.open(TaskFormComponent, { width: '420px' });
    ref.afterClosed().subscribe(async (result) => {
      if (!result) return; // キャンセル
      try {
        await this.taskService.addTask(result);
        console.log('保存完了', result);
      } catch (e) {
        console.error('保存失敗', e);
        alert('保存に失敗しました。Consoleのエラーを確認してください。');
      }
    });
  }
}
