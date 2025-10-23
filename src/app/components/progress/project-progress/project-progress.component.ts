import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProjectService } from '../../../services/project.service';
import { Task } from '../../../models/task.model';
import { IProject } from '../../../models/project.model'; //

@Component({
  selector: 'app-project-progress',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './project-progress.component.html',
  styleUrls: ['./project-progress.component.css'],
})
export class ProjectProgressComponent implements OnInit {
  project: IProject | null = null;
  tasks: Task[] = [];

  projectId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService
  ) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('projectId');
    console.log('プロジェクトID:', this.projectId); // ← 確認ポイント

    if (this.projectId) {
      // プロジェクト本体の情報を取得
      this.projectService.getProjectById(this.projectId).subscribe((data) => {
        console.log('選択されたプロジェクト:', data);
        this.project = data;
      });

      // 🔹 サブコレクション tasks を取得
      this.projectService
        .getTasksByProjectId(this.projectId)
        .subscribe((taskList) => {
          this.tasks = taskList;
        });
    }
  }

  /** タスク詳細画面を開く */
  openTaskDetail(task: Task) {
    if (this.projectId && task.id) {
      this.router.navigate(['/project', this.projectId, 'task', task.id]);
    }
  }
}
