import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import {
  ProgressService,
  ProjectProgress,
} from '../../services/progress.service';
import { TaskService } from '../../services/task.service';
import { IProject, ProjectAttachment } from '../../models/project.model';
import { Milestone, Task } from '../../models/task.model';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MemberManagementService } from '../../services/member-management.service';
import { Member } from '../../models/member.model';
import { ProjectAttachmentService } from '../../services/project-attachment.service';
import { NavigationHistoryService } from '../../services/navigation-history.service';
import { ProjectDeleteConfirmDialogComponent } from './project-delete-confirm-dialog.component';
import { ProgressCircleComponent } from '../progress/projects-overview/progress-circle.component';
import { ProjectChatComponent } from '../project-chat/project-chat.component';
import {
  DEFAULT_PROJECT_THEME_COLOR,
  PROJECT_THEME_COLORS,
  resolveProjectThemeColor,
} from '../../constants/project-theme-colors';
import { inject } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { getMemberNamesAsString, getMemberNames } from '../../utils/member-utils';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule,
    ProgressCircleComponent,
    ProjectChatComponent,
    TranslatePipe,
  ],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css'],
})
export class ProjectDetailComponent implements OnInit {
  project: IProject | null = null;
  projectId: string | null = null;
  projectProgress: ProjectProgress | null = null;
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  projectThemeColor = DEFAULT_PROJECT_THEME_COLOR;
  taskNameById: Record<string, string> = {};
  isInlineEditMode = false;
  editableProject: {
    projectName: string;
    overview: string;
    startDate: string;
    endDate: string;
    responsible: string;
    members: string;
    tags: string;
  } | null = null;
  isSavingInlineEdit = false;
  isDeletingProject = false;
  editableTags: string[] = [];
  tagInputValue = '';
  editableThemeColor: string | null = DEFAULT_PROJECT_THEME_COLOR;
  readonly themeColors = PROJECT_THEME_COLORS;
  
  // プロジェクトテーマカラーの16進表記から色名へのマッピング
  private readonly themeColorLabelMap: Record<string, string> = {
    '#fde4ec': 'ピンク',
    '#ffe6dc': 'ピーチ',
    '#ffedd6': 'アプリコット',
    '#fff8e4': 'イエロー',
    '#eef6da': 'ライム',
    '#e4f4e8': 'ミント',
    '#dcf3f0': 'ブルーグリーン',
    '#def3ff': 'スカイブルー',
    '#e6e9f9': 'ラベンダーブルー',
    '#ece6f8': 'パープル',
  };
  editableMilestones: Milestone[] = [];
  editableAttachments: ProjectAttachment[] = [];
  pendingFiles: { id: string; file: File }[] = [];
  attachmentsToRemove: ProjectAttachment[] = [];
  newUrlInput: string = '';
  isUploading = false;
  members: Member[] = [];
  membersLoading = false;
  selectedResponsibleIds: string[] = [];
  selectedResponsibles: Member[] = [];
  selectedMemberIds: string[] = [];
  selectedMembers: Member[] = [];
  readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
  readonly fileAccept =
    '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.bmp,.heic,.webp,.svg,.txt,.csv,.zip';

  // フィルター用のプロパティ
  filterStatus: string = '';
  filterPriority: string = '';
  filterAssignee: string = '';
  filterDueDate: string = '';
  filterDueDateObj: Date | null = null; // Material date picker用
  maxDate = new Date(9999, 11, 31); // 9999-12-31
  assigneeOptions: string[] = [];

  // フィルターオプション（表示用の翻訳済み配列）
  get statusOptions(): string[] {
    return ['未着手', '作業中', '完了'];
  }
  get priorityOptions(): string[] {
    return ['高', '中', '低'];
  }
  
  // ステータスの表示テキストを取得（タスクカード用：英語時は短縮形）
  getStatusDisplay(status: string, short: boolean = false): string {
    const currentLanguage = this.languageService.getCurrentLanguage();
    const useShort = short && currentLanguage === 'en';
    
    const statusMap: Record<string, string> = {
      '未着手': useShort 
        ? this.languageService.translate('projectDetail.status.notStarted.short')
        : this.languageService.translate('projectDetail.status.notStarted'),
      '作業中': useShort
        ? this.languageService.translate('projectDetail.status.inProgress.short')
        : this.languageService.translate('projectDetail.status.inProgress'),
      '完了': useShort
        ? this.languageService.translate('projectDetail.status.completed.short')
        : this.languageService.translate('projectDetail.status.completed'),
    };
    return statusMap[status] || status;
  }
  
  // 優先度の表示テキストを取得（タスクカード用：英語時は短縮形）
  getPriorityDisplay(priority: string, short: boolean = false): string {
    const currentLanguage = this.languageService.getCurrentLanguage();
    const useShort = short && currentLanguage === 'en';
    
    const priorityMap: Record<string, string> = {
      '高': useShort
        ? this.languageService.translate('projectDetail.priority.high.short')
        : this.languageService.translate('projectDetail.priority.high'),
      '中': useShort
        ? this.languageService.translate('projectDetail.priority.medium.short')
        : this.languageService.translate('projectDetail.priority.medium'),
      '低': useShort
        ? this.languageService.translate('projectDetail.priority.low.short')
        : this.languageService.translate('projectDetail.priority.low'),
    };
    return priorityMap[priority] || priority;
  }
  
