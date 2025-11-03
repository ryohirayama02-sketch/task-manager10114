import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { ProjectService } from '../../../services/project.service';
import { Task } from '../../../models/task.model';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PeriodFilterDialogComponent } from '../member-detail/member-detail.component';

interface MemberProgress {
  name: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  completionRate: number;
  tasks: Task[];
  // 優先度別の詳細
  completedByPriority: { high: number; medium: number; low: number };
  inProgressByPriority: { high: number; medium: number; low: number };
  notStartedByPriority: { high: number; medium: number; low: number };
}

@Component({
  selector: 'app-member-progress',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './member-progress.component.html',
  styleUrls: ['./member-progress.component.css'],
})
export class MemberProgressComponent implements OnInit {
  private projectService = inject(ProjectService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  members: MemberProgress[] = [];
  isLoading = true;
  private allTasks: Task[] = [];
  periodStartDate: Date | null = null;
  periodEndDate: Date | null = null;

  ngOnInit() {
    this.loadMemberProgress();
  }

  loadMemberProgress() {
    this.isLoading = true;
    console.log('メンバー進捗を読み込み中...');

    // 全プロジェクトのタスクを取得
    this.projectService.getProjects().subscribe((projects) => {
      if (projects.length === 0) {
        this.isLoading = false;
        return;
      }

      const allTasks: Task[] = [];
      let completedRequests = 0;

      // 各プロジェクトのタスクを取得
      projects.forEach((project) => {
        if (project.id) {
          this.projectService
            .getTasksByProjectId(project.id)
            .subscribe((tasks) => {
              allTasks.push(...tasks);
              completedRequests++;

              // すべてのプロジェクトのタスクを取得したら処理を実行
              if (completedRequests === projects.length) {
                this.processMemberProgress(allTasks);
              }
            });
        } else {
          completedRequests++;
          if (completedRequests === projects.length) {
            this.processMemberProgress(allTasks);
          }
        }
      });
    });
  }

  processMemberProgress(allTasks: Task[]) {
    console.log('全タスク:', allTasks);
    this.allTasks = allTasks;
    this.applyPeriodFilter();
    this.isLoading = false;
  }

  private buildMemberProgress(tasks: Task[]): MemberProgress[] {
    // 担当者ごとにタスクをグループ化
    const memberTaskMap = new Map<string, Task[]>();

    tasks.forEach((task) => {
      if (task.assignee) {
        if (!memberTaskMap.has(task.assignee)) {
          memberTaskMap.set(task.assignee, []);
        }
        memberTaskMap.get(task.assignee)!.push(task);
      }
    });

    console.log('メンバー別タスク:', memberTaskMap);

    // 各メンバーの進捗を計算
    const members = Array.from(memberTaskMap.entries()).map(
      ([memberName, tasks]) => {
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t) => t.status === '完了');
        const inProgressTasks = tasks.filter((t) => t.status === '作業中');
        const notStartedTasks = tasks.filter((t) => t.status === '未着手');
        const completionRate =
          totalTasks > 0
            ? Math.round((completedTasks.length / totalTasks) * 100)
            : 0;

        // 優先度別の詳細計算
        const completedByPriority =
          this.calculatePriorityBreakdown(completedTasks);
        const inProgressByPriority =
          this.calculatePriorityBreakdown(inProgressTasks);
        const notStartedByPriority =
          this.calculatePriorityBreakdown(notStartedTasks);

        return {
          name: memberName,
          totalTasks,
          completedTasks: completedTasks.length,
          inProgressTasks: inProgressTasks.length,
          notStartedTasks: notStartedTasks.length,
          completionRate,
          tasks,
          completedByPriority,
          inProgressByPriority,
          notStartedByPriority,
        };
      }
    );

    // 完了率でソート（高い順）
    members.sort((a, b) => b.completionRate - a.completionRate);

    console.log('メンバー進捗:', members);
    return members;
  }

  private applyPeriodFilter() {
    const filteredTasks = this.filterTasksByPeriod(this.allTasks);
    this.members = this.buildMemberProgress(filteredTasks);
  }

  private filterTasksByPeriod(tasks: Task[]): Task[] {
    if (!this.periodStartDate && !this.periodEndDate) {
      return tasks;
    }

    return tasks.filter((task) => {
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      if (!dueDate) return false;

      const afterStart = this.periodStartDate ? dueDate >= this.periodStartDate : true;
      const beforeEnd = this.periodEndDate ? dueDate <= this.periodEndDate : true;

      return afterStart && beforeEnd;
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case '完了':
        return '#b2e9cb';
      case '作業中':
        return '#fef6c3';
      case '未着手':
        return '#fdd6d5';
      default:
        return '#9e9e9e';
    }
  }

  /** 優先度別の内訳を計算 */
  calculatePriorityBreakdown(tasks: Task[]): {
    high: number;
    medium: number;
    low: number;
  } {
    return {
      high: tasks.filter((t) => t.priority === '高').length,
      medium: tasks.filter((t) => t.priority === '中').length,
      low: tasks.filter((t) => t.priority === '低').length,
    };
  }

  /** メンバーカードをクリックして個別メンバー進捗画面に遷移 */
  goToMemberDetail(memberName: string) {
    console.log('メンバー詳細画面に遷移:', memberName);
    this.router.navigate(['/progress/members', memberName]);
  }

  openPeriodDialog() {
    const dialogRef = this.dialog.open(PeriodFilterDialogComponent, {
      width: '300px',
      data: {
        startDate: this.periodStartDate,
        endDate: this.periodEndDate,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.periodStartDate = result.startDate;
        this.periodEndDate = result.endDate;
        this.applyPeriodFilter();
      }
    });
  }
}
