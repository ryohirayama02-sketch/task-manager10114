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
import { PeriodFilterDialogComponent } from '../period-filter-dialog/period-filter-dialog.component';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { LanguageService } from '../../../services/language.service';
import { MemberManagementService } from '../../../services/member-management.service';
import { Member } from '../../../models/member.model';

interface MemberProgress {
  name: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  completionRate: number;
  tasks: Task[];
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
    TranslatePipe,
  ],
  templateUrl: './member-progress.component.html',
  styleUrls: ['./member-progress.component.css'],
})
export class MemberProgressComponent implements OnInit {
  private projectService = inject(ProjectService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private languageService = inject(LanguageService);
  private memberManagementService = inject(MemberManagementService);

  members: MemberProgress[] = [];
  isLoading = true;
  private allTasks: Task[] = [];
  private allMembers: Member[] = []; // メンバー一覧
  periodStartDate: Date | null = null;
  periodEndDate: Date | null = null;

  ngOnInit() {
    // メンバー一覧を読み込み
    this.memberManagementService.getMembers().subscribe({
      next: (members) => {
        this.allMembers = members;
        console.log('メンバー一覧を読み込みました:', members.length, '件');
        this.loadMemberProgress();
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
        this.loadMemberProgress();
      },
    });
  }

  loadMemberProgress() {
    this.isLoading = true;
    console.log('メンバー進捗を読み込み中...');

    this.projectService.getProjects().subscribe((projects) => {
      if (projects.length === 0) {
        this.isLoading = false;
        return;
      }

      const allTasks: Task[] = [];
      let completedRequests = 0;

      projects.forEach((project) => {
        if (project.id) {
          this.projectService
            .getTasksByProjectId(project.id)
            .subscribe((tasks) => {
              allTasks.push(...tasks);
              completedRequests++;

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
    const memberTaskMap = new Map<string, Task[]>();

    tasks.forEach((task) => {
      // assignee と assignedMembers を統合して、重複を削除
      let assignees: string[] = [];

      // assignee から名前を取得
      if (task.assignee) {
        const assigneeNames = task.assignee
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name.length > 0);
        assignees.push(...assigneeNames);
      }

      // assignedMembers からメンバー名を取得
      if (task.assignedMembers && task.assignedMembers.length > 0) {
        task.assignedMembers.forEach((memberId) => {
          // メンバーIDからメンバー名を取得
          const member = this.allMembers.find((m) => m.id === memberId);
          const memberName = member ? member.name : memberId;
          
          // メンバー名がカンマ区切りの場合も分割
          const names = memberName
            .split(',')
            .map((name) => name.trim())
            .filter((name) => name.length > 0);
          
          assignees.push(...names);
        });
      }

      // 重複を削除
      assignees = [...new Set(assignees)];

      // 各メンバーにタスクを追加（重複チェック付き）
      assignees.forEach((name) => {
        if (!memberTaskMap.has(name)) {
          memberTaskMap.set(name, []);
        }
        // 既に同じタスクが追加されていないかチェック
        const memberTasks = memberTaskMap.get(name)!;
        if (!memberTasks.some((t) => t.id === task.id)) {
          memberTasks.push(task);
        }
      });
    });

    console.log('メンバー別タスク:', memberTaskMap);

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

      const afterStart = this.periodStartDate
        ? dueDate >= this.periodStartDate
        : true;
      const beforeEnd = this.periodEndDate
        ? dueDate <= this.periodEndDate
        : true;

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

  goToMemberDetail(memberName: string) {
    console.log('メンバー詳細画面に遷移:', memberName);
    this.router.navigate(['/progress/members', memberName]);
  }

  openPeriodDialog() {
    const dialogRef = this.dialog.open(PeriodFilterDialogComponent, {
      width: '500px',
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
