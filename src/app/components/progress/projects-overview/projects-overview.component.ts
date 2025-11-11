import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
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
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { LanguageService } from '../../../services/language.service';
import { AuthService } from '../../../services/auth.service';
import { MemberManagementService } from '../../../services/member-management.service';
import { Member } from '../../../models/member.model';
import { combineLatest, of, Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-projects-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCardModule,
    ProgressCircleComponent,
    TranslatePipe,
  ],
  templateUrl: './projects-overview.component.html',
  styleUrls: ['./projects-overview.component.css'],
})
export class ProjectsOverviewComponent implements OnInit, OnDestroy {
  private readonly sortStorageKey = 'projectsOverview.sortOption';
  sortOptions: Array<{ value: 'endDateAsc' | 'endDateDesc' | 'progressDesc' | 'progressAsc'; label: string }> = [];
  private readonly projectNameMaxLength = 39;
  sortOption: 'endDateAsc' | 'endDateDesc' | 'progressDesc' | 'progressAsc' = 'endDateAsc';
  projects: IProject[] = [];
  projectProgress: { [key: string]: ProjectProgress } = {};
  readonly defaultThemeColor = DEFAULT_PROJECT_THEME_COLOR;
  private destroy$ = new Subject<void>();
  private currentUserEmail: string | null = null;
  private progressRequestId = 0;
  members: Member[] = [];

  constructor(
    private router: Router,
    private projectService: ProjectService,
    private progressService: ProgressService,
    private languageService: LanguageService,
    private authService: AuthService,
    private memberManagementService: MemberManagementService
  ) {
    this.initializeSortOptions();
  }

  private initializeSortOptions() {
    this.sortOptions = [
      { value: 'endDateAsc', label: this.languageService.translate('progress.projects.sortBy.dueDate') + ' - ' + this.languageService.translate('progress.projects.sortBy.soon') },
      { value: 'endDateDesc', label: this.languageService.translate('progress.projects.sortBy.dueDate') + ' - ' + this.languageService.translate('progress.projects.sortBy.later') },
      { value: 'progressDesc', label: this.languageService.translate('progress.projects.sortBy.progress') + ' - ' + this.languageService.translate('progress.projects.sortBy.high') },
      { value: 'progressAsc', label: this.languageService.translate('progress.projects.sortBy.progress') + ' - ' + this.languageService.translate('progress.projects.sortBy.low') },
    ];
  }

