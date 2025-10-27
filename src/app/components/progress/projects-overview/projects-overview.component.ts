import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ProjectService } from '../../../services/project.service';
import {
  ProgressService,
  ProjectProgress,
} from '../../../services/progress.service';
import { Project } from '../../../models/task.model';
import { ProgressCircleComponent } from './progress-circle.component';

@Component({
  selector: 'app-projects-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, ProgressCircleComponent],
  templateUrl: './projects-overview.component.html',
  styleUrls: ['./projects-overview.component.css'],
})
export class ProjectsOverviewComponent implements OnInit {
  projects: Project[] = [];
  projectProgress: { [key: string]: ProjectProgress } = {};

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
      }
    });
  }

  /** カードクリック時に個別進捗画面へ遷移 */
  goToProgress(projectId: string) {
    this.router.navigate(['/progress/projects', projectId]);
  }
}
