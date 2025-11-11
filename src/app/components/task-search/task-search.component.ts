import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { ProjectService } from '../../services/project.service';
import { MemberManagementService } from '../../services/member-management.service';
import { Member } from '../../models/member.model';
import { Task } from '../../models/task.model';
import { IProject } from '../../models/project.model';
import {
  DEFAULT_PROJECT_THEME_COLOR,
  resolveProjectThemeColor,
} from '../../constants/project-theme-colors';
import { getMemberNamesAsString } from '../../utils/member-utils';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

interface SearchFilters {
  assignee: string[];
  priority: string[];
  status: string[];
  tags: string[];
  freeWord: string;
}

@Component({
  selector: 'app-task-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    TranslatePipe,
  ],
  templateUrl: './task-search.component.html',
  styleUrl: './task-search.component.css',
})
export class TaskSearchComponent implements OnInit {
  private projectService = inject(ProjectService);
  private router = inject(Router);
  private memberManagementService = inject(MemberManagementService);
  private languageService = inject(LanguageService);

  // 検索フィルター
  filters: SearchFilters = {
    assignee: [],
    priority: [],
    status: [],
    tags: [],
    freeWord: '',
  };

  // 選択肢のデータ
  assignees: string[] = [];
  priorities: string[] = ['高', '中', '低'];
  statuses: string[] = ['未着手', '作業中', '完了'];
  allTags: string[] = [];
  private allMembers: Member[] = []; // メンバー一覧

  // 検索結果
  searchResults: Task[] = [];
  isLoading = false;
  hasSearched = false;
  private themeColorByProjectId: Record<string, string> = {};
  readonly defaultThemeColor = DEFAULT_PROJECT_THEME_COLOR;
  taskNameById: Record<string, string> = {}; // 親タスク名を取得するためのマップ

  ngOnInit() {
    // メンバー一覧を読み込み
    this.memberManagementService.getMembers().subscribe({
      next: (members) => {
        this.allMembers = members;
        console.log('メンバー一覧を読み込みました:', members.length, '件');
        this.loadFilterOptions();
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
        this.loadFilterOptions();
      },
    });
  }

  loadFilterOptions() {
    console.log('フィルター選択肢を読み込み中...');

    // 全プロジェクトのタスクを取得して選択肢を生成
    this.projectService.getProjects().subscribe((projects) => {
      if (projects.length === 0) {
        return;
      }

      this.updateThemeColorMap(projects as IProject[]);

      const allTasks: Task[] = [];
      let completedRequests = 0;

      // 各プロジェクトのタスクを取得
      projects.forEach((project) => {
        if (project.id) {
          this.projectService
            .getTasksByProjectId(project.id)
            .subscribe((tasks) => {
              // タスクデータにprojectIdを追加
              console.log(`プロジェクト「${project.projectName}」のタスク取得:`, tasks.length, '件');
              if (tasks.length > 0) {
                console.log('最初のタスクのデータ構造:', tasks[0]);
                console.log('最初のタスクのtags:', tasks[0].tags, '型:', typeof tasks[0].tags);
              }
              const tasksWithProjectId = tasks.map((task) => ({
                ...task,
                projectId: task.projectId || project.id,
                projectName: task.projectName || project.projectName,
                projectThemeColor:
                  task.projectThemeColor ||
                  this.getProjectThemeColor(project.id as string),
              }));
              allTasks.push(...tasksWithProjectId);
              completedRequests++;

              // すべてのプロジェクトのタスクを取得したら処理を実行
              if (completedRequests === projects.length) {
                // 親タスク名のマップを作成
                this.taskNameById = allTasks.reduce((acc, task) => {
                  if (task.id && task.taskName) {
                    acc[task.id] = task.taskName;
                  }
                  return acc;
                }, {} as Record<string, string>);
                this.generateFilterOptions(allTasks);
              }
            });
        } else {
          completedRequests++;
          if (completedRequests === projects.length) {
            this.generateFilterOptions(allTasks);
          }
        }
      });
    });
  }

