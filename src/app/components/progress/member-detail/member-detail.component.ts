import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { ProjectService } from '../../../services/project.service';
import { Task } from '../../../models/task.model';

interface MemberDetail {
  name: string;
  projects: string[];
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
  selector: 'app-member-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatChipsModule,
  ],
  templateUrl: './member-detail.component.html',
  styleUrls: ['./member-detail.component.css'],
})
export class MemberDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);

  memberDetail: MemberDetail | null = null;
  isLoading = true;
  displayedColumns: string[] = [
    'projectName',
    'taskName',
    'status',
    'dueDate',
    'priority',
  ];

  ngOnInit() {
    const memberName = this.route.snapshot.paramMap.get('memberName');
    if (memberName) {
      this.loadMemberDetail(memberName);
    }
  }

  loadMemberDetail(memberName: string) {
    this.isLoading = true;
    console.log('メンバー詳細を読み込み中:', memberName);

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
                this.processMemberDetail(memberName, allTasks);
              }
            });
        } else {
          completedRequests++;
          if (completedRequests === projects.length) {
            this.processMemberDetail(memberName, allTasks);
          }
        }
      });
    });
  }

  processMemberDetail(memberName: string, allTasks: Task[]) {
    console.log('全タスク:', allTasks);

    // 指定されたメンバーのタスクをフィルタリング
    const memberTasks = allTasks.filter((task) => task.assignee === memberName);

    if (memberTasks.length === 0) {
      this.isLoading = false;
      return;
    }

    // 所属プロジェクトを取得
    const projects = [...new Set(memberTasks.map((task) => task.projectName))];

    // タスクの統計を計算
    const completedTasks = memberTasks.filter((t) => t.status === '完了');
    const inProgressTasks = memberTasks.filter((t) => t.status === '作業中');
    const notStartedTasks = memberTasks.filter((t) => t.status === '未着手');
    const completionRate =
      memberTasks.length > 0
        ? Math.round((completedTasks.length / memberTasks.length) * 100)
        : 0;

    // 優先度別の詳細計算
    const completedByPriority = this.calculatePriorityBreakdown(completedTasks);
    const inProgressByPriority =
      this.calculatePriorityBreakdown(inProgressTasks);
    const notStartedByPriority =
      this.calculatePriorityBreakdown(notStartedTasks);

    this.memberDetail = {
      name: memberName,
      projects,
      totalTasks: memberTasks.length,
      completedTasks: completedTasks.length,
      inProgressTasks: inProgressTasks.length,
      notStartedTasks: notStartedTasks.length,
      completionRate,
      tasks: memberTasks,
      completedByPriority,
      inProgressByPriority,
      notStartedByPriority,
    };

    console.log('メンバー詳細:', this.memberDetail);
    this.isLoading = false;
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

  getStatusColor(status: string): string {
    switch (status) {
      case '完了':
        return '#4caf50';
      case '作業中':
        return '#2196f3';
      case '未着手':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case '高':
        return '#f44336';
      case '中':
        return '#ff9800';
      case '低':
        return '#4caf50';
      default:
        return '#9e9e9e';
    }
  }

  goBack() {
    this.router.navigate(['/progress/members']);
  }

  exportToCSV() {
    if (!this.memberDetail) return;

    const csvContent = this.generateCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${this.memberDetail.name}_tasks.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private generateCSVContent(): string {
    if (!this.memberDetail) return '';

    const headers = [
      'プロジェクト名',
      'タスク名',
      'ステータス',
      '期日',
      '優先度',
    ];
    const rows = this.memberDetail.tasks.map((task) => [
      task.projectName,
      task.taskName,
      task.status,
      task.dueDate,
      task.priority,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }
}
