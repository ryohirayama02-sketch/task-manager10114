import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { ProjectSelectionService } from '../../services/project-selection.service';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../services/auth.service';
import { Task } from '../../models/task.model';
import { IProject } from '../../models/project.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { MemberManagementService } from '../../services/member-management.service';
import { Member } from '../../models/member.model';
import {
  Observable,
  forkJoin,
  of,
  firstValueFrom,
  combineLatest,
  Subject,
} from 'rxjs';
import { map, switchMap, filter, take, takeUntil } from 'rxjs/operators';
import {
  getMemberNamesAsString,
  getMemberNames,
} from '../../utils/member-utils';

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatDialogModule,
    MatMenuModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatChipsModule,
    MatSnackBarModule,
    FormsModule,
    TranslatePipe,
  ],
  templateUrl: './kanban.component.html',
  styleUrls: ['./kanban.component.css'],
})
export class KanbanComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  projects: IProject[] = [];
  selectedProjectIds: string[] = [];
  allTasks: Task[] = []; // 全プロジェクトのタスクを保持
  statuses = ['未着手', '作業中', '完了'];
  private tasksByProject: Map<string, Task[]> = new Map<string, Task[]>();

  // ✅ 追加: メモリリーク防止用のSubject
  private destroy$ = new Subject<void>();

  // フィルター用
  filterPriority: string[] = [];
  filterAssignee: string[] = [];
  members: Member[] = []; // メンバー一覧

  // ✅ 追加: ステータス変更中のフラグ（重複実行防止）
  private isChangingStatus = false;

  // メンバー数チェック
  get hasMembers(): boolean {
    return this.members.length > 0;
  }

  constructor(
    private taskService: TaskService,
    private projectService: ProjectService,
    private projectSelectionService: ProjectSelectionService,
    private dialog: MatDialog,
    private router: Router,
    private languageService: LanguageService,
    private authService: AuthService,
    private memberManagementService: MemberManagementService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // メンバー一覧を読み込み
    this.memberManagementService
      .getMembers()
      .pipe(takeUntil(this.destroy$)) // ✅ 追加: メモリリーク防止
      .subscribe({
        next: (members) => {
          // ✅ 修正: コンポーネントが破棄されていないかチェック
          if (this.destroy$.closed) {
            console.log(
              '[ngOnInit] コンポーネントが破棄されたため、メンバー処理をスキップします'
            );
            return;
          }
          // ✅ 修正: membersが配列でない場合の処理を追加
          if (!Array.isArray(members)) {
            console.error('メンバー一覧が配列ではありません:', members);
            this.members = [];
            return;
          }
          this.members = members;
          console.log('メンバー一覧を読み込みました:', members.length, '件');
        },
        error: (error) => {
          // ✅ 修正: コンポーネントが破棄されていないかチェック
          if (this.destroy$.closed) {
            console.log(
              '[ngOnInit] コンポーネントが破棄されたため、エラー処理をスキップします'
            );
            return;
          }
          console.error('メンバー一覧の読み込みエラー:', error);
        },
      });

    // ✅ 修正: roomIdが設定されるまで待ってから処理を進める（PCとスマホのタイミング差を解消）
    combineLatest([
      this.authService.currentUserEmail$,
      this.authService.currentRoomId$,
    ])
      .pipe(
        filter(([userEmail, roomId]) => {
          return !userEmail || !!roomId; // roomIdがnullの場合は処理をスキップ
        }),
        take(1), // 最初の有効な値のみを使用
        switchMap(([userEmail, roomId]) => {
          console.log('🔑 現在のユーザー情報:', { userEmail, roomId });
          if (!userEmail || !roomId) {
            this.resetProjectState(true);
            return of([]);
          }
          return this.projectService.getProjects();
        }),
        takeUntil(this.destroy$) // ✅ 追加: メモリリーク防止
      )
      .subscribe({
        next: (projects) => {
          // ✅ 修正: コンポーネントが破棄されていないかチェック
          if (this.destroy$.closed) {
            console.log(
              '[ngOnInit] コンポーネントが破棄されたため、プロジェクト処理をスキップします'
            );
            return;
          }
          console.log('🎯 カンバン用ルーム内全プロジェクト一覧:', projects);
          // ✅ 修正: projectsが配列でない場合の処理を追加
          if (!Array.isArray(projects)) {
            console.error('プロジェクト一覧が配列ではありません:', projects);
            this.resetProjectState();
            this.projectSelectionService.clearSelection();
            return;
          }
          if (projects.length === 0) {
            this.resetProjectState();
            this.projectSelectionService.clearSelection();
            return;
          }

          this.applyProjectList(projects);
        },
        error: (error) => {
          // ✅ 修正: コンポーネントが破棄されていないかチェック
          if (this.destroy$.closed) {
            console.log(
              '[ngOnInit] コンポーネントが破棄されたため、エラー処理をスキップします'
            );
            return;
          }
          console.error('❌ プロジェクト取得エラー（オフライン等）:', error);
          // ✅ 修正: オフライン時などエラーが発生した場合でも、既存のプロジェクトデータを保持
          if (this.projects.length === 0) {
            this.resetProjectState();
            this.projectSelectionService.clearSelection();
          }
        },
      });

    // プロジェクト選択状態の変更を監視
    this.projectSelectionService
      .getSelectedProjectIds()
      .pipe(takeUntil(this.destroy$)) // ✅ 追加: メモリリーク防止
      .subscribe((projectIds: string[]) => {
        // ✅ 修正: コンポーネントが破棄されていないかチェック
        if (this.destroy$.closed) {
          console.log(
            '[ngOnInit] コンポーネントが破棄されたため、プロジェクト選択処理をスキップします'
          );
          return;
        }
        // ✅ 修正: projectIdsが配列でない場合の処理を追加
        if (!Array.isArray(projectIds)) {
          console.error('プロジェクトID一覧が配列ではありません:', projectIds);
          this.selectedProjectIds = [];
          return;
        }
        this.selectedProjectIds = projectIds;
        this.filterTasksBySelectedProjects();
      });
  }

  ngOnDestroy(): void {
    // ✅ 追加: 購読を解除してメモリリークを防止
    this.destroy$.next();
    this.destroy$.complete();
  }

  private applyProjectList(projects: IProject[]): void {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      console.log(
        '[applyProjectList] コンポーネントが破棄されたため、処理をスキップします'
      );
      return;
    }
    // ✅ 修正: projectsが配列でない場合の処理を追加
    if (!Array.isArray(projects)) {
      console.error('projectsが配列ではありません:', projects);
      this.projects = [];
      return;
    }
    this.projects = projects;

    const storedSelection =
      this.projectSelectionService.getSelectedProjectIdsSync();
    // ✅ 修正: storedSelectionが配列でない場合の処理を追加
    const validStoredSelection = Array.isArray(storedSelection)
      ? storedSelection
      : [];
    const availableIds = new Set(
      projects.map((project) => project.id).filter((id): id is string => !!id)
    );

    let nextSelection = validStoredSelection.filter((id) =>
      availableIds.has(id)
    );

    // 初回起動時（ストレージに保存がない場合）のみ、すべてのプロジェクトを選択
    // ユーザーが意図的にすべてのチェックを外した場合は、空配列のまま保持
    if (
      nextSelection.length === 0 &&
      !this.projectSelectionService.hasStoredSelection()
    ) {
      // 初回起動時のみ、すべてのプロジェクトを選択
      const allIds = Array.from(availableIds);
      nextSelection = allIds;
    }

    if (nextSelection.length > 0) {
      this.projectSelectionService.setSelectedProjectIds(nextSelection);
    } else {
      this.projectSelectionService.clearSelection();
    }
    this.selectedProjectIds = nextSelection;

    this.loadAllTasks();
    this.filterTasksBySelectedProjects();
  }

  /** 全プロジェクトのタスクを読み込み */
  private loadAllTasks(): void {
    this.allTasks = [];
    this.tasksByProject.clear();
    // ✅ 修正: projectsが配列でない場合の処理を追加
    if (!Array.isArray(this.projects)) {
      console.error('projectsが配列ではありません:', this.projects);
      return;
    }
    this.projects.forEach((project) => {
      // ✅ 修正: projectがnullやundefinedの場合をスキップ
      if (!project || !project.id) {
        return;
      }
      this.projectService
        .getTasksByProjectId(project.id)
        .pipe(takeUntil(this.destroy$)) // ✅ 追加: メモリリーク防止
        .subscribe({
          next: (tasks) => {
            // ✅ 修正: コンポーネントが破棄されていないかチェック
            if (this.destroy$.closed) {
              console.log(
                '[loadAllTasks] コンポーネントが破棄されたため、状態更新をスキップします'
              );
              return;
            }
            // ✅ 修正: tasksが配列でない場合の処理を追加
            if (!Array.isArray(tasks)) {
              console.error(
                `プロジェクト ${project.id} のタスクが配列ではありません:`,
                tasks
              );
              return;
            }
            this.tasksByProject.set(project.id!, tasks);
            this.rebuildAllTasks();
          },
          error: (error) => {
            console.error(
              `プロジェクト ${project.id} のタスク読み込みエラー:`,
              error
            );
            // ✅ 修正: エラー時もコンポーネントが破棄されていないかチェック
            if (this.destroy$.closed) {
              console.log(
                '[loadAllTasks] コンポーネントが破棄されたため、エラー処理をスキップします'
              );
              return;
            }
            // ✅ 修正: ユーザーにエラーメッセージを表示
            const projectName =
              project.projectName || project.id || 'プロジェクト';
            this.snackBar.open(
              this.languageService.translateWithParams(
                'kanban.error.taskLoadFailed',
                {
                  projectName: projectName,
                }
              ),
              'Close',
              { duration: 5000 }
            );
          },
        });
    });
  }

  private rebuildAllTasks(): void {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      console.log(
        '[rebuildAllTasks] コンポーネントが破棄されたため、処理をスキップします'
      );
      return;
    }
    const aggregated: Task[] = [];
    // ✅ 修正: projectsが配列でない場合の処理を追加
    if (!Array.isArray(this.projects)) {
      console.error('projectsが配列ではありません:', this.projects);
      this.allTasks = [];
      return;
    }
    this.projects.forEach((project) => {
      // ✅ 修正: projectがnullやundefinedの場合をスキップ
      if (!project || !project.id) {
        return;
      }
      const tasks = this.tasksByProject.get(project.id) || [];
      // ✅ 修正: tasksが配列でない場合の処理を追加
      if (!Array.isArray(tasks)) {
        console.error(
          `プロジェクト ${project.id} のタスクが配列ではありません:`,
          tasks
        );
        return;
      }
      const tasksWithProject = tasks
        .filter((task) => task != null) // ✅ 修正: taskがnullやundefinedの場合をフィルタリング
        .map((task) => ({
          ...task,
          projectId: task.projectId || project.id!,
          projectName: task.projectName || project.projectName,
        }));
      aggregated.push(...tasksWithProject);
    });
    this.allTasks = aggregated;
    this.filterTasksBySelectedProjects();
  }

  private resetProjectState(includeSelection = false): void {
    this.projects = [];
    this.selectedProjectIds = [];
    this.allTasks = [];
    this.tasks = [];
    this.tasksByProject.clear();
    if (includeSelection) {
      this.projectSelectionService.clearSelection();
    }
  }

  /** 選択されたプロジェクトのタスクをフィルタリング */
  filterTasksBySelectedProjects() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      console.log(
        '[filterTasksBySelectedProjects] コンポーネントが破棄されたため、処理をスキップします'
      );
      return;
    }
    this.applyFilters();
  }

  /** フィルターを適用 */
  applyFilters() {
    // ✅ 修正: allTasksが配列でない場合の処理を追加
    if (!Array.isArray(this.allTasks)) {
      console.error('allTasksが配列ではありません:', this.allTasks);
      this.tasks = [];
      return;
    }
    let filteredTasks = [...this.allTasks];

    // 日付範囲フィルター（当月±3か月）
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const minDate = new Date(currentYear, currentMonth - 3, 1);
    const maxDate = new Date(currentYear, currentMonth + 4, 0); // 3か月後の月末日

    filteredTasks = filteredTasks.filter((task) => {
      // ✅ 修正: taskがnullやundefinedの場合をフィルタリング
      if (!task) {
        return false;
      }
      // 開始日または終了日が範囲内にあるタスクのみを表示
      const startDate = task.startDate ? new Date(task.startDate) : null;
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;

      // ✅ 修正: 日付がないタスクも表示する（日付がないタスクは常に表示）
      if (!startDate && !dueDate) {
        return true;
      }

      // 開始日が範囲内にあるか
      if (startDate && !isNaN(startDate.getTime())) {
        if (startDate >= minDate && startDate <= maxDate) {
          return true;
        }
      }

      // 終了日が範囲内にあるか
      if (dueDate && !isNaN(dueDate.getTime())) {
        if (dueDate >= minDate && dueDate <= maxDate) {
          return true;
        }
      }

      // 開始日と終了日の両方が範囲外の場合は非表示
      return false;
    });

    // プロジェクトフィルター
    if (this.selectedProjectIds.length > 0) {
      filteredTasks = filteredTasks.filter((task) => {
        // ✅ 修正: taskがnullやundefinedの場合をフィルタリング
        if (!task) {
          return false;
        }
        // ✅ 修正: task.projectIdがundefinedやnullの場合の処理を追加
        return (
          task.projectId && this.selectedProjectIds.includes(task.projectId)
        );
      });
    } else {
      // プロジェクトが選択されていない場合は空配列
      filteredTasks = [];
    }

    // 優先度フィルター
    if (this.filterPriority.length > 0) {
      filteredTasks = filteredTasks.filter((task) => {
        // ✅ 修正: taskがnullやundefinedの場合をフィルタリング
        if (!task) {
          return false;
        }
        // ✅ 修正: task.priorityがundefinedやnullの場合の処理を追加
        return task.priority && this.filterPriority.includes(task.priority);
      });
    }

    // 担当者フィルター（assignedMembers（メンバーID配列）から取得）
    if (this.filterAssignee.length > 0) {
      filteredTasks = filteredTasks.filter((task) => {
        // ✅ 修正: taskがnullやundefinedの場合をフィルタリング
        if (!task) {
          return false;
        }
        const assignees: string[] = [];

        // assignedMembers から取得（メンバーIDをメンバー名に変換）
        // ✅ 修正: membersがundefinedやnullの場合の処理を追加
        if (
          Array.isArray(task.assignedMembers) &&
          task.assignedMembers.length > 0 &&
          this.members &&
          this.members.length > 0
        ) {
          const memberNames = getMemberNames(
            task.assignedMembers,
            this.members
          );
          // ✅ 修正: memberNamesが配列でない場合の処理を追加
          if (Array.isArray(memberNames)) {
            assignees.push(...memberNames);
          }
        }

        // 担当者がいない場合はフィルターにマッチしない
        if (assignees.length === 0) {
          return false;
        }

        // フィルター値とマッチするか確認（いずれかの担当者がフィルターに含まれていればOK）
        return assignees.some((assignee) => {
          // ✅ 修正: assigneeがnullやundefinedの場合をスキップ
          if (!assignee) {
            return false;
          }
          return this.filterAssignee.includes(assignee);
        });
      });
    }

    // ✅ 修正: filteredTasksが配列でない場合の処理を追加
    if (!Array.isArray(filteredTasks)) {
      console.error('filteredTasksが配列ではありません:', filteredTasks);
      this.tasks = [];
      return;
    }
    // フィルター後の結果を表示
    this.tasks = filteredTasks;
    console.log('フィルタリング後のタスク:', this.tasks);
  }

  /** フィルターをリセット */
  resetFilters() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      console.log(
        '[resetFilters] コンポーネントが破棄されたため、処理をスキップします'
      );
      return;
    }
    this.filterPriority = [];
    this.filterAssignee = [];
    this.applyFilters();
  }

  /** ユニークな担当者一覧を取得（assignedMembers（メンバーID配列）から取得） */
  getUniqueAssignees(): string[] {
    const assigneeSet = new Set<string>();

    // ✅ 修正: membersがundefinedやnullの場合の処理を追加
    if (!this.members || this.members.length === 0) {
      return [];
    }

    // ✅ 修正: allTasksが配列でない場合の処理を追加
    if (!Array.isArray(this.allTasks)) {
      console.error('allTasksが配列ではありません:', this.allTasks);
      return [];
    }

    // 全タスクのassignedMembersからメンバー名を取得
    this.allTasks.forEach((task) => {
      // ✅ 修正: taskがnullやundefinedの場合をスキップ
      if (!task) {
        return;
      }
      if (
        Array.isArray(task.assignedMembers) &&
        task.assignedMembers.length > 0
      ) {
        const memberNames = getMemberNames(task.assignedMembers, this.members);
        // ✅ 修正: memberNamesが配列でない場合の処理を追加
        if (Array.isArray(memberNames)) {
          memberNames.forEach((name) => {
            // ✅ 修正: nameがnullやundefinedの場合をスキップ
            if (name) {
              assigneeSet.add(name);
            }
          });
        }
      }
    });

    // メンバー管理画面のメンバー一覧からも取得（assignedMembersに含まれていないメンバーも選択肢に含める）
    this.members.forEach((member) => {
      // ✅ 修正: memberがnullやundefinedの場合をスキップ
      if (!member) {
        return;
      }
      if (member.name) {
        // メンバー名がカンマ区切りの場合も分割
        const names = member.name
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        names.forEach((name) => {
          // ✅ 修正: nameがnullやundefinedの場合をスキップ
          if (name) {
            assigneeSet.add(name);
          }
        });
      }
    });

    return Array.from(assigneeSet).sort();
  }

  /** プロジェクトが選択されているかチェック */
  isProjectSelected(projectId: string): boolean {
    // ✅ 修正: projectIdがundefinedやnullの場合の処理を追加
    if (!projectId) {
      return false;
    }
    return this.selectedProjectIds.includes(projectId);
  }

  /** プロジェクトをすべて選択 */
  selectAllProjects() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      console.log(
        '[selectAllProjects] コンポーネントが破棄されたため、処理をスキップします'
      );
      return;
    }
    // ✅ 修正: projectsが配列でない場合の処理を追加
    if (!Array.isArray(this.projects)) {
      console.error('projectsが配列ではありません:', this.projects);
      return;
    }
    const allIds = this.projects
      .filter((project) => project != null) // ✅ 修正: projectがnullやundefinedの場合をフィルタリング
      .map((project) => project.id)
      .filter((id): id is string => !!id);
    this.selectedProjectIds = allIds;
    this.projectSelectionService.setSelectedProjectIds(allIds);
  }

  /** プロジェクト選択を全て解除 */
  clearProjectSelection() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      console.log(
        '[clearProjectSelection] コンポーネントが破棄されたため、処理をスキップします'
      );
      return;
    }
    this.selectedProjectIds = [];
    this.projectSelectionService.clearSelection();
  }

  private async refreshProjectTasks(projectId: string): Promise<void> {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      console.log(
        '[refreshProjectTasks] コンポーネントが破棄されたため、処理をスキップします'
      );
      return;
    }
    // ✅ 修正: projectIdがundefinedやnullの場合の処理を追加
    if (!projectId) {
      console.error('プロジェクトIDが指定されていません');
      return;
    }
    try {
      const userEmail = await firstValueFrom(
        this.authService.currentUserEmail$
      );

      // ✅ 修正: 非同期処理後にコンポーネントが破棄されていないかチェック
      if (this.destroy$.closed) {
        console.log(
          '[refreshProjectTasks] コンポーネントが破棄されたため、処理をスキップします'
        );
        return;
      }

      if (!userEmail) {
        return;
      }

      const tasks = await firstValueFrom(
        this.projectService.getTasksByProjectId(projectId)
      );

      // ✅ 修正: 非同期処理後にコンポーネントが破棄されていないかチェック
      if (this.destroy$.closed) {
        console.log(
          '[refreshProjectTasks] コンポーネントが破棄されたため、状態更新をスキップします'
        );
        return;
      }

      // ✅ 修正: tasksが配列でない場合の処理を追加
      if (!Array.isArray(tasks)) {
        console.error(
          `プロジェクト ${projectId} のタスクが配列ではありません:`,
          tasks
        );
        return;
      }

      this.tasksByProject.set(projectId, tasks);

      this.rebuildAllTasks();
      this.filterTasksBySelectedProjects();
    } catch (error) {
      console.error('プロジェクトタスク再取得エラー:', error);
      // ✅ 修正: エラー時もコンポーネントが破棄されていないかチェック
      if (this.destroy$.closed) {
        console.log(
          '[refreshProjectTasks] コンポーネントが破棄されたため、エラー処理をスキップします'
        );
        return;
      }
    }
  }

  /** プロジェクト選択をトグル */
  toggleProjectSelection(projectId: string) {
    // ✅ 修正: projectIdがundefinedやnullの場合の処理を追加
    if (!projectId) {
      console.error('プロジェクトIDが指定されていません');
      return;
    }
    this.projectSelectionService.toggleProjectSelection(projectId);
  }

  /** プロジェクトIDからプロジェクト名を取得 */
  getProjectName(projectId: string): string {
    // ✅ 修正: projectIdがundefinedやnullの場合の処理を追加
    if (!projectId) {
      return '';
    }
    // ✅ 修正: projectsが配列でない場合の処理を追加
    if (!Array.isArray(this.projects)) {
      console.error('projectsが配列ではありません:', this.projects);
      return '';
    }
    const project = this.projects.find((p) => p && p.id === projectId);
    return project ? project.projectName : '';
  }

  /** ステータスでタスクをフィルター */
  filterByStatus(status: string) {
    // ✅ 修正: statusがundefinedやnullの場合の処理を追加
    if (!status) {
      return [];
    }
    // ✅ 修正: tasksが配列でない場合の処理を追加
    if (!Array.isArray(this.tasks)) {
      console.error('tasksが配列ではありません:', this.tasks);
      return [];
    }
    return this.tasks.filter((t) => t && t.status === status);
  }

  /** タスクのステータスを変更 */
  async changeTaskStatus(taskId: string, newStatus: string) {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      console.log(
        '[changeTaskStatus] コンポーネントが破棄されたため、処理をスキップします'
      );
      return;
    }

    // ✅ 修正: 重複実行を防止
    if (this.isChangingStatus) {
      console.log('[changeTaskStatus] 既にステータス変更処理が実行中です');
      return;
    }

    // ✅ 修正: taskIdやnewStatusがundefinedやnullの場合の処理を追加
    if (!taskId) {
      console.error('タスクIDが指定されていません');
      // ✅ 修正: ユーザーにエラーメッセージを表示
      if (!this.destroy$.closed) {
        this.snackBar.open(
          this.languageService.translate('kanban.error.taskIdNotSpecified'),
          'Close',
          { duration: 3000 }
        );
      }
      this.isChangingStatus = false; // ✅ 修正: フラグをリセット
      return;
    }
    if (!newStatus) {
      console.error('ステータスが指定されていません');
      // ✅ 修正: ユーザーにエラーメッセージを表示
      if (!this.destroy$.closed) {
        this.snackBar.open(
          this.languageService.translate('kanban.error.statusNotSpecified'),
          'Close',
          { duration: 3000 }
        );
      }
      this.isChangingStatus = false; // ✅ 修正: フラグをリセット
      return;
    }

    // 有効なステータスかチェック
    const validStatuses: ('未着手' | '作業中' | '完了')[] = [
      '未着手',
      '作業中',
      '完了',
    ];
    if (!validStatuses.includes(newStatus as '未着手' | '作業中' | '完了')) {
      console.error('無効なステータス:', newStatus);
      // ✅ 修正: ユーザーにエラーメッセージを表示
      if (!this.destroy$.closed) {
        this.snackBar.open(
          this.languageService.translate('kanban.error.invalidStatus'),
          'Close',
          { duration: 3000 }
        );
      }
      this.isChangingStatus = false; // ✅ 修正: フラグをリセット
      return;
    }

    // ✅ 修正: allTasksが配列でない場合の処理を追加
    if (!Array.isArray(this.allTasks)) {
      console.error('allTasksが配列ではありません:', this.allTasks);
      // ✅ 修正: ユーザーにエラーメッセージを表示
      if (!this.destroy$.closed) {
        this.snackBar.open(
          this.languageService.translate('kanban.error.tasksNotLoaded'),
          'Close',
          { duration: 3000 }
        );
      }
      this.isChangingStatus = false; // ✅ 修正: フラグをリセット
      return;
    }
    // タスクのプロジェクトIDを取得
    const task = this.allTasks.find((t) => t && t.id === taskId);
    if (!task) {
      console.error('タスクが見つかりません:', taskId);
      // ✅ 修正: ユーザーにエラーメッセージを表示
      if (!this.destroy$.closed) {
        this.snackBar.open(
          this.languageService.translate('kanban.error.taskNotFound'),
          'Close',
          { duration: 3000 }
        );
      }
      this.isChangingStatus = false; // ✅ 修正: フラグをリセット
      return;
    }

    // 古いステータスを保存
    const oldStatus = task.status;
    // ✅ 修正: oldStatusがundefinedやnullの場合の処理を追加
    if (!oldStatus) {
      console.error('タスクのステータスが指定されていません:', taskId);
      // ✅ 修正: ユーザーにエラーメッセージを表示
      if (!this.destroy$.closed) {
        this.snackBar.open(
          this.languageService.translate('kanban.error.taskStatusNotSet'),
          'Close',
          { duration: 3000 }
        );
      }
      this.isChangingStatus = false; // ✅ 修正: フラグをリセット
      return;
    }

    // ✅ 修正: 親タスクのステータス更新が必要な場合の情報を保存（ロールバック用）
    let parentTaskUpdated = false;
    let parentTaskOldStatus: '未着手' | '作業中' | '完了' | undefined =
      undefined;
    let parentTaskForRollback: {
      id: string;
      status: '未着手' | '作業中' | '完了';
      projectId: string;
      projectName: string;
    } | null = null;

    if (task.parentTaskId && newStatus !== '完了') {
      // ✅ 修正: 非同期処理前にコンポーネントが破棄されていないかチェック
      if (this.destroy$.closed) {
        console.log(
          '[changeTaskStatus] コンポーネントが破棄されたため、親タスク処理をスキップします'
        );
        this.isChangingStatus = false; // ✅ 修正: フラグをリセット
        return;
      }
      const parentTask = this.allTasks.find(
        (t) => t && t.id === task.parentTaskId
      );
      if (
        parentTask &&
        parentTask.status &&
        parentTask.status === '完了' &&
        parentTask.detailSettings?.taskOrder?.requireSubtaskCompletion
      ) {
        alert(
          this.languageService.translateWithParams(
            'kanban.alert.parentTaskStatusChange',
            {
              taskName:
                parentTask.taskName ||
                this.languageService.translate('common.nameNotSet'),
            }
          )
        );
        try {
          // ✅ 修正: parentTask.idやparentTask.projectIdがundefinedやnullの場合の処理を追加
          if (!parentTask.id) {
            console.error('親タスクのIDが指定されていません');
            // ✅ 修正: ユーザーにエラーメッセージを表示
            if (!this.destroy$.closed) {
              this.snackBar.open(
                this.languageService.translate(
                  'kanban.error.parentTaskIdNotSet'
                ),
                'Close',
                { duration: 3000 }
              );
            }
            this.isChangingStatus = false; // ✅ 修正: フラグをリセット
            return;
          }
          if (!parentTask.projectId) {
            console.error('親タスクのプロジェクトIDが指定されていません');
            // ✅ 修正: ユーザーにエラーメッセージを表示
            if (!this.destroy$.closed) {
              this.snackBar.open(
                this.languageService.translate(
                  'kanban.error.parentTaskProjectIdNotSet'
                ),
                'Close',
                { duration: 3000 }
              );
            }
            this.isChangingStatus = false; // ✅ 修正: フラグをリセット
            return;
          }
          await this.taskService.updateTaskStatus(
            parentTask.id,
            '作業中',
            parentTask.status,
            parentTask.projectId,
            parentTask.projectName || ''
          );
          // ✅ 修正: 非同期処理後にコンポーネントが破棄されていないかチェック
          if (this.destroy$.closed) {
            console.log(
              '[changeTaskStatus] コンポーネントが破棄されたため、親タスク状態更新をスキップします'
            );
            return;
          }
          // ✅ 修正: 親タスクのステータス更新情報を保存（ロールバック用）
          parentTaskOldStatus = parentTask.status as
            | '未着手'
            | '作業中'
            | '完了';
          parentTask.status = '作業中';
          parentTaskUpdated = true;
          if (parentTask.id && parentTask.projectId) {
            parentTaskForRollback = {
              id: parentTask.id,
              status: '作業中',
              projectId: parentTask.projectId,
              projectName: parentTask.projectName || '',
            };
          }
        } catch (error) {
          console.error('親タスクのステータス更新に失敗しました', error);
          // ✅ 修正: エラー時もコンポーネントが破棄されていないかチェック
          if (this.destroy$.closed) {
            console.log(
              '[changeTaskStatus] コンポーネントが破棄されたため、エラー処理をスキップします'
            );
            this.isChangingStatus = false; // ✅ 修正: フラグをリセット
            return;
          }
          // ✅ 修正: ユーザーにエラーメッセージを表示
          this.snackBar.open(
            this.languageService.translate(
              'kanban.error.parentTaskStatusUpdateFailed'
            ),
            'Close',
            { duration: 5000 }
          );
          // ✅ 修正: 親タスクのステータス更新が失敗した場合、子タスクのステータス変更も中断する
          this.isChangingStatus = false; // ✅ 修正: フラグをリセット
          return;
        }
        // ✅ 修正: フィルター適用前にコンポーネントが破棄されていないかチェック
        if (!this.destroy$.closed) {
          this.filterTasksBySelectedProjects();
        }
      }
    }

    // ✅ 修正: 古いデータではなく、最新の子タスクデータを取得してチェック（他のユーザーが子タスクを変更した場合も正しく判定するため）
    if (
      newStatus === '完了' &&
      task.detailSettings?.taskOrder?.requireSubtaskCompletion
    ) {
      // ✅ 修正: 非同期処理前にコンポーネントが破棄されていないかチェック
      if (this.destroy$.closed) {
        console.log(
          '[changeTaskStatus] コンポーネントが破棄されたため、子タスクチェックをスキップします'
        );
        this.isChangingStatus = false; // ✅ 修正: フラグをリセット
        return;
      }
      try {
        // ✅ 修正: task.projectIdがundefinedやnullの場合の処理を追加
        if (!task.projectId) {
          console.error('タスクのプロジェクトIDが指定されていません:', taskId);
          // ✅ 修正: ユーザーにエラーメッセージを表示
          if (!this.destroy$.closed) {
            this.snackBar.open(
              this.languageService.translate(
                'kanban.error.taskProjectIdNotSet'
              ),
              'Close',
              { duration: 3000 }
            );
          }
          this.isChangingStatus = false; // ✅ 修正: フラグをリセット
          return;
        }
        // 最新の子タスクデータを取得
        const allTasks = await firstValueFrom(
          this.projectService.getTasksByProjectId(task.projectId).pipe(take(1))
        );
        // ✅ 修正: 非同期処理後にコンポーネントが破棄されていないかチェック
        if (this.destroy$.closed) {
          console.log(
            '[changeTaskStatus] コンポーネントが破棄されたため、子タスクチェック後の処理をスキップします'
          );
          this.isChangingStatus = false; // ✅ 修正: フラグをリセット
          return;
        }
        // ✅ 修正: allTasksが配列でない場合の処理を追加
        if (!Array.isArray(allTasks)) {
          console.error(
            `プロジェクト ${task.projectId} のタスクが配列ではありません:`,
            allTasks
          );
          this.isChangingStatus = false; // ✅ 修正: フラグをリセット
          return;
        }
        // ✅ 修正: task.idがundefinedやnullの場合の処理を追加
        if (!task.id) {
          console.error('タスクのIDが指定されていません:', taskId);
          // ✅ 修正: ユーザーにエラーメッセージを表示
          if (!this.destroy$.closed) {
            this.snackBar.open(
              this.languageService.translate('kanban.error.taskIdNotSet'),
              'Close',
              { duration: 3000 }
            );
          }
          this.isChangingStatus = false; // ✅ 修正: フラグをリセット
          return;
        }
        const latestChildTasks = allTasks.filter(
          (child) => child && child.parentTaskId === task.id
        );
        const incompleteChild = latestChildTasks.find(
          (child) => child && child.status !== '完了'
        );

        if (incompleteChild) {
          const childName =
            incompleteChild.taskName ||
            this.languageService.translate('common.nameNotSet');
          alert(
            this.languageService.translateWithParams(
              'kanban.alert.incompleteSubtask',
              {
                taskName: childName,
              }
            )
          );
          this.isChangingStatus = false; // ✅ 修正: フラグをリセット（子タスクが完了していない場合）
          return;
        }
      } catch (error) {
        console.error('子タスクチェックエラー:', error);
        // ✅ 修正: エラー時もコンポーネントが破棄されていないかチェック
        if (this.destroy$.closed) {
          console.log(
            '[changeTaskStatus] コンポーネントが破棄されたため、エラー処理をスキップします'
          );
          return;
        }
        // ✅ 修正: 親タスクのステータスをロールバック（子タスクチェックエラー時）
        if (parentTaskUpdated && parentTaskOldStatus && parentTaskForRollback) {
          const parentTaskIndex = this.allTasks.findIndex(
            (t) => t && t.id === parentTaskForRollback!.id
          );
          if (parentTaskIndex > -1 && this.allTasks[parentTaskIndex]) {
            this.allTasks[parentTaskIndex].status = parentTaskOldStatus;
            this.filterTasksBySelectedProjects();
          }
          // ✅ 修正: Firestoreからも親タスクのステータスをロールバック
          try {
            await this.taskService.updateTaskStatus(
              parentTaskForRollback.id,
              parentTaskOldStatus,
              '作業中',
              parentTaskForRollback.projectId,
              parentTaskForRollback.projectName
            );
          } catch (rollbackError) {
            console.error(
              '親タスクのステータスロールバックに失敗しました:',
              rollbackError
            );
            // ロールバックに失敗した場合は、該当プロジェクトのタスクを再読み込み
            if (parentTaskForRollback.projectId) {
              this.refreshProjectTasks(parentTaskForRollback.projectId);
            }
          }
        }
        // ✅ 修正: ユーザーにエラーメッセージを表示
        this.snackBar.open(
          this.languageService.translate('kanban.error.subtaskCheckFailed'),
          'Close',
          { duration: 5000 }
        );
        // エラー時は処理を中断
        this.isChangingStatus = false; // ✅ 修正: フラグをリセット
        return;
      }
    }

    try {
      // ✅ 修正: task.projectIdやtask.projectNameがundefinedやnullの場合の処理を追加
      if (!task.projectId) {
        console.error('タスクのプロジェクトIDが指定されていません:', taskId);
        // ✅ 修正: ユーザーにエラーメッセージを表示
        if (!this.destroy$.closed) {
          this.snackBar.open(
            this.languageService.translate('kanban.error.taskProjectIdNotSet'),
            'Close',
            { duration: 3000 }
          );
        }
        this.isChangingStatus = false; // ✅ 修正: フラグをリセット
        return;
      }
      // ✅ 修正: すべてのバリデーションチェックが完了したので、ステータス変更処理開始
      this.isChangingStatus = true;

      // ✅ 修正: 楽観的UI更新（即座にUIを更新してから非同期処理を実行）
      const taskIndex = this.allTasks.findIndex((t) => t && t.id === taskId);
      if (taskIndex > -1 && this.allTasks[taskIndex]) {
        // ローカルのタスクを即座に更新（ユーザー操作への即座のフィードバック）
        this.allTasks[taskIndex].status = newStatus as
          | '未着手'
          | '作業中'
          | '完了';
        this.filterTasksBySelectedProjects();
      }

      // TaskServiceを使用してステータスを更新（編集ログも記録される）
      await this.taskService.updateTaskStatus(
        taskId,
        newStatus,
        oldStatus,
        task.projectId,
        task.projectName || ''
      );

      // ✅ 修正: 非同期処理後にコンポーネントが破棄されていないかチェック
      if (this.destroy$.closed) {
        console.log(
          '[changeTaskStatus] コンポーネントが破棄されたため、状態更新をスキップします'
        );
        return;
      }

      console.log('✅ カンバンでタスクのステータスを更新しました');

      // エラーが発生した場合は、ローカルのタスクを再読み込みして整合性を保つ
      // （楽観的更新が失敗した場合のフォールバック）
      if (taskIndex === -1 || !this.allTasks[taskIndex]) {
        console.warn(
          'ローカルのタスクが見つかりませんでした。タスク一覧を再読み込みします:',
          taskId
        );
        // タスクが見つからない場合は、該当プロジェクトのタスクを再読み込み
        if (task.projectId) {
          this.refreshProjectTasks(task.projectId);
        }
      }
    } catch (error) {
      console.error('❌ ステータス更新エラー:', error);
      // ✅ 修正: エラー時もコンポーネントが破棄されていないかチェック
      if (this.destroy$.closed) {
        console.log(
          '[changeTaskStatus] コンポーネントが破棄されたため、エラー処理をスキップします'
        );
        return;
      }
      // ✅ 修正: 楽観的更新をロールバック（エラーが発生した場合）
      const taskIndex = this.allTasks.findIndex((t) => t && t.id === taskId);
      if (taskIndex > -1 && this.allTasks[taskIndex]) {
        // 元のステータスに戻す
        this.allTasks[taskIndex].status = oldStatus as
          | '未着手'
          | '作業中'
          | '完了';
        this.filterTasksBySelectedProjects();
      }
      // ✅ 修正: 親タスクのステータスもロールバック（子タスクのステータス更新が失敗した場合）
      if (parentTaskUpdated && parentTaskOldStatus && parentTaskForRollback) {
        const parentTaskIndex = this.allTasks.findIndex(
          (t) => t && t.id === parentTaskForRollback.id
        );
        if (parentTaskIndex > -1 && this.allTasks[parentTaskIndex]) {
          this.allTasks[parentTaskIndex].status = parentTaskOldStatus;
          this.filterTasksBySelectedProjects();
        }
        // ✅ 修正: Firestoreからも親タスクのステータスをロールバック
        try {
          await this.taskService.updateTaskStatus(
            parentTaskForRollback.id,
            parentTaskOldStatus,
            '作業中',
            parentTaskForRollback.projectId,
            parentTaskForRollback.projectName
          );
        } catch (rollbackError) {
          console.error(
            '親タスクのステータスロールバックに失敗しました:',
            rollbackError
          );
          // ロールバックに失敗した場合は、該当プロジェクトのタスクを再読み込み
          if (parentTaskForRollback.projectId) {
            this.refreshProjectTasks(parentTaskForRollback.projectId);
          }
        }
      }
      // ✅ 修正: ユーザーにエラーメッセージを表示
      this.snackBar.open(
        this.languageService.translate('kanban.error.statusUpdateFailed'),
        'Close',
        { duration: 5000 }
      );
    } finally {
      // ✅ 修正: ステータス変更処理終了
      this.isChangingStatus = false;
    }
  }

  /** ＋プロジェクト：ダイアログを開く */
  openProjectDialog() {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      console.log(
        '[openProjectDialog] コンポーネントが破棄されたため、ナビゲーションをスキップします'
      );
      return;
    }
    this.router.navigate(['/project-form'], {
      state: { returnUrl: this.router.url },
    });
  }

  /** タスク詳細画面を開く */
  openTaskDetail(task: Task) {
    // ✅ 修正: コンポーネントが破棄されていないかチェック
    if (this.destroy$.closed) {
      console.log(
        '[openTaskDetail] コンポーネントが破棄されたため、ナビゲーションをスキップします'
      );
      return;
    }
    // ✅ 修正: taskがundefinedやnullの場合の処理を追加
    if (!task) {
      console.error('タスクが指定されていません');
      return;
    }
    if (task.projectId && task.id) {
      this.router.navigate(['/project', task.projectId, 'task', task.id]);
    } else {
      console.error('タスクのプロジェクトIDまたはタスクIDが指定されていません');
    }
  }

  /** ステータスを表示（言語設定に応じて） */
  getStatusDisplay(status: string): string {
    // ✅ 修正: statusがundefinedやnullの場合の処理を追加
    if (!status) {
      return '';
    }
    const currentLanguage = this.languageService.getCurrentLanguage();
    const statusMap: Record<string, Record<'ja' | 'en', string>> = {
      未着手: { ja: '未着手', en: 'Not Started' },
      作業中: { ja: '作業中', en: 'In Progress' },
      完了: { ja: '完了', en: 'Completed' },
    };
    return statusMap[status]?.[currentLanguage] || status;
  }

  /** ステータスの短縮形を表示（言語設定に応じて） */
  getStatusShortDisplay(status: string): string {
    // ✅ 修正: statusがundefinedやnullの場合の処理を追加
    if (!status) {
      return '';
    }
    const currentLanguage = this.languageService.getCurrentLanguage();
    const statusShortMap: Record<string, Record<'ja' | 'en', string>> = {
      未着手: { ja: '未', en: 'NS' },
      作業中: { ja: '作', en: 'IP' },
      完了: { ja: '完', en: 'C' },
    };
    return statusShortMap[status]?.[currentLanguage] || status.charAt(0);
  }

  /** 優先度を表示（言語設定に応じて） */
  getPriorityDisplay(priority: string): string {
    // ✅ 修正: priorityがundefinedやnullの場合の処理を追加
    if (!priority) {
      return '';
    }
    const currentLanguage = this.languageService.getCurrentLanguage();
    const priorityMap: Record<string, Record<'ja' | 'en', string>> = {
      高: { ja: '高', en: 'High' },
      中: { ja: '中', en: 'Medium' },
      低: { ja: '低', en: 'Low' },
    };
    return priorityMap[priority]?.[currentLanguage] || priority;
  }

  /** タスクの担当者を表示（カンマ区切り対応） */
  getTaskAssigneeDisplay(task: Task): string {
    // ✅ 修正: taskがundefinedやnullの場合の処理を追加
    if (!task) {
      return '—';
    }
    // ✅ 修正: membersがundefinedやnullの場合の処理を追加
    if (!this.members || this.members.length === 0) {
      // membersが読み込まれていない場合は、assigneeをそのまま表示
      return task.assignee || '—';
    }

    // assignedMembers がある場合はそれを使用
    if (task.assignedMembers && task.assignedMembers.length > 0) {
      // デバッグ: assignedMembersとmembersの内容を確認
      console.log('🔍 [Kanban getTaskAssigneeDisplay] タスク:', task.taskName);
      console.log('   - assignedMembers:', task.assignedMembers);
      console.log('   - this.members:', this.members);
      console.log('   - this.members.length:', this.members.length);

      // 各assignedMembersのUIDがmembersに存在するか確認
      task.assignedMembers.forEach((memberId, index) => {
        // ✅ 修正: memberIdがnullやundefinedの場合をスキップ
        if (!memberId) {
          return;
        }
        const member = this.members.find((m) => m && m.id === memberId);
        console.log(
          `   - assignedMembers[${index}]: ${memberId} → ${
            member ? member.name : '(見つからない)'
          }`
        );
      });

      try {
        const display = getMemberNamesAsString(
          task.assignedMembers,
          this.members,
          ', ',
          this.languageService
        );
        console.log('   - 表示結果:', display);
        const notSetText = this.languageService.translate('common.notSet');
        return display === notSetText ? '—' : display;
      } catch (error) {
        // ✅ 修正: getMemberNamesAsStringがエラーを返す場合の処理を追加
        console.error('担当者名の取得に失敗しました:', error);
        return task.assignee || '—';
      }
    }

    // assignedMembers がない場合は assignee から最新のメンバー名を取得
    if (!task.assignee) {
      return '—';
    }

    // assignee がカンマ区切りの場合を考慮
    const assigneeNames = task.assignee.split(',').map((name) => name.trim());
    const updatedNames = assigneeNames
      .filter((name) => name && name.length > 0) // ✅ 修正: nameがnullやundefined、空文字列の場合をフィルタリング
      .map((name) => {
        const member = this.members.find((m) => m && m.name === name);
        return member ? member.name : null;
      })
      .filter((name): name is string => name !== null);

    return updatedNames.length > 0 ? updatedNames.join(', ') : '—';
  }
}
