import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProjectService } from '../../../services/project.service';

@Component({
  selector: 'app-projects-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './projects-overview.component.html',
})
export class ProjectsOverviewComponent implements OnInit {
  projects: any[] = [];

  constructor(private projectService: ProjectService) {}

  ngOnInit() {
    this.projectService.getProjects().subscribe((data) => {
      console.log('Firestoreから取得:', data);
      this.projects = data;
    });
  }
}
