import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import {
  ProgressService,
  ProjectProgress,
} from '../../services/progress.service';
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
import { MemberManagementService } from '../../services/member-management.service';
import { Member } from '../../models/member.model';
import { ProjectAttachmentService } from '../../services/project-attachment.service';
import { ProjectFormDialogComponent } from '../project-form-dialog/project-form-dialog.component';
import { ProjectDeleteConfirmDialogComponent } from './project-delete-confirm-dialog.component';
import { ProgressCircleComponent } from '../progress/projects-overview/progress-circle.component';
import { ProjectChatComponent } from '../project-chat/project-chat.component';
import {
  DEFAULT_PROJECT_THEME_COLOR,
  resolveProjectThemeColor,
} from '../../constants/project-theme-colors';
import { inject } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

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
  editableMilestones: Milestone[] = [];
  editableAttachments: ProjectAttachment[] = [];
  pendingFiles: { id: string; file: File }[] = [];
  attachmentsToRemove: ProjectAttachment[] = [];
  linkTitle = '';
  linkUrl = '';
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
  assigneeOptions: string[] = [];

  // フィルターオプション
  statusOptions = ['未着手', '作業中', '完了'];
  priorityOptions = ['高', '中', '低'];
  private readonly returnUrl: string | null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private progressService: ProgressService,
    private snackBar: MatSnackBar,
    private memberService: MemberManagementService,
    private attachmentService: ProjectAttachmentService,
    private location: Location
  ) {
    const nav = this.router.getCurrentNavigation();
    const navState = nav?.extras?.state as { returnUrl?: string } | undefined;
    const historyState = this.location.getState() as
      | { returnUrl?: string }
      | undefined;
    this.returnUrl = navState?.returnUrl ?? historyState?.returnUrl ?? null;
  }

  private dialog = inject(MatDialog);

  ngOnInit() {
    this.loadMembers();
    this.projectId = this.route.snapshot.paramMap.get('projectId');
    console.log('選択されたプロジェクトID:', this.projectId);

    if (this.projectId) {
      this.projectService
        .getProjectById(this.projectId)
        .subscribe(async (data) => {
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
    this.linkTitle = '';
    this.linkUrl = '';
    this.tagInputValue = '';
    this.syncSelectionsFromProject();
  }

  private async saveInlineEditChanges(
    event: MatSlideToggleChange
  ): Promise<void> {
    if (!this.project || !this.editableProject) {
      event.source.checked = false;
      this.isInlineEditMode = false;
      return;
    }

    const trimmedName = this.editableProject.projectName.trim();
    if (!trimmedName) {
      this.snackBar.open('プロジェクト名を入力してください', '閉じる', {
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
      this.projectThemeColor = resolveProjectThemeColor(this.project);
      this.project.attachments = attachments;
      this.project.milestones = milestonesPayload;
      this.snackBar.open('プロジェクトを更新しました', '閉じる', {
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
      this.linkTitle = '';
      this.linkUrl = '';
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
    const names = this.extractResponsibleNames(project);
    return names.length > 0 ? names.join(', ') : '未設定';
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

    const dialogRef = this.dialog.open(ProjectDeleteConfirmDialogComponent, {
      width: '400px',
      data: {
        projectName: this.project.projectName || 'プロジェクト',
        projectId: this.project.id,
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

  addLinkAttachment(): void {
    const url = this.linkUrl.trim();
    const title = this.linkTitle.trim();

    if (!url) {
      this.snackBar.open('URLを入力してください', '閉じる', { duration: 3000 });
      return;
    }

    if (!this.isValidUrl(url)) {
      this.snackBar.open('URLの形式が正しくありません', '閉じる', {
        duration: 3000,
      });
      return;
    }

    const attachment: ProjectAttachment = {
      id: this.generateId(),
      name: title || url,
      url,
      type: 'link',
      uploadedAt: new Date().toISOString(),
    };

    this.editableAttachments.push(attachment);
    this.linkTitle = '';
    this.linkUrl = '';
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

    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/progress/projects']);
    }
  }

  /** プロジェクト編集ダイアログを開く */
  openEditProjectDialog() {
    if (!this.project) return;

    const dialogRef = this.dialog.open(ProjectFormDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
      disableClose: false,
      autoFocus: true,
      data: { project: this.project },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.deleted) {
        // プロジェクトが削除された場合、一覧画面にリダイレクト
        this.router.navigate(['/projects-overview']);
      } else if (result === 'success') {
        console.log('プロジェクトが更新されました');
        // プロジェクト情報を再読み込み
        if (this.projectId) {
          this.projectService
            .getProjectById(this.projectId)
            .subscribe((data) => {
              this.project = data;
              this.projectThemeColor = resolveProjectThemeColor(data);
              console.log('更新されたプロジェクト:', data);
            });
        }
      }
    });
  }

  /** ✅ 「＋タスク」ボタン押下でフォームを開く */
  openAddTaskDialog() {
    if (!this.project) return;

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
        this.assigneeOptions = [
          ...new Set(
            tasks.map((task) => task.assignee).filter((assignee) => !!assignee)
          ),
        ];
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
      const assigneeMatch =
        !this.filterAssignee ||
        task.assignee.toLowerCase().includes(this.filterAssignee.toLowerCase());
      const dueDateMatch =
        !this.filterDueDate || task.dueDate === this.filterDueDate;

      return statusMatch && priorityMatch && assigneeMatch && dueDateMatch;
    });

    this.filteredTasks = this.sortTasks(filtered);
  }

  /** フィルターをリセット */
  resetFilter() {
    this.filterStatus = '';
    this.filterPriority = '';
    this.filterAssignee = '';
    this.filterDueDate = '';
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
      return '未設定';
    }
    return new Date(date).toLocaleDateString('ja-JP', {
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
}