  ngOnInit() {
    // メンバー一覧を読み込み
    this.memberManagementService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
      },
    });

    const storedOption = localStorage.getItem(this.sortStorageKey);
    if (this.isValidSortOption(storedOption)) {
      this.sortOption = storedOption;
    }

    this.observeUserProjects();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
    const notSetText = this.languageService.translate('progress.projects.membersNotSet');
    if (!members) {
      return notSetText;
    }
    if (Array.isArray(members)) {
      const names = members
        .map((member) => member?.memberName || member?.name || '')
        .filter((name) => !!name)
        .filter((name) => {
          // メンバー管理画面に存在する名前のみを表示
          return this.members.some((m) => m.name === name);
        });
      return names.length > 0 ? names.join(', ') : notSetText;
    }
    if (typeof members === 'string') {
      // カンマ区切りの文字列の場合
      const memberNames = members
        .split(',')
        .map((name) => name.trim())
        .filter((name) => !!name)
        .filter((name) => {
          // メンバー管理画面に存在する名前のみを表示
          return this.members.some((m) => m.name === name);
        });
      return memberNames.length > 0 ? memberNames.join(', ') : notSetText;
    }
    return notSetText;
  }

  /**
   * プロジェクトの責任者を表示（メンバー管理画面に存在しない名前は除外）
   */
  getResponsiblesDisplay(project: IProject): string {
    const notSetText = this.languageService.translate('progress.projects.responsibleNotSet');
    if (!project) {
      return notSetText;
    }
    
    // responsibles が配列で、memberId が含まれている場合は、それを使って最新のメンバー名を取得
    if (Array.isArray(project.responsibles) && project.responsibles.length > 0) {
      const names: string[] = [];
      project.responsibles.forEach((entry) => {
        // memberId がある場合は、それを使って最新のメンバー名を取得
        if (entry.memberId) {
          const member = this.members.find((m) => m.id === entry.memberId);
          if (member && member.name) {
            names.push(member.name);
          } else if (entry.memberName) {
            // memberId で見つからない場合は、メンバー管理画面に存在するかチェック
            const memberByName = this.members.find((m) => m.name === entry.memberName);
            if (memberByName && memberByName.name) {
              names.push(memberByName.name);
            }
          }
        } else if (entry.memberName) {
          // memberId がない場合は、メンバー名で検索
          const member = this.members.find((m) => m.name === entry.memberName);
          if (member && member.name) {
            names.push(member.name);
          }
          // メンバー管理画面に存在しない名前は表示しない
        }
      });
      return names.length > 0 ? names.join(', ') : notSetText;
    }
    
    // responsibles がない場合は、responsible フィールドから取得
    if (project.responsible) {
      const names = project.responsible
        .split(',')
        .map((name) => name.trim())
        .filter((name) => !!name)
        .filter((name) => {
          // メンバー管理画面に存在する名前のみを表示
          return this.members.some((m) => m.name === name);
        });
      return names.length > 0 ? names.join(', ') : notSetText;
    }
    
    return notSetText;
  }

  getProjectThemeColor(project?: IProject | null): string {
    return resolveProjectThemeColor(project || undefined);
  }

  formatProjectName(projectName?: string | null): string {
    const name = (projectName ?? '').trim();
    const fallback = this.languageService.translate('common.nameNotSet');
    const displayName = name.length > 0 ? name : fallback;

    if (displayName.length <= this.projectNameMaxLength) {
      return displayName;
    }

    const truncatedLength = Math.max(this.projectNameMaxLength - 3, 0);
    return displayName.slice(0, truncatedLength) + '...';
  }

  toDateDisplay(date?: string): string {
    if (!date) {
      return this.languageService.translate('common.notSet');
    }
    const currentLanguage = this.languageService.getCurrentLanguage();
    const locale = currentLanguage === 'en' ? 'en-US' : 'ja-JP';
    return new Date(date).toLocaleDateString(locale, {
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

  private observeUserProjects(): void {
    this.authService.currentUserEmail$
      .pipe(
        switchMap((userEmail) => {
          console.log('🔑 現在のユーザー情報(進捗一覧):', { userEmail });

          this.currentUserEmail = userEmail;

          if (!userEmail) {
            this.resetProjectState();
            return of([]);
          }

          return this.projectService.getProjects();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((projects) => {
        console.log('🎯 進捗表示対象ルーム内全プロジェクト:', projects);

        if (!this.currentUserEmail) {
          return;
        }

        if (!projects || projects.length === 0) {
          this.resetProjectState();
          return;
        }

        this.updateProjectsWithProgress(projects).catch((error) =>
          console.error('全プロジェクト進捗の取得に失敗しました:', error)
        );
      });
  }

  private async updateProjectsWithProgress(projects: IProject[]): Promise<void> {
    this.projects = projects;
    this.projectProgress = {};

    const requestId = ++this.progressRequestId;

    console.log('Firestoreから取得(フィルタ済み):', projects);

    if (projects.length === 0) {
      if (requestId === this.progressRequestId) {
        this.applySort();
      }
      return;
    }

    const projectIds = projects
      .map((p) => p.id)
      .filter((id): id is string => !!id);

    console.log('プロジェクトID一覧:', projectIds);

    if (projectIds.length > 0) {
      try {
        const progressData = await this.progressService.getAllProjectsProgress(
          projectIds
        );

        if (requestId !== this.progressRequestId) {
          return;
        }

        const progressMap: { [key: string]: ProjectProgress } = {};
        progressData.forEach((progress) => {
          console.log('プロジェクト進捗データ:', progress);
          progressMap[progress.projectId] = progress;
        });

        this.projectProgress = progressMap;
        console.log('全プロジェクト進捗マップ:', this.projectProgress);
      } catch (error) {
        if (requestId !== this.progressRequestId) {
          return;
        }
        console.error('進捗データ取得エラー:', error);
        this.projectProgress = {};
      }
    }

    if (requestId === this.progressRequestId) {
      this.applySort();
    }
  }

  private resetProjectState(): void {
    this.progressRequestId++;
    this.projects = [];
    this.projectProgress = {};
    this.applySort();
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