  generateFilterOptions(allTasks: Task[]) {
    console.log('フィルター選択肢を生成中...', allTasks);
    console.log('タスク数:', allTasks.length);

    // 担当者一覧を生成（カンマ区切り対応、メンバー管理画面に存在する名前のみ）
    const assigneeSet = new Set<string>();
    
    // assignedMembers から取得（メンバーIDからメンバー名に変換）
    allTasks.forEach((task) => {
      if (Array.isArray((task as any).assignedMembers)) {
        (task as any).assignedMembers.forEach((memberId: string) => {
          const member = this.allMembers.find((m) => m.id === memberId);
          if (member && member.name) {
            // メンバー名がカンマ区切りの場合も分割
            const names = member.name
              .split(',')
              .map((n) => n.trim())
              .filter((n) => n.length > 0);
            names.forEach((name) => assigneeSet.add(name));
          }
        });
      }
      
      // タスクのassigneeから取得（メンバー管理画面に存在する名前のみ）
      if (task.assignee) {
        const assignees = task.assignee
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name.length > 0)
          .filter((name) => {
            // メンバー管理画面に存在する名前のみを追加
            return this.allMembers.some((m) => m.name === name);
          });
        assignees.forEach((assignee) => assigneeSet.add(assignee));
      }
    });
    
    // メンバー管理画面のメンバー一覧からも取得
    this.allMembers.forEach((member) => {
      if (member.name) {
        const names = member.name
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        names.forEach((name) => assigneeSet.add(name));
      }
    });
    
    this.assignees = Array.from(assigneeSet).sort();

    // タグ一覧を生成（ルーム内のタスクから抽出、空文字列やnullを除外）
    console.log('タグ抽出前のタスク:', allTasks.map(t => ({ 
      id: t.id, 
      taskName: t.taskName, 
      tags: t.tags,
      tagsType: typeof t.tags,
      tagsIsArray: Array.isArray(t.tags),
      allKeys: Object.keys(t)
    })));
    
    const allTags: string[] = [];
    allTasks.forEach((task) => {
      let tags: string[] = [];
      
      // tagsフィールドの型を確認
      if (task.tags) {
        if (Array.isArray(task.tags)) {
          tags = task.tags;
        } else if (typeof task.tags === 'string') {
          // 文字列の場合は配列に変換を試みる
          try {
            const parsed = JSON.parse(task.tags);
            tags = Array.isArray(parsed) ? parsed : [task.tags];
          } catch {
            tags = [task.tags];
          }
        } else {
          console.warn(`タスク「${task.taskName}」のtagsが予期しない型です:`, typeof task.tags, task.tags);
        }
      }
      
      console.log(`タスク「${task.taskName}」のタグ:`, tags, '型:', typeof tags, '配列か:', Array.isArray(tags));
      
      // タグを追加
      tags.forEach((tag) => {
        if (tag && typeof tag === 'string' && tag.trim().length > 0) {
          allTags.push(tag.trim());
        }
      });
    });
    
    this.allTags = [...new Set(allTags)].sort();
    console.log('抽出されたタグ（重複前）:', allTags);
    console.log('重複除去・ソート後のタグ:', this.allTags);
    console.log('最終的なallTagsの長さ:', this.allTags.length);

