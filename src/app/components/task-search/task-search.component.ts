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
import { Task } from '../../models/task.model';
import { IProject } from '../../models/project.model';
import {
  DEFAULT_PROJECT_THEME_COLOR,
  resolveProjectThemeColor,
} from '../../constants/project-theme-colors';

interface SearchFilters {
  assignee: string;
  priority: string;
  status: string;
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
  ],
  templateUrl: './task-search.component.html',
  styleUrl: './task-search.component.css',
})
export class TaskSearchComponent implements OnInit {
  private projectService = inject(ProjectService);
  private router = inject(Router);

  // 検索フィルター
  filters: SearchFilters = {
    assignee: '',
    priority: '',
    status: '',
    tags: [],
    freeWord: '',
  };

  // 選択肢のデータ
  assignees: string[] = [];
  priorities: string[] = ['高', '中', '低'];
  statuses: string[] = ['未着手', '作業中', '完了'];
  allTags: string[] = [];

  // 検索結果
  searchResults: Task[] = [];
  isLoading = false;
  hasSearched = false;
  private themeColorByProjectId: Record<string, string> = {};
  readonly defaultThemeColor = DEFAULT_PROJECT_THEME_COLOR;

  ngOnInit() {
    this.loadFilterOptions();
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

    // 担当者一覧を生成
    this.assignees = [
      ...new Set(
        allTasks.map((task) => task.assignee).filter((assignee) => assignee)
      ),
    ];

    // タグ一覧を生成
    const allTags = allTasks.flatMap((task) => task.tags || []);
    this.allTags = [...new Set(allTags)];

    console.log('生成された選択肢:', {
      assignees: this.assignees,
      allTags: this.allTags,
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
      }))
    );

    let filteredTasks = [...allTasks];

    // 担当者でフィルタリング（カンマ区切り対応）
    if (this.filters.assignee) {
      filteredTasks = filteredTasks.filter((task) => {
        if (!task.assignee) {
          return false;
        }
        // assignee をカンマで分割
        const assignees = task.assignee
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name.length > 0);
        
        // assignedMembers も含める
        if (Array.isArray((task as any).assignedMembers)) {
          assignees.push(
            ...(task as any).assignedMembers.map((m: string) => String(m).trim())
          );
        }
        
        // フィルター値とマッチするか確認
        return assignees.some(
          (assignee) => assignee.toLowerCase() === this.filters.assignee.toLowerCase()
        );
      });
    }

    // 優先度でフィルタリング
    if (this.filters.priority) {
      filteredTasks = filteredTasks.filter(
        (task) => task.priority === this.filters.priority
      );
    }

    // ステータスでフィルタリング
    if (this.filters.status) {
      filteredTasks = filteredTasks.filter(
        (task) => task.status === this.filters.status
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
      assignee: '',
      priority: '',
      status: '',
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
}
