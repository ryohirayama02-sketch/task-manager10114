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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private location: Location,
    private languageService: LanguageService
  ) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId');
    console.log('プロジェクトID:', this.projectId); // ← 確認ポイント

    if (this.projectId) {
      // プロジェクト本体の情報を取得
      this.projectService.getProjectById(this.projectId).subscribe((data) => {
        console.log('選択されたプロジェクト:', data);
        this.project = data;
        this.projectThemeColor = resolveProjectThemeColor(data);
        this.tasks = this.tasks.map((task) => this.withTaskTheme(task));
      });

      // 🔹 サブコレクション tasks を取得
      this.projectService
        .getTasksByProjectId(this.projectId)
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
}