  // 現在の言語設定を取得（date inputのlang属性用）
  getCurrentLang(): string {
    return this.languageService.getCurrentLanguage();
  }
  private readonly returnUrl: string | null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private progressService: ProgressService,
    private snackBar: MatSnackBar,
    private memberService: MemberManagementService,
    private attachmentService: ProjectAttachmentService,
    private location: Location,
    private taskService: TaskService,
    private languageService: LanguageService
  ) {
    const nav = this.router.getCurrentNavigation();
    const navState = nav?.extras?.state as { returnUrl?: string } | undefined;
    const historyState = this.location.getState() as
      | { returnUrl?: string }
      | undefined;
    this.returnUrl = navState?.returnUrl ?? historyState?.returnUrl ?? null;
  }

  private dialog = inject(MatDialog);
  private navigationHistory = inject(NavigationHistoryService);

  ngOnInit() {
    this.loadMembers();
    this.projectId = this.route.snapshot.paramMap.get('projectId');
    console.log('選択されたプロジェクトID:', this.projectId);

    if (this.projectId) {
      this.projectService
        .getProjectById(this.projectId)
        .subscribe(async (data) => {
          if (!data) {
            this.snackBar.open('プロジェクトが見つかりませんでした', '閉じる', {
              duration: 3000,
            });
            this.router.navigate(['/projects']);
            return;
          }
          this.project = data;
          this.projectThemeColor = resolveProjectThemeColor(data);
          console.log('Firestoreから取得したプロジェクト:', data);

          // プロジェクトの進捗率を取得
          const progress = await this.progressService.getProjectProgress(
            this.projectId!
          );
          this.projectProgress = progress;
          console.log('プロジェクト進捗:', progress);
        });

      // プロジェクトのタスク一覧を取得
      this.loadTasks();
    }
  }

  async onInlineEditToggle(event: MatSlideToggleChange): Promise<void> {
    if (!this.project) {
      event.source.checked = false;
      return;
    }

    if (event.checked) {
      this.enterInlineEditMode();
      this.isInlineEditMode = true;
    } else {
      await this.saveInlineEditChanges(event);
    }
  }

  async onInlineEditToggleClick(): Promise<void> {
    if (!this.project) {
      this.isInlineEditMode = false;
      return;
    }

    if (this.isInlineEditMode) {
      // 編集モードから通常モードに戻る（保存）
      if (!this.canSaveProject()) {
        return;
      }
      // 変更がない場合は保存処理をスキップ
      if (!this.hasProjectChanges()) {
        this.isInlineEditMode = false;
        this.editableProject = null;
        this.editableTags = [];
        this.editableMilestones = [];
        this.editableAttachments = [];
        this.pendingFiles = [];
        this.attachmentsToRemove = [];
        this.selectedMemberIds = [];
        this.selectedMembers = [];
        this.selectedResponsibleIds = [];
        this.selectedResponsibles = [];
        return;
      }
      await this.saveInlineEditChangesClick();
    } else {
      // 通常モードから編集モードに切り替え
      this.enterInlineEditMode();
      this.isInlineEditMode = true;
    }
  }

  canSaveProject(): boolean {
    if (!this.editableProject) {
      return false;
    }

    // プロジェクト名の必須チェック
    if (!this.editableProject.projectName?.trim()) {
      return false;
    }

    // 開始日と終了日の必須チェック
    if (!this.editableProject.startDate || !this.editableProject.endDate) {
      return false;
    }

    // 責任者の必須チェック
    if (!this.selectedResponsibles || this.selectedResponsibles.length === 0) {
      return false;
    }

    // プロジェクトメンバーの必須チェック
    if (!this.selectedMembers || this.selectedMembers.length === 0) {
      return false;
    }

    return true;
  }

  /** プロジェクトに変更があるかどうかをチェック */
  private hasProjectChanges(): boolean {
    if (!this.project || !this.editableProject) {
      return false;
    }

    // プロジェクト名の変更チェック
    if (this.project.projectName !== this.editableProject.projectName?.trim()) {
      return true;
    }

    // 概要の変更チェック
    if ((this.project.overview || '') !== (this.editableProject.overview || '')) {
      return true;
    }

    // 開始日の変更チェック
    if ((this.project.startDate || '') !== (this.editableProject.startDate || '')) {
      return true;
    }

    // 終了日の変更チェック
    if ((this.project.endDate || '') !== (this.editableProject.endDate || '')) {
      return true;
    }

    // 責任者の変更チェック
    const oldResponsibleIds = (this.project.responsibles || [])
      .map(r => r.memberId)
      .filter((id): id is string => !!id)
      .sort();
    const newResponsibleIds = (this.selectedResponsibles || [])
      .map(m => m.id)
      .filter((id): id is string => !!id)
      .sort();
    if (JSON.stringify(oldResponsibleIds) !== JSON.stringify(newResponsibleIds)) {
      return true;
    }

    // プロジェクトメンバーの変更チェック
    const oldMemberNames = this.normalizeMembersField(this.project.members)
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0)
      .sort();
    const newMemberNames = (this.selectedMembers || [])
      .map(m => m.name)
      .filter((name): name is string => !!name)
      .sort();
    if (JSON.stringify(oldMemberNames) !== JSON.stringify(newMemberNames)) {
      return true;
    }

    // タグの変更チェック
    const oldTags = this.parseTags(this.project.tags).sort();
    const newTags = (this.editableTags || []).sort();
    if (JSON.stringify(oldTags) !== JSON.stringify(newTags)) {
      return true;
    }

    // マイルストーンの変更チェック
    const oldMilestones = (this.project.milestones || []).map(m => ({
      name: m.name || '',
      date: m.date || '',
      description: m.description || '',
    })).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.name !== b.name) return a.name.localeCompare(b.name);
      return a.description.localeCompare(b.description);
    });
    const newMilestones = (this.editableMilestones || []).map(m => ({
      name: m.name || '',
      date: m.date || '',
      description: m.description || '',
    })).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.name !== b.name) return a.name.localeCompare(b.name);
      return a.description.localeCompare(b.description);
    });
    if (JSON.stringify(oldMilestones) !== JSON.stringify(newMilestones)) {
      return true;
    }

    // テーマ色の変更チェック
    const oldThemeColor = resolveProjectThemeColor(this.project);
    const oldThemeColorNormalized = oldThemeColor === '#ffffff' ? null : oldThemeColor;
    if (oldThemeColorNormalized !== this.editableThemeColor) {
      return true;
    }

    // 添付ファイルの変更チェック（追加・削除されたファイルがあるか）
    const oldAttachmentIds = (this.project.attachments || []).map(a => a.id).sort();
    const newAttachmentIds = this.editableAttachments.map(a => a.id).sort();
    if (JSON.stringify(oldAttachmentIds) !== JSON.stringify(newAttachmentIds)) {
      return true;
    }

    // 保留中のファイルがあるか
    if (this.pendingFiles.length > 0) {
      return true;
    }

    // 削除予定のファイルがあるか
    if (this.attachmentsToRemove.length > 0) {
      return true;
    }

    return false;
  }

  private enterInlineEditMode(): void {
    if (!this.project) {
      return;
    }

    this.editableProject = {
      projectName: this.project.projectName || '',
      overview: this.project.overview || '',
      startDate: this.project.startDate || '',
      endDate: this.project.endDate || '',
      responsible: this.extractResponsibleNames(this.project).join(', '),
      members: this.project.members
        ? this.normalizeMembersField(this.project.members)
        : '',
      tags: Array.isArray(this.project.tags)
        ? (this.project.tags as unknown as string[])
            .filter((tag) => !!tag)
            .join(', ')
        : this.project.tags || '',
    };
    this.editableTags = this.parseTags(this.project.tags);
    this.editableMilestones = (this.project.milestones || []).map(
      (milestone) => ({
        id: milestone.id || this.generateId(),
        name: milestone.name || '',
        date: milestone.date || '',
        description: milestone.description || '',
      })
    );
    this.editableAttachments = (this.project.attachments || []).map(
      (attachment) => ({
        ...attachment,
        id: attachment.id || this.generateId(),
      })
    );
    this.pendingFiles = [];
    this.attachmentsToRemove = [];
    this.newUrlInput = '';
    this.tagInputValue = '';
    // プロジェクトのテーマ色が#ffffffまたはnullの場合はnullに設定（「なし」を選択）
    const resolvedColor = resolveProjectThemeColor(this.project);
    this.editableThemeColor = resolvedColor === '#ffffff' ? null : resolvedColor;
    this.syncSelectionsFromProject();
  }

  private async saveInlineEditChangesClick(): Promise<void> {
    if (!this.project || !this.editableProject) {
      this.isInlineEditMode = false;
      return;
    }

    // 必須項目のバリデーション
    const trimmedName = this.editableProject.projectName.trim();
    if (!trimmedName) {
      this.snackBar.open('プロジェクト名を入力してください', '閉じる', {
        duration: 3000,
      });
      this.isInlineEditMode = true;
      return;
    }

    if (!this.editableProject.startDate || !this.editableProject.endDate) {
      this.snackBar.open('開始日と終了日は必須です', '閉じる', {
        duration: 3000,
      });
      this.isInlineEditMode = true;
      return;
    }

    // 開始日と終了日の逆転チェック
    if (this.editableProject.startDate && this.editableProject.endDate) {
      const startDate = new Date(this.editableProject.startDate);
      const endDate = new Date(this.editableProject.endDate);
      if (startDate > endDate) {
        this.snackBar.open('開始日は終了日より前の日付を設定してください', '閉じる', {
          duration: 3000,
        });
        this.isInlineEditMode = true;
        return;
      }
    }

    if (!this.selectedResponsibles || this.selectedResponsibles.length === 0) {
      this.snackBar.open('責任者は1人以上選択してください', '閉じる', {
        duration: 3000,
      });
      this.isInlineEditMode = true;
      return;
    }

    if (!this.selectedMembers || this.selectedMembers.length === 0) {
      this.snackBar.open('プロジェクトメンバーは1人以上選択してください', '閉じる', {
        duration: 3000,
      });
      this.isInlineEditMode = true;
      return;
    }

    const membersString =
      this.selectedMembers.length > 0
        ? this.selectedMembers
            .map((member) => member.name)
            .filter((name) => !!name)
            .join(', ')
        : this.editableProject.members?.trim() || this.project.members || '';
    const tagsString = this.editableTags.join(', ');

    const responsiblesPayload = this.selectedResponsibles.map((member) => ({
      memberId: member.id || '',
      memberName: member.name,
      memberEmail: member.email || '',
    }));

    const responsibleNames = responsiblesPayload
      .map((entry) => entry.memberName)
      .filter((name) => !!name)
      .join(', ');
    const responsibleIdsArray = responsiblesPayload
      .map((entry) => entry.memberId)
      .filter((id): id is string => !!id);
    const responsibleEmailsArray = responsiblesPayload
      .map((entry) => entry.memberEmail || '')
      .filter((email) => !!email);
    const primaryResponsibleId = responsibleIdsArray[0] ?? '';
    const primaryResponsibleEmail = responsibleEmailsArray[0] ?? '';

    let attachments: ProjectAttachment[] = [...this.editableAttachments];

    if (this.pendingFiles.length > 0) {
      this.isUploading = true;
      try {
        const uploaded = await this.uploadPendingFiles(this.project.id);
        if (uploaded.length > 0) {
          attachments = [...attachments, ...uploaded];
        }
      } finally {
        this.isUploading = false;
      }
    }

    if (this.attachmentsToRemove.length > 0) {
      await this.deleteMarkedAttachments(this.project.id);
      attachments = attachments.filter(
        (attachment) =>
          !this.attachmentsToRemove.some(
            (removed) => removed.id === attachment.id
          )
      );
      this.attachmentsToRemove = [];
    }

    const milestonesPayload = this.editableMilestones
      .filter((milestone) => milestone.name || milestone.date)
      .map((milestone) => ({
        id: milestone.id || this.generateId(),
        name: milestone.name?.trim() || '',
        date: milestone.date || '',
        description: milestone.description || '',
      }));

    const payload = {
      projectName: trimmedName,
      overview: this.editableProject.overview?.trim() || '',
      startDate: this.editableProject.startDate || '',
      endDate: this.editableProject.endDate || '',
      responsible:
        responsibleNames || this.editableProject.responsible?.trim() || '',
      responsibleId: primaryResponsibleId,
      responsibleEmail: primaryResponsibleEmail,
      responsibles: responsiblesPayload,
      members: membersString,
      tags: tagsString,
      // テーマ色が「なし」（null）の場合は白（#ffffff）に設定
      themeColor: this.editableThemeColor === null ? '#ffffff' : this.editableThemeColor,
      milestones: milestonesPayload,
      attachments,
      updatedAt: new Date(),
    };

    if (this.isSavingInlineEdit) {
      this.isInlineEditMode = true;
      return;
    }

    this.isSavingInlineEdit = true;
    try {
      await this.projectService.updateProject(this.project.id, payload);
      this.project = {
        ...this.project,
        ...payload,
      } as IProject;
      this.project.responsibles = responsiblesPayload;
      // テーマ色が「なし」（null）の場合は白（#ffffff）に設定
      this.project.themeColor = this.editableThemeColor === null ? '#ffffff' : this.editableThemeColor;
      this.projectThemeColor = resolveProjectThemeColor(this.project);
      this.project.attachments = attachments;
      this.project.milestones = milestonesPayload;
      this.snackBar.open('プロジェクトを保存しました', '閉じる', {
        duration: 3000,
      });
      this.isInlineEditMode = false;
      this.editableProject = null;
      this.editableTags = [];
      this.editableMilestones = [];
      this.editableAttachments = [];
      this.pendingFiles = [];
      this.attachmentsToRemove = [];
      this.selectedMemberIds = [];
      this.selectedMembers = [];
      this.selectedResponsibleIds = [];
      this.selectedResponsibles = [];
    } catch (error) {
      console.error('プロジェクトの更新エラー:', error);
      this.snackBar.open('プロジェクトの更新に失敗しました', '閉じる', {
        duration: 3000,
      });
      this.isInlineEditMode = true;
    } finally {
      this.isSavingInlineEdit = false;
    }
  }

  private async saveInlineEditChanges(
    event: MatSlideToggleChange
  ): Promise<void> {
    if (!this.project || !this.editableProject) {
      event.source.checked = false;
      this.isInlineEditMode = false;
      return;
    }

    // 変更がない場合は保存処理をスキップ
    if (!this.hasProjectChanges()) {
      this.isInlineEditMode = false;
      this.editableProject = null;
      this.editableTags = [];
      this.editableMilestones = [];
      this.editableAttachments = [];
      this.pendingFiles = [];
      this.attachmentsToRemove = [];
      this.selectedMemberIds = [];
      this.selectedMembers = [];
      this.selectedResponsibleIds = [];
      this.selectedResponsibles = [];
      this.tagInputValue = '';
      this.newUrlInput = '';
      event.source.checked = false;
      return;
    }

    // 必須項目のバリデーション
    const trimmedName = this.editableProject.projectName.trim();
    if (!trimmedName) {
      this.snackBar.open('プロジェクト名を入力してください', '閉じる', {
        duration: 3000,
      });
      event.source.checked = true;
      this.isInlineEditMode = true;
      return;
    }

    if (!this.editableProject.startDate || !this.editableProject.endDate) {
      this.snackBar.open('開始日と終了日は必須です', '閉じる', {
        duration: 3000,
      });
      event.source.checked = true;
      this.isInlineEditMode = true;
      return;
    }

    if (!this.selectedResponsibles || this.selectedResponsibles.length === 0) {
      this.snackBar.open('責任者は1人以上選択してください', '閉じる', {
        duration: 3000,
      });
      event.source.checked = true;
      this.isInlineEditMode = true;
      return;
    }

    if (!this.selectedMembers || this.selectedMembers.length === 0) {
      this.snackBar.open('プロジェクトメンバーは1人以上選択してください', '閉じる', {
        duration: 3000,
      });
      event.source.checked = true;
      this.isInlineEditMode = true;
      return;
    }

    const membersString =
      this.selectedMembers.length > 0
        ? this.selectedMembers
            .map((member) => member.name)
            .filter((name) => !!name)
            .join(', ')
        : this.editableProject.members?.trim() || this.project.members || '';
    const tagsString = this.editableTags.join(', ');

    const responsiblesPayload = this.selectedResponsibles.map((member) => ({
      memberId: member.id || '',
      memberName: member.name,
      memberEmail: member.email || '',
    }));

    const responsibleNames = responsiblesPayload
      .map((entry) => entry.memberName)
      .filter((name) => !!name)
      .join(', ');
    const responsibleIdsArray = responsiblesPayload
      .map((entry) => entry.memberId)
      .filter((id): id is string => !!id);
    const responsibleEmailsArray = responsiblesPayload
      .map((entry) => entry.memberEmail || '')
      .filter((email) => !!email);
    const primaryResponsibleId = responsibleIdsArray[0] ?? '';
    const primaryResponsibleEmail = responsibleEmailsArray[0] ?? '';

    let attachments: ProjectAttachment[] = [...this.editableAttachments];

    if (this.pendingFiles.length > 0) {
      this.isUploading = true;
      try {
        const uploaded = await this.uploadPendingFiles(this.project.id);
        if (uploaded.length > 0) {
          attachments = [...attachments, ...uploaded];
        }
      } finally {
        this.isUploading = false;
      }
    }

    if (this.attachmentsToRemove.length > 0) {
      await this.deleteMarkedAttachments(this.project.id);
      attachments = attachments.filter(
        (attachment) =>
          !this.attachmentsToRemove.some(
            (removed) => removed.id === attachment.id
          )
      );
      this.attachmentsToRemove = [];
    }

    const milestonesPayload = this.editableMilestones
      .filter((milestone) => milestone.name || milestone.date)
      .map((milestone) => ({
        id: milestone.id || this.generateId(),
        name: milestone.name?.trim() || '',
        date: milestone.date || '',
        description: milestone.description || '',
      }));

    const payload = {
      projectName: trimmedName,
      overview: this.editableProject.overview?.trim() || '',
      startDate: this.editableProject.startDate || '',
      endDate: this.editableProject.endDate || '',
      responsible:
        responsibleNames || this.editableProject.responsible?.trim() || '',
      responsibleId: primaryResponsibleId,
      responsibleEmail: primaryResponsibleEmail,
      responsibles: responsiblesPayload,
      members: membersString,
      tags: tagsString,
      // テーマ色が「なし」（null）の場合は白（#ffffff）に設定
      themeColor: this.editableThemeColor === null ? '#ffffff' : this.editableThemeColor,
      milestones: milestonesPayload,
      attachments,
      updatedAt: new Date(),
    };

    if (this.isSavingInlineEdit) {
      event.source.checked = true;
      this.isInlineEditMode = true;
      return;
    }

    this.isSavingInlineEdit = true;
    try {
      await this.projectService.updateProject(this.project.id, payload);
      this.project = {
        ...this.project,
        ...payload,
      } as IProject;
      this.project.responsibles = responsiblesPayload;
      // テーマ色が「なし」（null）の場合は白（#ffffff）に設定
      this.project.themeColor = this.editableThemeColor === null ? '#ffffff' : this.editableThemeColor;
      this.projectThemeColor = resolveProjectThemeColor(this.project);
      this.project.attachments = attachments;
      this.project.milestones = milestonesPayload;
      this.snackBar.open('プロジェクトを保存しました', '閉じる', {
        duration: 3000,
      });
      this.isInlineEditMode = false;
      this.editableProject = null;
      this.editableTags = [];
      this.editableMilestones = [];
      this.editableAttachments = [];
      this.pendingFiles = [];
      this.attachmentsToRemove = [];
      this.selectedMemberIds = [];
      this.selectedMembers = [];
      this.selectedResponsibleIds = [];
      this.selectedResponsibles = [];
      this.tagInputValue = '';
      this.newUrlInput = '';
      event.source.checked = false;
    } catch (error) {
      console.error('インライン編集の保存に失敗しました:', error);
      this.snackBar.open('プロジェクトの更新に失敗しました', '閉じる', {
        duration: 3000,
      });
      this.isInlineEditMode = true;
      event.source.checked = true;
    } finally {
      this.isSavingInlineEdit = false;
    }
  }

  private normalizeMembersField(members: any): string {
    if (!members) {
      return '';
    }
    if (typeof members === 'string') {
      return members;
    }
    if (Array.isArray(members)) {
      return members
        .map((member: any) => member?.memberName || member?.name || '')
        .filter((name: string) => !!name)
        .join(', ');
    }
    return '';
  }

  private extractResponsibleNames(project: IProject | null): string[] {
    if (!project) {
      return [];
    }
    const names: string[] = [];
    if (
      Array.isArray(project.responsibles) &&
      project.responsibles.length > 0
    ) {
      project.responsibles.forEach((entry) => {
        const name = entry.memberName || '';
        if (name) {
          names.push(name);
        }
      });
    }
    if (names.length === 0 && project.responsible) {
      names.push(
        ...project.responsible
          .split(',')
          .map((name) => name.trim())
          .filter((name) => !!name)
      );
    }
    return names;
  }

  getResponsiblesDisplay(project: IProject | null = this.project): string {
    if (!project) {
      return '未設定';
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
            // memberId で見つからない場合は、保存されている名前を使用
            names.push(entry.memberName);
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
      return names.length > 0 ? names.join(', ') : '未設定';
    }
    
    // responsibles がない場合は、responsible フィールドから取得
    const names = this.extractResponsibleNames(project);
    if (names.length > 0) {
      // メンバー名を最新の名前に更新（メンバー管理画面に存在しない名前は除外）
      const updatedNames = names
        .map(name => {
          const member = this.members.find((m) => m.name === name);
          return member ? member.name : null;
        })
        .filter((name): name is string => name !== null);
      return updatedNames.length > 0 ? updatedNames.join(', ') : '未設定';
    }
    
    return '未設定';
  }

  getMembersDisplay(): string {
    if (!this.project) {
      return '';
    }
    const membersString = this.normalizeMembersField(this.project.members);
    if (!membersString) {
      return '';
    }
    
    // メンバー名を最新の名前に更新（メンバー管理画面に存在しない名前は除外）
    const memberNames = membersString.split(',').map(name => name.trim());
    const updatedNames = memberNames
      .map(name => {
        const member = this.members.find((m) => m.name === name);
        return member ? member.name : null;
      })
      .filter((name): name is string => name !== null);
    
    return updatedNames.join(', ');
  }

  private syncSelectionsFromProject(): void {
    if (!this.project) {
      return;
    }
    const memberNames = this.normalizeMembersField(this.project.members)
      .split(',')
      .map((name) => name.trim())
      .filter((name) => !!name);
    this.selectedMembers = this.members.filter((member) =>
      memberNames.includes(member.name || '')
    );
    this.selectedMemberIds = this.selectedMembers
      .map((member) => member.id || '')
      .filter((id) => !!id);

    const responsibleEntries = Array.isArray(this.project.responsibles)
      ? this.project.responsibles
      : [];

    const idsFromEntries = responsibleEntries
      .map((entry) => entry.memberId)
      .filter((id): id is string => !!id);

    this.selectedResponsibles = this.members.filter((member) =>
      idsFromEntries.includes(member.id || '')
    );

    if (this.selectedResponsibles.length < responsibleEntries.length) {
      const namesFromEntries = responsibleEntries
        .map((entry) => entry.memberName)
        .filter((name): name is string => !!name);
      const additional = this.members.filter(
        (member) =>
          namesFromEntries.includes(member.name || '') &&
          !this.selectedResponsibles.some(
            (selected) => selected.id === member.id
          )
      );
      this.selectedResponsibles = [...this.selectedResponsibles, ...additional];
    }

    if (
      this.selectedResponsibles.length === 0 &&
      (this.project.responsibleId || this.project.responsible)
    ) {
      const fallbackIds = this.project.responsibleId
        ? [this.project.responsibleId]
        : [];
      const fallbackNames = this.extractResponsibleNames(this.project);

      this.selectedResponsibles = this.members.filter((member) => {
        const idMatch = fallbackIds.includes(member.id || '');
        const nameMatch = fallbackNames.includes(member.name || '');
        return idMatch || nameMatch;
      });
    }

    this.selectedResponsibleIds = this.selectedResponsibles
      .map((member) => member.id || '')
      .filter((id) => !!id);

    if (this.editableProject) {
      this.editableProject.responsible = this.selectedResponsibles
        .map((member) => member.name)
        .filter((name) => !!name)
        .join(', ');
    }
  }

  onMembersSelectionChange(selectedIds: string[]): void {
    this.selectedMemberIds = Array.isArray(selectedIds) ? selectedIds : [];
    this.selectedMembers = this.members.filter((member) =>
      this.selectedMemberIds.includes(member.id || '')
    );
  }

  onResponsibleSelectionChange(selectedIds: string[]): void {
    this.selectedResponsibleIds = Array.isArray(selectedIds) ? selectedIds : [];
    this.selectedResponsibles = this.members.filter((member) =>
      this.selectedResponsibleIds.includes(member.id || '')
    );
    if (this.editableProject) {
      this.editableProject.responsible = this.selectedResponsibles
        .map((member) => member.name)
        .filter((name) => !!name)
        .join(', ');
    }
  }

  removeSelectedMember(member: Member): void {
    const memberId = member.id || '';
    this.selectedMemberIds = this.selectedMemberIds.filter(
      (id) => id !== memberId
    );
    this.selectedMembers = this.selectedMembers.filter(
      (selected) => (selected.id || '') !== memberId
    );
    if (this.selectedResponsibleIds.includes(memberId)) {
      this.removeResponsible(member);
    }
  }

  removeResponsible(member: Member): void {
    const memberId = member.id || '';
    this.selectedResponsibleIds = this.selectedResponsibleIds.filter(
      (id) => id !== memberId
    );
    this.selectedResponsibles = this.selectedResponsibles.filter(
      (responsible) => (responsible.id || '') !== memberId
    );
    if (this.editableProject) {
      this.editableProject.responsible = this.selectedResponsibles
        .map((item) => item.name)
        .filter((name) => !!name)
        .join(', ');
    }
  }

  onTagInputEnter(event: Event): void {
    event.preventDefault();
    const value = this.tagInputValue.trim();
    if (!value) {
      return;
    }
    if (!this.editableTags.includes(value)) {
      this.editableTags.push(value);
    }
    this.tagInputValue = '';
  }

  removeTag(tag: string): void {
    this.editableTags = this.editableTags.filter(
      (existing) => existing !== tag
    );
  }

  addMilestone(): void {
    this.editableMilestones.push({
      id: this.generateId(),
      name: '',
      date: '',
      description: '',
    });
  }

  removeMilestone(index: number): void {
    this.editableMilestones.splice(index, 1);
  }

  trackMilestone(_index: number, milestone: Milestone): string {
    return milestone.id;
  }

  confirmProjectDeletion(): void {
    if (!this.project?.id) {
      return;
    }

    const tasksCount = this.tasks?.length || 0;
    const dialogRef = this.dialog.open(ProjectDeleteConfirmDialogComponent, {
      width: '400px',
      data: {
        projectName: this.project.projectName || 'プロジェクト',
        projectId: this.project.id,
        tasksCount: tasksCount,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === true) {
        this.deleteProject();
      }
    });
  }

  private async deleteProject(): Promise<void> {
    if (!this.project?.id || this.isDeletingProject) {
      return;
    }

    this.isDeletingProject = true;
    try {
      await this.projectService.deleteProject(this.project.id, this.project);
      this.snackBar.open(
        `プロジェクト「${this.project.projectName || ''}」を削除しました`,
        '閉じる',
        { duration: 3000 }
      );

      const targetUrl = this.returnUrl || '/progress/projects';
      this.router.navigateByUrl(targetUrl, { replaceUrl: true });
    } catch (error) {
      console.error('プロジェクト削除エラー:', error);
      this.snackBar.open('プロジェクトの削除に失敗しました', '閉じる', {
        duration: 3000,
      });
    } finally {
      this.isDeletingProject = false;
    }
  }

  trackAttachment(_index: number, attachment: ProjectAttachment): string {
    return attachment.id;
  }

  onFilesSelected(event: Event): void {
    if (!this.isInlineEditMode) {
      return;
    }
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }

    Array.from(files).forEach((file) => {
      if (file.size > this.MAX_FILE_SIZE) {
        this.snackBar.open(
          `${file.name} は5MBを超えています。別のファイルを選択してください。`,
          '閉じる',
          { duration: 4000 }
        );
        return;
      }
      this.pendingFiles.push({ id: this.generateId(), file });
    });

    input.value = '';
  }

  /** URLを追加 */
  addUrl(url: string): void {
    if (url && url.trim()) {
      const trimmedUrl = url.trim();

      if (!this.isValidUrl(trimmedUrl)) {
        this.snackBar.open('URLの形式が正しくありません', '閉じる', {
          duration: 3000,
        });
      return;
    }

      // 既に同じURLが存在するかチェック
      const exists = this.editableAttachments.some(
        (att) => att.type === 'link' && att.url === trimmedUrl
      );
      
      if (exists) {
        this.snackBar.open('このURLは既に追加されています', '閉じる', {
        duration: 3000,
      });
      return;
    }

    const attachment: ProjectAttachment = {
      id: this.generateId(),
        name: this.extractUrlLabel(trimmedUrl),
        url: trimmedUrl,
      type: 'link',
      uploadedAt: new Date().toISOString(),
    };

    this.editableAttachments.push(attachment);
      this.newUrlInput = '';
    }
  }

  /** URLラベルを抽出 */
  extractUrlLabel(url: string): string {
    try {
      const urlObj = new URL(url);
      // ホスト名またはパス名から短いラベルを作成
      const hostname = urlObj.hostname.replace('www.', '');
      return hostname || url.substring(0, 30);
    } catch {
      return url.substring(0, 30);
    }
  }

  removeAttachment(attachment: ProjectAttachment): void {
    this.editableAttachments = this.editableAttachments.filter(
      (item) => item.id !== attachment.id
    );

    if (attachment.type === 'file' && attachment.storagePath) {
      this.attachmentsToRemove.push(attachment);
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${bytes} B`;
  }

  private async uploadPendingFiles(
    projectId: string
  ): Promise<ProjectAttachment[]> {
    const uploaded: ProjectAttachment[] = [];

    for (const pending of this.pendingFiles) {
      try {
        const attachment = await this.attachmentService.uploadAttachment(
          projectId,
          pending.file
        );
        uploaded.push(attachment);
      } catch (error) {
        console.error('添付ファイルのアップロードに失敗しました:', error);
        this.snackBar.open(
          `${pending.file.name} のアップロードに失敗しました`,
          '閉じる',
          { duration: 4000 }
        );
      }
    }

    this.pendingFiles = [];
    return uploaded;
  }

  private async deleteMarkedAttachments(projectId: string): Promise<void> {
    for (const attachment of this.attachmentsToRemove) {
      try {
        await this.attachmentService.deleteAttachment(attachment);
      } catch (error) {
        console.error('添付ファイルの削除に失敗しました:', error);
        this.snackBar.open('資料の削除に失敗しました', '閉じる', {
          duration: 3000,
        });
      }
    }
    this.attachmentsToRemove = [];
  }

  private parseTags(tags?: string | string[] | null): string[] {
    if (!tags) {
      return [];
    }
    if (Array.isArray(tags)) {
      return tags.filter((tag) => !!tag).map((tag) => tag.trim());
    }
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => !!tag);
  }

  private isValidUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return !!url.protocol && !!url.host;
    } catch {
      return false;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  private loadMembers(): void {
    this.membersLoading = true;
    this.memberService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
        this.membersLoading = false;
        if (this.isInlineEditMode) {
          this.syncSelectionsFromProject();
        }
      },
      error: (error) => {
        console.error('メンバー一覧の取得に失敗しました:', error);
        this.membersLoading = false;
        this.snackBar.open('メンバー一覧の取得に失敗しました', '閉じる', {
          duration: 3000,
        });
      },
    });
  }

  goBack(): void {
    if (this.returnUrl) {
      this.router.navigateByUrl(this.returnUrl, { replaceUrl: true });
      return;
    }

    if (window.history.length <= 1) {
      this.router.navigate(['/progress/projects']);
      return;
    }

    const backCount = this.navigationHistory.getBackCount();
    // 作成画面をスキップするために、必要な回数だけ戻る
    this.goBackRecursive(backCount);
  }

  /** 再帰的に戻る操作を実行 */
  private goBackRecursive(remainingCount: number): void {
    if (remainingCount <= 0 || window.history.length <= 1) {
      if (window.history.length <= 1) {
        this.router.navigate(['/progress/projects']);
      }
      return;
    }

    this.location.back();
    
    // 次の戻る操作を少し待ってから実行（ブラウザの履歴更新を待つ）
    if (remainingCount > 1) {
      setTimeout(() => {
        this.goBackRecursive(remainingCount - 1);
      }, 100); // 100ms待機
    }
  }


  /** ✅ 「＋タスク」ボタン押下でフォームを開く */
  async openAddTaskDialog() {
    if (!this.project || !this.projectId) return;

    // 親タスク数の制限をチェック
    try {
      const parentTaskCount = await this.taskService.getParentTaskCount(this.projectId);
      const maxParentTasks = 10;
      if (parentTaskCount >= maxParentTasks) {
        this.snackBar.open(
          `親タスクは最大${maxParentTasks}個作成できます`,
          '閉じる',
          { duration: 5000 }
        );
        return;
      }
    } catch (error) {
      console.error('親タスク数チェックエラー:', error);
      // エラーが発生してもタスク作成ページに遷移する
    }

    // タスク作成ページに移行
    this.router.navigate(['/task-create'], {
      state: {
        projectName: this.project.projectName,
        projectId: this.projectId,
        returnUrl: `/project/${this.projectId}`,
      },
    });
  }

  /** タスク一覧を読み込み */
  loadTasks() {
    if (!this.projectId) return;

    this.projectService
      .getTasksByProjectId(this.projectId)
      .subscribe((tasks) => {
        const nameMap: Record<string, string> = {};
        tasks.forEach((task) => {
          if (task.id) {
            nameMap[task.id] = task.taskName;
          }
        });
        this.taskNameById = nameMap;
        this.tasks = this.sortTasks(tasks);
        
        // ✅ 修正：プロジェクトのメンバーのみから選択肢を生成
        const assigneeSet = new Set<string>();
        
        // プロジェクトのmembersフィールドはメンバー名のカンマ区切り文字列
        const projectMemberNames: string[] = [];
        if (this.project?.members && this.project.members.trim().length > 0) {
          projectMemberNames.push(
            ...this.project.members
              .split(',')
              .map((name) => name.trim())
              .filter((name) => name.length > 0)
          );
        }
        
        // プロジェクトのメンバー名に一致するメンバーのみをフィルタリング
        const projectMembers = this.members.filter((member) =>
          projectMemberNames.includes(member.name || '')
        );
        
        // 各タスクの担当者を取得（assignedMembersから最新のメンバー名を取得）
        tasks.forEach((task) => {
          // assignedMembers から取得（メンバーIDからメンバー名に変換、プロジェクトのメンバーのみ）
          if (Array.isArray((task as any).assignedMembers)) {
            const memberNames = getMemberNames((task as any).assignedMembers, projectMembers);
            memberNames.forEach((name) => assigneeSet.add(name));
          }
          
          // assignee から取得（プロジェクトのメンバーのみ）
          if (task.assignee) {
            const assignees = task.assignee
              .split(',')
              .map((name) => name.trim())
              .filter((name) => name.length > 0)
              .filter((name) => {
                // プロジェクトのメンバーのみを追加
                return projectMembers.some((m) => m.name === name);
              });
            assignees.forEach((assignee) => assigneeSet.add(assignee));
          }
        });
        
        // プロジェクトのメンバー一覧からも取得（最新の名前を確実に含める）
        projectMembers.forEach((member) => {
          if (member.name) {
            const names = member.name
              .split(',')
              .map((n) => n.trim())
              .filter((n) => n.length > 0);
            names.forEach((name) => assigneeSet.add(name));
          }
        });
        
        this.assigneeOptions = Array.from(assigneeSet).sort();
        
        this.filteredTasks = [...this.tasks];
        console.log('プロジェクトのタスク一覧:', tasks);
      });
  }

  /** フィルターを適用 */
  applyFilter() {
    const filtered = this.tasks.filter((task) => {
      const statusMatch =
        !this.filterStatus || task.status === this.filterStatus;
      const priorityMatch =
        !this.filterPriority || task.priority === this.filterPriority;
      
      // ✅ 修正：カンマ区切りメンバー対応 + メンバーIDをメンバー名に変換（プロジェクトのメンバーのみ）
      let assigneeMatch = false;
      if (!this.filterAssignee) {
        assigneeMatch = true;
      } else {
        // プロジェクトのmembersフィールドはメンバー名のカンマ区切り文字列
        const projectMemberNames: string[] = [];
        if (this.project?.members && this.project.members.trim().length > 0) {
          projectMemberNames.push(
            ...this.project.members
              .split(',')
              .map((name) => name.trim())
              .filter((name) => name.length > 0)
          );
        }
        
        // プロジェクトのメンバー名に一致するメンバーのみをフィルタリング
        const projectMembers = this.members.filter((member) =>
          projectMemberNames.includes(member.name || '')
        );
        
        // assignee をカンマで分割
        const assignees = (task.assignee || '')
          .split(',')
          .map((name) => name.trim().toLowerCase())
          .filter((name) => name.length > 0)
          .filter((name) => {
            // プロジェクトのメンバーのみを対象
            return projectMembers.some((m) => m.name.toLowerCase() === name);
          });
        
        // assignedMembers も含める（メンバーIDをメンバー名に変換、プロジェクトのメンバーのみ）
        if (Array.isArray((task as any).assignedMembers)) {
          const memberNames = getMemberNames((task as any).assignedMembers, projectMembers);
          assignees.push(...memberNames.map((name) => name.toLowerCase()));
        }
        
        // フィルター値とマッチするか確認
        assigneeMatch = assignees.some(
          (a) => a === this.filterAssignee.toLowerCase()
        );
      }
      
      const dueDateMatch =
        !this.filterDueDate || task.dueDate === this.filterDueDate;

      return statusMatch && priorityMatch && assigneeMatch && dueDateMatch;
    });

    this.filteredTasks = this.sortTasks(filtered);
  }

  /** 期日フィルター変更時の処理 */
  onDueDateChange(): void {
    if (this.filterDueDateObj) {
      // DateオブジェクトをYYYY-MM-DD形式の文字列に変換
      const year = this.filterDueDateObj.getFullYear();
      const month = String(this.filterDueDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(this.filterDueDateObj.getDate()).padStart(2, '0');
      this.filterDueDate = `${year}-${month}-${day}`;
    } else {
      this.filterDueDate = '';
    }
    this.applyFilter();
  }

  /** フィルターをリセット */
  resetFilter() {
    this.filterStatus = '';
    this.filterPriority = '';
    this.filterAssignee = '';
    this.filterDueDate = '';
    this.filterDueDateObj = null;
    this.filteredTasks = [...this.sortTasks(this.tasks)];
  }

  /** タスク詳細画面に遷移 */
  goToTaskDetail(taskId: string) {
    if (!this.projectId) {
      console.error('プロジェクトIDが設定されていません');
      return;
    }
    this.router.navigate(['/project', this.projectId, 'task', taskId]);
  }

  getTasksSectionBackground(): string {
    const color = this.projectThemeColor || DEFAULT_PROJECT_THEME_COLOR;
    return color;
  }

  getProjectCardBackground(): string {
    const color = this.projectThemeColor || DEFAULT_PROJECT_THEME_COLOR;
    return color;
  }

  private sortTasks(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      const isCompletedA = a.status === '完了' ? 1 : 0;
      const isCompletedB = b.status === '完了' ? 1 : 0;

      if (isCompletedA !== isCompletedB) {
        return isCompletedA - isCompletedB;
      }

      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return dateA - dateB;
    });
  }

  toDateDisplay(date?: string): string {
    if (!date) {
      return this.languageService.translate('projectDetail.notSet');
    }
    const currentLanguage = this.languageService.getCurrentLanguage();
    const locale = currentLanguage === 'en' ? 'en-US' : 'ja-JP';
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  openNativeDatePicker(input: HTMLInputElement | null): void {
    if (!input) {
      return;
    }

    const picker = (input as any).showPicker;
    if (typeof picker === 'function') {
      picker.call(input);
    } else {
      input.focus();
      input.click();
    }
  }

  /** CSV出力 */
  exportToCSV() {
    if (!this.project || this.filteredTasks.length === 0) {
      alert('出力するデータがありません');
      return;
    }

    const csvData = this.generateCSVData();
    this.downloadCSV(csvData, `${this.project.projectName}_tasks.csv`);
  }

  /** CSVデータを生成 */
  generateCSVData(): string {
    const headers = [
      'タスク名',
      'ステータス',
      '期日',
      '優先度',
      '担当者',
      '開始日',
      '説明',
    ];
    const rows = this.filteredTasks.map((task) => [
      task.taskName,
      task.status,
      task.dueDate,
      task.priority,
      task.assignee,
      task.startDate,
      task.description || '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => `"${field}"`).join(','))
      .join('\n');

    return '\uFEFF' + csvContent; // BOMを追加してUTF-8エンコーディングを指定
  }

  /** CSVファイルをダウンロード */
  downloadCSV(csvData: string, filename: string) {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /** タスクの担当者を表示（カンマ区切り対応） */
  /** 開始日変更時の処理 */
  onStartDateChange(): void {
    if (this.editableProject && this.editableProject.startDate && this.editableProject.endDate) {
      const startDate = new Date(this.editableProject.startDate);
      const endDate = new Date(this.editableProject.endDate);
      // 開始日が終了日より後の場合は、終了日を開始日に合わせる
      if (startDate > endDate) {
        this.editableProject.endDate = this.editableProject.startDate;
      }
    }
  }

  /** 終了日変更時の処理 */
  onEndDateChange(): void {
    if (this.editableProject && this.editableProject.startDate && this.editableProject.endDate) {
      const startDate = new Date(this.editableProject.startDate);
      const endDate = new Date(this.editableProject.endDate);
      // 終了日が開始日より前の場合は、開始日を終了日に合わせる
      if (endDate < startDate) {
        this.editableProject.startDate = this.editableProject.endDate;
      }
    }
  }

  /** プロジェクトテーマカラーの16進表記を色名に変換 */
  getThemeColorLabel(color: string): string {
    return this.themeColorLabelMap[color] ?? color;
  }

  /** テーマ色を選択 */
  selectThemeColor(color: string | null): void {
    this.editableThemeColor = color;
  }

  /** テーマ色が選択済みか判定 */
  isThemeColorSelected(color: string | null): boolean {
    return this.editableThemeColor === color;
  }

  /** テーマ色をクリア（「なし」を選択） */
  clearThemeColor(): void {
    this.editableThemeColor = null;
  }

  getTaskAssigneeDisplay(task: Task): string {
    // assignedMembers がある場合はそれを使用
    if (task.assignedMembers && task.assignedMembers.length > 0) {
      // デバッグ: assignedMembersとmembersの内容を確認
      console.log('🔍 [getTaskAssigneeDisplay] タスク:', task.taskName);
      console.log('   - assignedMembers:', task.assignedMembers);
      console.log('   - this.members:', this.members);
      console.log('   - this.members.length:', this.members.length);
      
      // 各assignedMembersのUIDがmembersに存在するか確認
      task.assignedMembers.forEach((memberId, index) => {
        const member = this.members.find((m) => m.id === memberId);
        console.log(`   - assignedMembers[${index}]: ${memberId} → ${member ? member.name : '(見つからない)'}`);
      });
      
      const display = getMemberNamesAsString(
        task.assignedMembers,
        this.members,
        ', '
      );
      console.log('   - 表示結果:', display);
      return display === '未設定' ? '—' : display;
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
