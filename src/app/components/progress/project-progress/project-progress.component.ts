import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProjectService } from '../../../services/project.service';
import { Task } from '../../../models/task.model';
import { IProject } from '../../../models/project.model'; //
import {
  DEFAULT_PROJECT_THEME_COLOR,
  resolveProjectThemeColor,
} from '../../../constants/project-theme-colors';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { LanguageService } from '../../../services/language.service';
import { MemberManagementService } from '../../../services/member-management.service';
import { Member } from '../../../models/member.model';
import { AuthService } from '../../../services/auth.service';
import { filter, take, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-project-progress',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './project-progress.component.html',
  styleUrls: ['./project-progress.component.css'],
})
export class ProjectProgressComponent implements OnInit {
  project: IProject | null = null;
  tasks: Task[] = [];

  projectId: string | null = null;
  projectThemeColor = DEFAULT_PROJECT_THEME_COLOR;
  members: Member[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private location: Location,
    private languageService: LanguageService,
    private memberManagementService: MemberManagementService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // メンバー一覧を読み込み
    this.memberManagementService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
      },
    });

    this.projectId = this.route.snapshot.paramMap.get('projectId');
    console.log('プロジェクトID:', this.projectId); // ← 確認ポイント

    if (this.projectId) {
      // ✅ 修正: roomIdが設定されるまで待ってから処理を進める（PCとスマホのタイミング差を解消）
      this.authService.currentRoomId$
        .pipe(
          filter((roomId) => !!roomId),
          take(1),
          switchMap((roomId) => {
            console.log('🔑 roomIdが設定されました（プロジェクト進捗）:', roomId);
            return this.projectService.getProjectById(this.projectId!);
          })
        )
        .subscribe((data) => {
          console.log('選択されたプロジェクト:', data);
          if (!data) {
            const currentRoomId = this.authService.getCurrentRoomId();
            if (currentRoomId) {
              this.router.navigate(['/projects']);
            }
            return;
          }
          this.project = data;
          this.projectThemeColor = resolveProjectThemeColor(data);
          this.tasks = this.tasks.map((task) => this.withTaskTheme(task));
        });

      // ✅ 修正: roomIdが設定されるまで待ってから処理を進める
      this.authService.currentRoomId$
        .pipe(
          filter((roomId) => !!roomId),
          take(1),
          switchMap((roomId) => {
            console.log('🔑 roomIdが設定されました（タスク一覧）:', roomId);
            return this.projectService.getTasksByProjectId(this.projectId!);
          })
        )
        .subscribe((taskList) => {
          this.tasks = taskList.map((task) => this.withTaskTheme(task));
        });
    }
  }

  /** タスク詳細画面を開く */
  openTaskDetail(task: Task) {
    if (this.projectId && task.id) {
      this.router.navigate(['/project', this.projectId, 'task', task.id]);
    }
  }

  getProjectThemeStyle() {
    return {
      '--project-theme-color': this.projectThemeColor,
    };
  }

  getTaskThemeStyle(task: Task) {
    return {
      '--task-theme-color':
        task.projectThemeColor || this.projectThemeColor,
    };
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/progress/projects']);
    }
  }

  private withTaskTheme(task: Task): Task {
    const color =
      task.projectThemeColor || this.projectThemeColor || DEFAULT_PROJECT_THEME_COLOR;
    return {
      ...task,
      projectThemeColor: color,
    };
  }

  /**
   * タスクの担当者を表示（メンバー管理画面に存在しない名前は除外）
   */
  getTaskAssigneeDisplay(task: Task): string {
    if (task.assignedMembers && task.assignedMembers.length > 0) {
      const names: string[] = [];
      task.assignedMembers.forEach((memberId) => {
        const member = this.members.find((m) => m.id === memberId);
        if (member && member.name) {
          names.push(member.name);
        }
      });
      return names.length > 0 ? names.join(', ') : '—';
    }

    if (!task.assignee) {
      return '—';
    }

    // assignee がカンマ区切りの場合を考慮
    const assigneeNames = task.assignee.split(',').map(name => name.trim());
    const updatedNames = assigneeNames
      .map(name => {
        const member = this.members.find((m) => m.name === name);
        return member ? member.name : null;
      })
      .filter((name): name is string => name !== null);

    return updatedNames.length > 0 ? updatedNames.join(', ') : '—';
  }
}
