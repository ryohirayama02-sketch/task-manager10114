import { Component, OnInit } from '@angular/core';
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
import { Observable, forkJoin, of, firstValueFrom } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { getMemberNamesAsString, getMemberNames } from '../../utils/member-utils';

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
export class KanbanComponent implements OnInit {
  tasks: Task[] = [];
  projects: IProject[] = [];
  selectedProjectIds: string[] = [];
  allTasks: Task[] = []; // 全プロジェクトのタスクを保持
  statuses = ['未着手', '作業中', '完了'];
  private tasksByProject: Map<string, Task[]> = new Map<string, Task[]>();

  // フィルター用
  filterPriority: string[] = [];
  filterAssignee: string[] = [];
  members: Member[] = []; // メンバー一覧

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
    this.memberManagementService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
        console.log('メンバー一覧を読み込みました:', members.length, '件');
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
      },
    });

    this.authService.currentUserEmail$
      .pipe(
        switchMap((userEmail) => {
          console.log('🔑 現在のユーザー情報:', { userEmail });
          if (!userEmail) {
            this.resetProjectState(true);
            return of([]);
          }
          return this.projectService.getProjects();
        })
      )
      .subscribe((projects) => {
        console.log('🎯 カンバン用ルーム内全プロジェクト一覧:', projects);
        if (projects.length === 0) {
          this.resetProjectState();
          this.projectSelectionService.clearSelection();
          return;
        }

        this.applyProjectList(projects);
      });

    // プロジェクト選択状態の変更を監視
    this.projectSelectionService
      .getSelectedProjectIds()
      .subscribe((projectIds: string[]) => {
        this.selectedProjectIds = projectIds;
        this.filterTasksBySelectedProjects();
      });
  }

  private applyProjectList(projects: IProject[]): void {
    this.projects = projects;

    const storedSelection =
      this.projectSelectionService.getSelectedProjectIdsSync();
    const availableIds = new Set(
      projects.map((project) => project.id).filter((id): id is string => !!id)
    );

    let nextSelection = storedSelection.filter((id) => availableIds.has(id));

    if (nextSelection.length === 0) {
      // 保存された選択がない場合は、すべてのプロジェクトを選択
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
    this.projects.forEach((project) => {
      if (project.id) {
        this.projectService
          .getTasksByProjectId(project.id)
          .subscribe((tasks) => {
            this.tasksByProject.set(project.id!, tasks);
            this.rebuildAllTasks();
          });
      }
    });
  }

  private rebuildAllTasks(): void {
    const aggregated: Task[] = [];
    this.projects.forEach((project) => {
      if (!project.id) {
        return;
      }
      const tasks = this.tasksByProject.get(project.id) || [];
      const tasksWithProject = tasks.map((task) => ({
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
    this.applyFilters();
  }

  /** フィルターを適用 */
  applyFilters() {
    let filteredTasks = [...this.allTasks];

    // プロジェクトフィルター
    if (this.selectedProjectIds.length > 0) {
      filteredTasks = filteredTasks.filter((task) =>
        this.selectedProjectIds.includes(task.projectId)
      );
    } else {
      // プロジェクトが選択されていない場合は空配列
      filteredTasks = [];
    }

    // 優先度フィルター
    if (this.filterPriority.length > 0) {
      filteredTasks = filteredTasks.filter((task) =>
        this.filterPriority.includes(task.priority)
      );
    }

    // 担当者フィルター（カンマ区切り対応 + assignedMembers対応）
    if (this.filterAssignee.length > 0) {
      filteredTasks = filteredTasks.filter((task) => {
        const assignees: string[] = [];

        // assignee をカンマで分割（メンバー名のカンマ区切り文字列）
        if (task.assignee) {
          const assigneeNames = task.assignee
            .split(',')
            .map((name) => name.trim())
            .filter((name) => name.length > 0);
          assignees.push(...assigneeNames);
        }

        // assignedMembers も含める（メンバーIDをメンバー名に変換）
        if (Array.isArray(task.assignedMembers) && task.assignedMembers.length > 0) {
          const memberNames = getMemberNames(task.assignedMembers, this.members);
          assignees.push(...memberNames);
        }

        // 担当者がいない場合はフィルターにマッチしない
        if (assignees.length === 0) {
          return false;
        }

        // フィルター値とマッチするか確認（いずれかの担当者がフィルターに含まれていればOK）
        return assignees.some((assignee) =>
          this.filterAssignee.includes(assignee)
        );
      });
    }

    // フィルター後の結果を表示
    this.tasks = filteredTasks;
    console.log('フィルタリング後のタスク:', this.tasks);
  }

  /** フィルターをリセット */
  resetFilters() {
    this.filterPriority = [];
    this.filterAssignee = [];
    this.applyFilters();
  }

  /** ユニークな担当者一覧を取得（メンバー管理画面のメンバー一覧から取得） */
  getUniqueAssignees(): string[] {
    // メンバー管理画面のメンバー一覧から名前を取得
    const memberNames = this.members
      .map((member) => member.name)
      .filter((name) => name && name.trim().length > 0);

    // カンマ区切りのメンバー名を分割
    const assigneeSet = new Set<string>();
    memberNames.forEach((name) => {
      const names = name
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n.length > 0);
      names.forEach((n) => assigneeSet.add(n));
    });

    return Array.from(assigneeSet).sort();
  }

  /** プロジェクトが選択されているかチェック */
  isProjectSelected(projectId: string): boolean {
    return this.selectedProjectIds.includes(projectId);
  }

  /** プロジェクトをすべて選択 */
  selectAllProjects() {
    const allIds = this.projects
      .map((project) => project.id)
      .filter((id): id is string => !!id);
    this.selectedProjectIds = allIds;
    this.projectSelectionService.setSelectedProjectIds(allIds);
  }

  /** プロジェクト選択を全て解除 */
  clearProjectSelection() {
    this.selectedProjectIds = [];
    this.projectSelectionService.clearSelection();
  }

  private async refreshProjectTasks(projectId: string): Promise<void> {
    try {
      const userEmail = await firstValueFrom(
        this.authService.currentUserEmail$
      );

      if (!userEmail) {
        return;
      }

      const tasks = await firstValueFrom(
        this.projectService.getTasksByProjectId(projectId)
      );

      this.tasksByProject.set(projectId, tasks);

      this.rebuildAllTasks();
      this.filterTasksBySelectedProjects();
    } catch (error) {
      console.error('プロジェクトタスク再取得エラー:', error);
    }
  }

  /** プロジェクト選択をトグル */
  toggleProjectSelection(projectId: string) {
    this.projectSelectionService.toggleProjectSelection(projectId);
  }

  /** プロジェクトIDからプロジェクト名を取得 */
  getProjectName(projectId: string): string {
    const project = this.projects.find((p) => p.id === projectId);
    return project ? project.projectName : '';
  }

  /** ステータスでタスクをフィルター */
  filterByStatus(status: string) {
    return this.tasks.filter((t) => t.status === status);
  }

  /** タスクのステータスを変更 */
  async changeTaskStatus(taskId: string, newStatus: string) {
    // 有効なステータスかチェック
    const validStatuses: ('未着手' | '作業中' | '完了')[] = [
      '未着手',
      '作業中',
      '完了',
    ];
    if (!validStatuses.includes(newStatus as '未着手' | '作業中' | '完了')) {
      console.error('無効なステータス:', newStatus);
      return;
    }

    // タスクのプロジェクトIDを取得
    const task = this.allTasks.find((t) => t.id === taskId);
    if (!task) return;

    // 古いステータスを保存
    const oldStatus = task.status;

    if (task.parentTaskId && newStatus !== '完了') {
      const parentTask = this.allTasks.find((t) => t.id === task.parentTaskId);
      if (
        parentTask &&
        parentTask.status === '完了' &&
        parentTask.detailSettings?.taskOrder?.requireSubtaskCompletion
      ) {
        alert(
          this.languageService.translateWithParams(
            'kanban.alert.parentTaskStatusChange',
            {
              taskName: parentTask.taskName || this.languageService.translate('common.nameNotSet'),
            }
          )
        );
        try {
          await this.taskService.updateTaskStatus(
            parentTask.id!,
            '作業中',
            parentTask.status,
            parentTask.projectId,
            parentTask.projectName
          );
          parentTask.status = '作業中';
        } catch (error) {
          console.error('親タスクのステータス更新に失敗しました', error);
        }
        this.filterTasksBySelectedProjects();
      }
    }

    if (
      newStatus === '完了' &&
      task.detailSettings?.taskOrder?.requireSubtaskCompletion
    ) {
      const childTasks = this.allTasks.filter(
        (child) => child.parentTaskId === task.id
      );
      const incompleteChild = childTasks.find(
        (child) => child.status !== '完了'
      );

      if (incompleteChild) {
        const childName = incompleteChild.taskName || this.languageService.translate('common.nameNotSet');
        alert(
          this.languageService.translateWithParams(
            'kanban.alert.incompleteSubtask',
            {
              taskName: childName,
            }
          )
        );
        return;
      }
    }

    try {
      // TaskServiceを使用してステータスを更新（編集ログも記録される）
      await this.taskService.updateTaskStatus(
        taskId,
        newStatus,
        oldStatus,
        task.projectId,
        task.projectName
      );

      console.log('✅ カンバンでタスクのステータスを更新しました');

      // ローカルのタスクも更新
      const taskIndex = this.allTasks.findIndex((t) => t.id === taskId);
      if (taskIndex > -1) {
        this.allTasks[taskIndex].status = newStatus as
          | '未着手'
          | '作業中'
          | '完了';
        this.filterTasksBySelectedProjects();
      }
    } catch (error) {
      console.error('❌ ステータス更新エラー:', error);
    }
  }

  /** ＋プロジェクト：ダイアログを開く */
  openProjectDialog() {
    this.router.navigate(['/project-form'], {
      state: { returnUrl: this.router.url },
    });
  }


  /** タスク詳細画面を開く */
  openTaskDetail(task: Task) {
    if (task.projectId && task.id) {
      this.router.navigate(['/project', task.projectId, 'task', task.id]);
    }
  }

  /** ステータスを表示（言語設定に応じて） */
  getStatusDisplay(status: string): string {
    const currentLanguage = this.languageService.getCurrentLanguage();
    const statusMap: Record<string, Record<'ja' | 'en', string>> = {
      '未着手': { ja: '未着手', en: 'Not Started' },
      '作業中': { ja: '作業中', en: 'In Progress' },
      '完了': { ja: '完了', en: 'Completed' },
    };
    return statusMap[status]?.[currentLanguage] || status;
  }

  /** ステータスの短縮形を表示（言語設定に応じて） */
  getStatusShortDisplay(status: string): string {
    const currentLanguage = this.languageService.getCurrentLanguage();
    const statusShortMap: Record<string, Record<'ja' | 'en', string>> = {
      '未着手': { ja: '未', en: 'NS' },
      '作業中': { ja: '作', en: 'IP' },
      '完了': { ja: '完', en: 'C' },
    };
    return statusShortMap[status]?.[currentLanguage] || status.charAt(0);
  }

  /** 優先度を表示（言語設定に応じて） */
  getPriorityDisplay(priority: string): string {
    const currentLanguage = this.languageService.getCurrentLanguage();
    const priorityMap: Record<string, Record<'ja' | 'en', string>> = {
      '高': { ja: '高', en: 'High' },
      '中': { ja: '中', en: 'Medium' },
      '低': { ja: '低', en: 'Low' },
    };
    return priorityMap[priority]?.[currentLanguage] || priority;
  }

  /** タスクの担当者を表示（カンマ区切り対応） */
  getTaskAssigneeDisplay(task: Task): string {
    // assignedMembers がある場合はそれを使用
    if (task.assignedMembers && task.assignedMembers.length > 0) {
      // デバッグ: assignedMembersとmembersの内容を確認
      console.log('🔍 [Kanban getTaskAssigneeDisplay] タスク:', task.taskName);
      console.log('   - assignedMembers:', task.assignedMembers);
      console.log('   - this.members:', this.members);
      console.log('   - this.members.length:', this.members.length);

      // 各assignedMembersのUIDがmembersに存在するか確認
      task.assignedMembers.forEach((memberId, index) => {
        const member = this.members.find((m) => m.id === memberId);
        console.log(
          `   - assignedMembers[${index}]: ${memberId} → ${
            member ? member.name : '(見つからない)'
          }`
        );
      });

      const display = getMemberNamesAsString(
        task.assignedMembers,
        this.members,
        ', ',
        this.languageService
      );
      console.log('   - 表示結果:', display);
      const notSetText = this.languageService.translate('common.notSet');
      return display === notSetText ? '—' : display;
    }

    // assignedMembers がない場合は assignee から最新のメンバー名を取得
    if (!task.assignee) {
      return '—';
    }
    
    // assignee がカンマ区切りの場合を考慮
    const assigneeNames = task.assignee.split(',').map(name => name.trim());
    const updatedNames = assigneeNames
      .map(name => {
        const member = this.members.find((m) => m.name === name);
        return member ? member.name : null;
      })
      .filter((name): name is string => name !== null);
    
    return updatedNames.length > 0 ? updatedNames.join(', ') : '—';
  }
}
