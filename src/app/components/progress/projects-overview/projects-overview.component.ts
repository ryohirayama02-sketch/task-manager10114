import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProjectService } from '../../../services/project.service';
import {
  ProgressService,
  ProjectProgress,
} from '../../../services/progress.service';
import { IProject } from '../../../models/project.model';
import { ProgressCircleComponent } from './progress-circle.component';
import {
  DEFAULT_PROJECT_THEME_COLOR,
  resolveProjectThemeColor,
} from '../../../constants/project-theme-colors';

@Component({
  selector: 'app-projects-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    ProgressCircleComponent,
  ],
  templateUrl: './projects-overview.component.html',
  styleUrls: ['./projects-overview.component.css'],
})
export class ProjectsOverviewComponent implements OnInit {
  projects: IProject[] = [];
  projectProgress: { [key: string]: ProjectProgress } = {};
  readonly defaultThemeColor = DEFAULT_PROJECT_THEME_COLOR;

  constructor(
    private router: Router, // ✅ Routerを追加
    private projectService: ProjectService,
    private progressService: ProgressService
  ) {}

  ngOnInit() {
    this.projectService.getProjects().subscribe(async (data) => {
      console.log('Firestoreから取得:', data);
      this.projects = data;

      // 各プロジェクトの進捗率を取得
      if (data.length > 0) {
        const projectIds = data.map((p) => p.id).filter((id) => id) as string[];
        console.log('プロジェクト一覧:', data);
        console.log('プロジェクトID一覧:', projectIds);
        const progressData = await this.progressService.getAllProjectsProgress(
          projectIds
        );

        // 進捗データをマップに変換
        this.projectProgress = {};
        progressData.forEach((progress) => {
          console.log('プロジェクト進捗データ:', progress);
          this.projectProgress[progress.projectId] = progress;
        });
        console.log('全プロジェクト進捗マップ:', this.projectProgress);

        // プロジェクトを進捗率でソート（100%完了は下に）
        this.sortProjectsByProgress();
      }
    });
  }

  /** カードクリック時に個別進捗画面へ遷移 */
  goToProgress(projectId: string) {
    this.router.navigate(['/progress/projects', projectId]);
  }

  /** プロジェクトを進捗率でソート（100%完了は下に表示） */
  private sortProjectsByProgress(): void {
    this.projects.sort((a, b) => {
      const progressA =
        this.projectProgress[a.id || '']?.progressPercentage || 0;
      const progressB =
        this.projectProgress[b.id || '']?.progressPercentage || 0;

      // 100%完了のプロジェクトは下に表示
      if (progressA === 100 && progressB !== 100) {
        return 1; // aをbより後に
      }
      if (progressB === 100 && progressA !== 100) {
        return -1; // bをaより後に
      }

      // 両方とも100%または両方とも100%でない場合は、進捗率の昇順でソート
      return progressA - progressB;
    });

    console.log(
      'ソート後のプロジェクト一覧:',
      this.projects.map((p) => ({
        name: p.projectName,
        progress: this.projectProgress[p.id || '']?.progressPercentage || 0,
      }))
    );
  }

  getMemberDisplay(project: IProject): string {
    const members: any = (project as any).members;
    if (!members) {
      return '（メンバー情報未設定）';
    }
    if (Array.isArray(members)) {
      const names = members
        .map((member) => member?.memberName || member?.name || '')
        .filter((name) => !!name);
      return names.length > 0 ? names.join(', ') : '（メンバー情報未設定）';
    }
    if (typeof members === 'string') {
      return members || '（メンバー情報未設定）';
    }
    return '（メンバー情報未設定）';
  }

  getProjectThemeColor(project?: IProject | null): string {
    return resolveProjectThemeColor(project || undefined);
  }

  toDateDisplay(date?: string): string {
    if (!date) {
      return '（未設定）';
    }
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
}
