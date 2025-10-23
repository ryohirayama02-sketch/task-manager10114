import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ProjectService } from '../../../services/project.service';
import { Project } from '../../../models/task.model';

@Component({
  selector: 'app-projects-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './projects-overview.component.html',
  styleUrls: ['./projects-overview.component.css'],
})
export class ProjectsOverviewComponent implements OnInit {
  projects: Project[] = [];

  constructor(
    private router: Router, // ✅ Routerを追加
    private projectService: ProjectService
  ) {}

  ngOnInit() {
    this.projectService.getProjects().subscribe((data) => {
      console.log('Firestoreから取得:', data);
      this.projects = data;
    });
  }

  /** カードクリック時に個別進捗画面へ遷移 */
  goToProgress(projectId: string) {
    this.router.navigate(['/progress/projects', projectId]);
  }
}
