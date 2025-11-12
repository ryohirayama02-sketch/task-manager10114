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
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
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
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    TranslatePipe,
  ],
  templateUrl: './member-progress.component.html',
  styleUrls: ['./member-progress.component.css'],
})
export class MemberProgressComponent implements OnInit {
  private projectService = inject(ProjectService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  public languageService = inject(LanguageService);
  private memberManagementService = inject(MemberManagementService);

  members: MemberProgress[] = [];
  isLoading = true;
  private allTasks: Task[] = [];
  private allMembers: Member[] = []; // メンバー一覧
  periodStartDate: Date | null = null;
  periodEndDate: Date | null = null;
  periodStartDateObj: Date | null = null; // Material date picker用
  periodEndDateObj: Date | null = null; // Material date picker用
  maxDate = new Date(9999, 11, 31); // 9999-12-31

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

      // assignee から名前を取得（メンバー管理画面に存在する名前のみ）
      if (task.assignee) {
        const assigneeNames = task.assignee
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
          .filter((name) => {
            // メンバー管理画面に存在する名前のみを追加
            return this.allMembers.some((m) => m.name === name);
          });
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
      console.log('期間フィルターなし: 全タスクを表示', tasks.length);
      return tasks;
    }

    console.log('期間フィルター適用:', {
      startDate: this.periodStartDate,
      endDate: this.periodEndDate,
      totalTasks: tasks.length,
    });

    const filteredTasks = tasks.filter((task) => {
      if (!task.dueDate) {
        return false;
      }

      // 日付文字列をDateオブジェクトに変換
      const dueDate = new Date(task.dueDate);
      if (isNaN(dueDate.getTime())) {
        console.warn('無効な日付:', task.dueDate, task.taskName);
        return false;
      }

      // 日付を日単位で比較するため、時刻を0時に設定
      const taskDateOnly = new Date(
        dueDate.getFullYear(),
        dueDate.getMonth(),
        dueDate.getDate()
      );

      // 開始日の時刻を0時に設定
      const startDateOnly = this.periodStartDate
        ? new Date(
            this.periodStartDate.getFullYear(),
            this.periodStartDate.getMonth(),
            this.periodStartDate.getDate()
          )
        : null;

      // 終了日の時刻を23:59:59.999に設定（その日の終わりまで含める）
      const endDateOnly = this.periodEndDate
        ? new Date(
            this.periodEndDate.getFullYear(),
            this.periodEndDate.getMonth(),
            this.periodEndDate.getDate(),
            23,
            59,
            59,
            999
          )
        : null;

      const afterStart = startDateOnly
        ? taskDateOnly >= startDateOnly
        : true;
      const beforeEnd = endDateOnly ? taskDateOnly <= endDateOnly : true;

      const matches = afterStart && beforeEnd;
      if (matches) {
        console.log('タスクが期間内:', {
          taskName: task.taskName,
          dueDate: task.dueDate,
          taskDateOnly: taskDateOnly.toISOString(),
          startDateOnly: startDateOnly?.toISOString(),
          endDateOnly: endDateOnly?.toISOString(),
        });
      }

      return matches;
    });

    console.log('フィルター後のタスク数:', filteredTasks.length);
    return filteredTasks;
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

  onPeriodStartDateChange(): void {
    console.log('開始日変更:', this.periodStartDateObj);
    if (this.periodStartDateObj) {
      this.periodStartDate = this.periodStartDateObj;
      console.log('開始日を設定:', this.periodStartDate);
    } else {
      this.periodStartDate = null;
      console.log('開始日をクリア');
    }
    this.applyPeriodFilter();
  }

  onPeriodEndDateChange(): void {
    console.log('終了日変更:', this.periodEndDateObj);
    if (this.periodEndDateObj) {
      this.periodEndDate = this.periodEndDateObj;
      console.log('終了日を設定:', this.periodEndDate);
    } else {
      this.periodEndDate = null;
      console.log('終了日をクリア');
    }
    this.applyPeriodFilter();
  }

  resetPeriodFilter(): void {
    this.periodStartDateObj = null;
    this.periodEndDateObj = null;
    this.periodStartDate = null;
    this.periodEndDate = null;
    this.applyPeriodFilter();
  }
}