    console.log('生成された選択肢:', {
      assignees: this.assignees,
      allTags: this.allTags,
      allTagsLength: this.allTags.length,
    });
  }

  searchTasks() {
    this.isLoading = true;
    this.hasSearched = true;
    console.log('タスク検索開始:', this.filters);

    // 全プロジェクトのタスクを取得
    this.projectService.getProjects().subscribe((projects) => {
      if (projects.length === 0) {
        this.isLoading = false;
        return;
      }

      this.updateThemeColorMap(projects as IProject[]);
      const allTasks: Task[] = [];
      let completedRequests = 0;

      // 各プロジェクトのタスクを取得
      projects.forEach((project) => {
        if (project.id) {
          this.projectService
            .getTasksByProjectId(project.id)
            .subscribe((tasks) => {
              // タスクデータにprojectIdを追加
              console.log(`[検索] プロジェクト「${project.projectName}」のタスク取得:`, tasks.length, '件');
              if (tasks.length > 0) {
                console.log('[検索] 最初のタスクのtags:', tasks[0].tags);
              }
              const tasksWithProjectId = tasks.map((task) => ({
                ...task,
                projectId: task.projectId || project.id,
                projectName: task.projectName || project.projectName,
                projectThemeColor:
                  task.projectThemeColor ||
                  this.getProjectThemeColor(project.id as string),
              }));
              allTasks.push(...tasksWithProjectId);
              completedRequests++;

              // すべてのプロジェクトのタスクを取得したら処理を実行
              if (completedRequests === projects.length) {
                // 親タスク名のマップを作成
                this.taskNameById = allTasks.reduce((acc, task) => {
                  if (task.id && task.taskName) {
                    acc[task.id] = task.taskName;
                  }
                  return acc;
                }, {} as Record<string, string>);
                this.filterTasks(allTasks);
              }
            });
        } else {
          completedRequests++;
          if (completedRequests === projects.length) {
            this.filterTasks(allTasks);
          }
        }
      });
    });
  }

  filterTasks(allTasks: Task[]) {
    console.log('タスクをフィルタリング中...', allTasks);
    console.log(
      '全タスクのID情報:',
      allTasks.map((task) => ({
        id: task.id,
        projectId: task.projectId,
        taskName: task.taskName,
        parentTaskId: (task as any).parentTaskId,
      }))
    );
    
    // 子タスクの数を確認
    const subtasks = allTasks.filter((task) => (task as any).parentTaskId);
    console.log(`子タスクの数: ${subtasks.length}件`, subtasks.map((task) => ({
      id: task.id,
      taskName: task.taskName,
      parentTaskId: (task as any).parentTaskId,
    })));

    let filteredTasks = [...allTasks];

    // 担当者でフィルタリング（カンマ区切り対応、複数選択対応）
    if (this.filters.assignee.length > 0) {
      filteredTasks = filteredTasks.filter((task) => {
        const assignees: string[] = [];
        
        // assignedMembers から取得（メンバーIDからメンバー名に変換）
        if (Array.isArray((task as any).assignedMembers)) {
          (task as any).assignedMembers.forEach((memberId: string) => {
            const member = this.allMembers.find((m) => m.id === memberId);
            if (member && member.name) {
              // メンバー名がカンマ区切りの場合も分割
              const names = member.name
                .split(',')
                .map((n) => n.trim())
                .filter((n) => n.length > 0);
              assignees.push(...names);
            }
          });
        }
        
        // assignee から取得（メンバー管理画面に存在する名前のみ）
        if (task.assignee) {
          const names = task.assignee
            .split(',')
            .map((name) => name.trim())
            .filter((name) => name.length > 0)
            .filter((name) => {
              // メンバー管理画面に存在する名前のみを追加
              return this.allMembers.some((m) => m.name === name);
            });
          assignees.push(...names);
        }
        
        // フィルター値とマッチするか確認（複数選択対応）
        return assignees.some((assignee) =>
          this.filters.assignee.some(
            (filterAssignee) =>
              assignee.toLowerCase() === filterAssignee.toLowerCase()
          )
        );
      });
    }

    // 優先度でフィルタリング（複数選択対応）
    if (this.filters.priority.length > 0) {
      filteredTasks = filteredTasks.filter((task) =>
        this.filters.priority.includes(task.priority)
      );
    }

    // ステータスでフィルタリング（複数選択対応）
    if (this.filters.status.length > 0) {
      filteredTasks = filteredTasks.filter((task) =>
        this.filters.status.includes(task.status)
      );
    }

    // タグでフィルタリング
    if (this.filters.tags.length > 0) {
      filteredTasks = filteredTasks.filter((task) =>
        this.filters.tags.some((tag) => task.tags?.includes(tag))
      );
    }

    // フリーワードでフィルタリング
    if (this.filters.freeWord.trim()) {
      const searchWord = this.filters.freeWord.toLowerCase();
      filteredTasks = filteredTasks.filter(
        (task) =>
          task.taskName.toLowerCase().includes(searchWord) ||
          task.description?.toLowerCase().includes(searchWord) ||
          task.projectName.toLowerCase().includes(searchWord)
      );
    }

    this.searchResults = filteredTasks.map((task) =>
      this.withTaskTheme(task)
    );
    console.log('検索結果:', this.searchResults);
    console.log(
      '検索結果のタスク詳細:',
      this.searchResults.map((task) => ({
        id: task.id,
        projectId: task.projectId,
        taskName: task.taskName,
        projectName: task.projectName,
        assignee: task.assignee,
      }))
    );
    this.isLoading = false;
  }

  clearFilters() {
    this.filters = {
      assignee: [],
      priority: [],
      status: [],
      tags: [],
      freeWord: '',
    };
    this.searchResults = [];
    this.hasSearched = false;
  }

  addTag(tag: string) {
    if (tag && !this.filters.tags.includes(tag)) {
      this.filters.tags.push(tag);
    }
  }

  removeTag(tag: string) {
    this.filters.tags = this.filters.tags.filter((t) => t !== tag);
  }

  goToTaskDetail(task: Task, event?: Event) {
    if (event) {
      event.stopPropagation();
    }

    console.log('タスク詳細画面に遷移:', task);
    console.log('projectId:', task.projectId, 'id:', task.id);

    if (task.projectId && task.id) {
      this.router.navigate(['/project', task.projectId, 'task', task.id]);
    } else {
      console.error('タスクのprojectIdまたはidが不足しています:', {
        projectId: task.projectId,
        id: task.id,
        task: task,
      });
    }
  }

  private updateThemeColorMap(projects: IProject[]): void {
    this.themeColorByProjectId = projects.reduce((acc, project) => {
      if (project.id) {
        acc[project.id] = resolveProjectThemeColor(project);
      }
      return acc;
    }, {} as Record<string, string>);
  }

  private getProjectThemeColor(projectId?: string): string {
    if (!projectId) {
      return this.defaultThemeColor;
    }
    return this.themeColorByProjectId[projectId] || this.defaultThemeColor;
  }

  private withTaskTheme(task: Task): Task {
    const color =
      task.projectThemeColor || this.getProjectThemeColor(task.projectId);
    return {
      ...task,
      projectThemeColor: color,
    };
  }

  /**
   * タスクの担当者を表示（メンバー管理画面に存在しない名前は除外）
   */
  getTaskAssigneeDisplay(task: Task): string {
    // assignedMembers がある場合はそれを使用
    if (task.assignedMembers && task.assignedMembers.length > 0) {
      const display = getMemberNamesAsString(
        task.assignedMembers,
        this.allMembers,
        ', ',
        this.languageService
      );
      const notSetText = this.languageService.translate('common.notSet');
      return display === notSetText ? '—' : display;
    }

    // assignedMembers がない場合は assignee から最新のメンバー名を取得
    if (!task.assignee) {
      return '—';
    }

    // assignee がカンマ区切りの場合を考慮
    const assigneeNames = task.assignee.split(',').map(name => name.trim());
    const updatedNames = assigneeNames
      .map(name => {
        const member = this.allMembers.find((m) => m.name === name);
        return member ? member.name : null;
      })
      .filter((name): name is string => name !== null);

    return updatedNames.length > 0 ? updatedNames.join(', ') : '—';
  }

  /**
   * 優先度の表示用テキストを取得
   */
  getPriorityDisplay(priority: string): string {
    const priorityMap: Record<string, string> = {
      '高': 'progress.priority.high',
      '中': 'progress.priority.medium',
      '低': 'progress.priority.low',
    };
    return this.languageService.translate(priorityMap[priority] || priority);
  }

  /**
   * ステータスの表示用テキストを取得
   */
  getStatusDisplay(status: string): string {
    const statusMap: Record<string, string> = {
      '完了': 'progress.status.completed',
      '作業中': 'progress.status.inProgress',
      '未着手': 'progress.status.notStarted',
    };
    return this.languageService.translate(statusMap[status] || status);
  }
}

