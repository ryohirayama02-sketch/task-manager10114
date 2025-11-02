import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
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
    MatMenuModule,
    ProgressCircleComponent,
  ],
  templateUrl: './projects-overview.component.html',
  styleUrls: ['./projects-overview.component.css'],
})
export class ProjectsOverviewComponent implements OnInit {
  private readonly sortStorageKey = 'projectsOverview.sortOption';
  readonly sortOptions = [
    { value: 'endDateAsc', label: '期日が近い順' },
    { value: 'endDateDesc', label: '期日が遠い順' },
    { value: 'progressDesc', label: '進捗率が高い順' },
    { value: 'progressAsc', label: '進捗率が低い順' },
  ] as const;
  sortOption: (typeof this.sortOptions)[number]['value'] = 'endDateAsc';
  projects: IProject[] = [];
  projectProgress: { [key: string]: ProjectProgress } = {};
  readonly defaultThemeColor = DEFAULT_PROJECT_THEME_COLOR;

  constructor(
    private router: Router, // ✅ Routerを追加
    private projectService: ProjectService,
    private progressService: ProgressService
  ) {}

  ngOnInit() {
    const storedOption = localStorage.getItem(this.sortStorageKey);
    if (this.isValidSortOption(storedOption)) {
      this.sortOption = storedOption;
    }

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
        this.applySort();
      }
      this.applySort();
    });
  }

  /** カードクリック時に個別進捗画面へ遷移 */
  goToProgress(projectId: string) {
    this.router.navigate(['/project', projectId]);
  }

  openProjectForm(): void {
    this.router.navigate(['/project-form'], {
      state: { returnUrl: this.router.url },
    });
  }

  onSortChange(option: (typeof this.sortOptions)[number]['value']): void {
    if (this.sortOption === option) {
      return;
    }
    this.sortOption = option;
    localStorage.setItem(this.sortStorageKey, option);
    this.applySort();
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

  getSortLabel(optionValue: (typeof this.sortOptions)[number]['value']): string {
    return (
      this.sortOptions.find((option) => option.value === optionValue)?.label ||
      ''
    );
  }

  private applySort(): void {
    this.projects.sort((a, b) => {
      const aCompleted = this.isCompleted(a);
      const bCompleted = this.isCompleted(b);

      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }

      let result = 0;

      switch (this.sortOption) {
        case 'endDateDesc':
          result = this.compareEndDate(a, b, false);
          break;
        case 'progressDesc':
          result = this.compareProgress(a, b, true);
          break;
        case 'progressAsc':
          result = this.compareProgress(a, b, false);
          break;
        case 'endDateAsc':
        default:
          result = this.compareEndDate(a, b, true);
          break;
      }

      if (result !== 0) {
        return result;
      }

      // Tie-breaker: use終了日昇順 → プロジェクト名
      const dateTieBreak = this.compareEndDate(a, b, true);
      if (dateTieBreak !== 0) {
        return dateTieBreak;
      }

      return this.compareByName(a, b);
    });
  }

  private parseDate(date?: string): number | null {
    if (!date) {
      return null;
    }
    const time = new Date(date).getTime();
    return Number.isNaN(time) ? null : time;
  }

  private isValidSortOption(
    value: string | null
  ): value is (typeof this.sortOptions)[number]['value'] {
    return this.sortOptions.some((option) => option.value === value);
  }

  private getProgressPercentage(project: IProject): number {
    return this.projectProgress[project.id || '']?.progressPercentage ?? 0;
  }

  private isCompleted(project: IProject): boolean {
    return this.getProgressPercentage(project) === 100;
  }

  private compareEndDate(
    a: IProject,
    b: IProject,
    ascending: boolean
  ): number {
    const aTime = this.parseDate(a.endDate);
    const bTime = this.parseDate(b.endDate);

    if (aTime === null && bTime === null) return 0;
    if (aTime === null) return 1;
    if (bTime === null) return -1;

    return ascending ? aTime - bTime : bTime - aTime;
  }

  private compareProgress(
    a: IProject,
    b: IProject,
    descending: boolean
  ): number {
    const aProgress = this.getProgressPercentage(a);
    const bProgress = this.getProgressPercentage(b);
    return descending ? bProgress - aProgress : aProgress - bProgress;
  }

  private compareByName(a: IProject, b: IProject): number {
    return (a.projectName || '').localeCompare(b.projectName || '');
  }
}
