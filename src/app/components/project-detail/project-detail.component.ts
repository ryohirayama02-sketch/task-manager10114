import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ProjectService } from '../../services/project.service';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css'],
})
export class ProjectDetailComponent implements OnInit {
  project: any;

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService
  ) {}

  ngOnInit() {
    const projectId = this.route.snapshot.paramMap.get('projectId'); // ← route param名に注意！
    if (projectId) {
      this.projectService.getProjectById(projectId).subscribe((data) => {
        console.log('選択されたプロジェクト:', data);
        this.project = data;
      });
    }
  }
}
