import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ProjectService } from '../../services/project.service';
import { MemberManagementService } from '../../services/member-management.service';
import { ProjectDeleteConfirmDialogComponent } from '../project-detail/project-delete-confirm-dialog.component';
import { Milestone } from '../../models/task.model';
import { IProject, ProjectAttachment } from '../../models/project.model';
import { Member } from '../../models/member.model';
import { ProjectAttachmentService } from '../../services/project-attachment.service';
import {
  PROJECT_THEME_COLORS,
  ProjectThemeColor,
} from '../../constants/project-theme-colors';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-project-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    TranslatePipe,
  ],
  templateUrl: './project-form-dialog.component.html',
  styleUrls: ['./project-form-dialog.component.css'],
})
export class ProjectFormDialogComponent implements OnInit {
  readonly themeColorOptions = PROJECT_THEME_COLORS;
  private readonly themeColorLabelMap: Record<ProjectThemeColor, string> = {
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
  project = {
    projectName: '',
    overview: '',
    startDate: '',
    endDate: '',
    members: '',
    responsible: '',
    responsibleId: '',
    responsibleEmail: '',
    tags: '',
    milestones: [] as Milestone[],
    attachments: [] as ProjectAttachment[],
    themeColor: null as ProjectThemeColor | null,
  };

  // メンバー選択関連
  members: Member[] = [];
  selectedMembers: Member[] = [];
  selectedMemberIds: string[] = [];
  selectedResponsible: Member | null = null;
  selectedResponsibleId: string = '';
  membersLoading = false;
  attachments: ProjectAttachment[] = [];
  pendingFiles: { id: string; file: File }[] = [];
  linkTitle: string = '';
  linkUrl: string = '';
  isUploading = false;
  isSubmitting = false;
  attachmentsToRemove: ProjectAttachment[] = [];

  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
  readonly fileAccept =
    '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.bmp,.heic,.webp,.svg,.txt,.csv,.zip';

  isEditMode: boolean = false;
  originalProject: IProject | null = null;

  constructor(
    private projectService: ProjectService,
    private memberService: MemberManagementService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<ProjectFormDialogComponent>,
    private dialog: MatDialog,
    private attachmentService: ProjectAttachmentService,
    @Inject(MAT_DIALOG_DATA) public data: { project?: IProject }
  ) {
    if (data && data.project) {
      this.isEditMode = true;
      this.originalProject = data.project;
      this.project = {
        projectName: data.project.projectName || '',
        overview: data.project.overview || '',
        startDate: data.project.startDate || '',
        endDate: data.project.endDate || '',
        members: data.project.members || '',
        responsible: data.project.responsible || '',
        responsibleId: data.project.responsibleId || '',
        responsibleEmail: data.project.responsibleEmail || '',
        tags: data.project.tags || '',
        milestones: data.project.milestones ? [...data.project.milestones] : [],
        attachments: data.project.attachments ? [...data.project.attachments] : [],
        themeColor:
          data.project.themeColor ?? data.project.color ?? null,
      };
      this.selectedResponsibleId = this.project.responsibleId || '';
      this.attachments = data.project.attachments
        ? [...data.project.attachments]
        : [];
    }
  }

  ngOnInit(): void {
    this.loadMembers();
  }

  /**
   * メンバー一覧を読み込み
   */
  loadMembers(): void {
    this.membersLoading = true;
    this.memberService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
        this.membersLoading = false;
        console.log('メンバー一覧を読み込みました:', members.length, '件');
        this.initializeResponsibleSelection();
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
        this.snackBar.open('メンバー一覧の読み込みに失敗しました', '閉じる', {
          duration: 3000,
        });
        this.membersLoading = false;
      },
    });
  }

  /**
   * メンバー選択の変更
   */
  onMemberSelectionChange(selectedMemberIds: string[]): void {
    this.selectedMemberIds = selectedMemberIds;
    this.selectedMembers = this.members.filter((member) =>
      selectedMemberIds.includes(member.id || '')
    );
    // メンバー情報を文字列として保存（既存の構造との互換性のため）
    this.project.members = this.selectedMembers.map((m) => m.name).join(', ');
  }

  /**
   * 責任者選択の変更
   */
  onResponsibleSelectionChange(selectedId: string): void {
    if (!selectedId) {
      this.removeResponsible();
      return;
    }

    const responsible = this.members.find((member) => member.id === selectedId);
    if (responsible) {
      this.selectedResponsible = responsible;
      this.selectedResponsibleId = responsible.id || '';
      this.project.responsible = responsible.name;
      this.project.responsibleId = responsible.id || '';
      this.project.responsibleEmail = responsible.email || '';
    }
  }

  /**
   * メンバーを削除
   */
  removeMember(member: Member): void {
    this.selectedMembers = this.selectedMembers.filter(
      (m) => m.id !== member.id
    );
    this.selectedMemberIds = this.selectedMembers.map((m) => m.id || '');
    this.project.members = this.selectedMembers.map((m) => m.name).join(', ');

    if (this.selectedResponsible?.id === member.id) {
      this.removeResponsible();
    }
  }

  /**
   * 責任者を解除
   */
  removeResponsible(): void {
    this.selectedResponsible = null;
    this.selectedResponsibleId = '';
    this.project.responsible = '';
    this.project.responsibleId = '';
    this.project.responsibleEmail = '';
  }

  /**
   * テーマ色を選択
   */
  selectThemeColor(color: ProjectThemeColor | null): void {
    this.project.themeColor = color;
  }

  /**
   * テーマ色が選択されているかを判定
   */
  isThemeColorSelected(color: ProjectThemeColor | null): boolean {
    return this.project.themeColor === color;
  }

  clearThemeColor(): void {
    this.project.themeColor = null;
  }

  getThemeColorLabel(color: ProjectThemeColor | string): string {
    return this.themeColorLabelMap[color as ProjectThemeColor] ?? color;
  }

  /** ファイル選択 */
  onFilesSelected(event: Event): void {
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
          {
            duration: 4000,
          }
        );
        return;
      }

      this.pendingFiles.push({ id: this.generateId(), file });
    });

    input.value = '';
  }

  removePendingFile(pendingId: string): void {
    this.pendingFiles = this.pendingFiles.filter((item) => item.id !== pendingId);
  }

  addLinkAttachment(): void {
    const url = this.linkUrl?.trim() || '';
    const title = this.linkTitle?.trim() || '';

    if (!url) {
      this.snackBar.open('URLを入力してください', '閉じる', { duration: 3000 });
      return;
    }

    // プロトコルがない場合は自動的にhttps://を追加
    let trimmedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      trimmedUrl = 'https://' + url;
    }

    if (!this.isValidUrl(trimmedUrl)) {
      this.snackBar.open('URLの形式が正しくありません', '閉じる', { duration: 3000 });
      return;
    }

    // 既に同じURLが存在するかチェック
    const exists = this.attachments.some(
      (att) => att.type === 'link' && att.url === trimmedUrl
    );
    
    if (exists) {
      this.snackBar.open('このURLは既に追加されています', '閉じる', { duration: 3000 });
      return;
    }

    const attachment: ProjectAttachment = {
      id: this.generateId(),
      name: title || this.extractUrlLabel(trimmedUrl),
      url: trimmedUrl,
      type: 'link',
      uploadedAt: new Date().toISOString(),
    };

    this.attachments.push(attachment);
    this.project.attachments = [...this.attachments];

    this.linkTitle = '';
    this.linkUrl = '';
  }

  async removeAttachment(attachment: ProjectAttachment): Promise<void> {
    this.attachments = this.attachments.filter((item) => item.id !== attachment.id);
    this.project.attachments = [...this.attachments];

    if (attachment.type === 'file' && attachment.storagePath && this.isEditMode) {
      this.attachmentsToRemove.push(attachment);
    }
  }

  async onSubmit() {
    if (this.isSubmitting || this.isUploading) {
      return;
    }

    this.isSubmitting = true;
    try {
      const themeColor = this.project.themeColor ?? null;
      // テーマ色が「なし」の場合は白（#ffffff）に設定
      const finalThemeColor = themeColor === null ? '#ffffff' : themeColor;

      if (this.isEditMode && this.originalProject) {
        const projectId = this.originalProject.id;
        let attachments = [...this.attachments];
        if (this.pendingFiles.length > 0) {
          const uploaded = await this.uploadPendingFiles(projectId);
          if (uploaded.length > 0) {
            attachments = [...attachments, ...uploaded];
            this.attachments = attachments;
            this.project.attachments = attachments;
          }
        }

        this.project.attachments = attachments;
        const updatePayload = {
          ...this.project,
          attachments,
          themeColor: finalThemeColor,
          color: finalThemeColor,
          updatedAt: new Date(),
        };

        await this.projectService.updateProject(projectId, updatePayload);

        await this.deleteMarkedAttachments(projectId);
      } else {
        const linkAttachments = [...this.attachments];
        const projectPayload = {
          ...this.project,
          themeColor: finalThemeColor,
          color: finalThemeColor,
          attachments: linkAttachments,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const docRef = await this.projectService.addProject(projectPayload);

        if (docRef?.id && this.pendingFiles.length > 0) {
          const uploaded = await this.uploadPendingFiles(docRef.id);
          if (uploaded.length > 0) {
            const merged = [...linkAttachments, ...uploaded];
            await this.projectService.updateProject(docRef.id, {
              attachments: merged,
              updatedAt: new Date(),
            });
          }
        }
      }

      this.dialogRef.close('success');
    } catch (error) {
      console.error('プロジェクト保存エラー:', error);
      this.snackBar.open('プロジェクトの保存に失敗しました', '閉じる', {
        duration: 3000,
      });
    } finally {
      this.isSubmitting = false;
    }
  }

  onCancel() {
    this.dialogRef.close();
  }

  /** マイルストーンを追加 */
  addMilestone() {
    this.project.milestones.push({
      id: this.generateId(),
      name: '',
      date: '',
      description: '',
    });
  }

  /** マイルストーンを削除 */
  removeMilestone(index: number) {
    this.project.milestones.splice(index, 1);
  }

  /** IDを生成 */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /** 責任者選択を初期化 */
  private initializeResponsibleSelection(): void {
    if (!this.members || this.members.length === 0) {
      return;
    }

    let responsible: Member | undefined;
    if (this.project.responsibleId) {
      responsible = this.members.find(
        (member) => member.id === this.project.responsibleId
      );
    }

    if (!responsible && this.project.responsible) {
      responsible = this.members.find(
        (member) => member.name === this.project.responsible
      );
    }

    if (responsible) {
      this.selectedResponsible = responsible;
      this.selectedResponsibleId = responsible.id || '';
      this.project.responsibleId = responsible.id || '';
      this.project.responsibleEmail = responsible.email || '';
    }

    if (this.project.members) {
      const memberNames = this.project.members
        .split(',')
        .map((name) => name.trim())
        .filter((name) => !!name);
      const matchedMembers = this.members.filter((member) =>
        memberNames.includes(member.name)
      );
      this.selectedMembers = matchedMembers;
      this.selectedMemberIds = matchedMembers.map((member) => member.id || '');
    } else {
      this.selectedMembers = [];
      this.selectedMemberIds = [];
    }
  }

  /** プロジェクト削除の確認ダイアログ */
  async confirmDeleteProject(): Promise<void> {
    if (!this.originalProject) {
      return;
    }

    // タスク数を取得
    let tasksCount = 0;
    try {
      const tasks = await firstValueFrom(
        this.projectService.getTasksByProjectId(this.originalProject.id)
      );
      tasksCount = tasks?.length || 0;
    } catch (error) {
      console.error('タスク数の取得エラー:', error);
    }

    const dialogRef = this.dialog.open(ProjectDeleteConfirmDialogComponent, {
      width: '400px',
      data: {
        projectName: this.originalProject.projectName,
        projectId: this.originalProject.id,
        tasksCount: tasksCount,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === true) {
        this.deleteProject();
      }
    });
  }

  /** プロジェクトを削除 */
  async deleteProject(): Promise<void> {
    if (!this.originalProject?.id) {
      return;
    }

    try {
      await this.projectService.deleteProject(
        this.originalProject.id,
        this.originalProject
      );
      this.snackBar.open(
        `プロジェクト「${this.originalProject.projectName}」を削除しました`,
        '閉じる',
        { duration: 3000 }
      );

      // ダイアログを閉じて削除完了を通知
      this.dialogRef.close({ deleted: true });
    } catch (error) {
      console.error('プロジェクト削除エラー:', error);
      this.snackBar.open('プロジェクトの削除に失敗しました', '閉じる', {
        duration: 3000,
      });
    }
  }

  /** ネイティブ日付ピッカーを開く */
  openDatePicker(input: HTMLInputElement): void {
    if (!input) {
      return;
    }

    if (typeof (input as any).showPicker === 'function') {
      (input as any).showPicker();
    } else {
      input.focus();
      input.click();
    }
  }

  private async uploadPendingFiles(
    projectId: string
  ): Promise<ProjectAttachment[]> {
    const uploaded: ProjectAttachment[] = [];
    if (this.pendingFiles.length === 0) {
      return uploaded;
    }

    this.isUploading = true;
    try {
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
    } finally {
      this.isUploading = false;
      this.pendingFiles = [];
    }

    return uploaded;
  }

  private async deleteMarkedAttachments(projectId: string): Promise<void> {
    if (this.attachmentsToRemove.length === 0) {
      return;
    }

    for (const attachment of this.attachmentsToRemove) {
      try {
        await this.attachmentService.deleteAttachment(attachment);
      } catch (error) {
        console.error('添付ファイルの削除に失敗しました:', error);
        this.snackBar.open('一部の資料を削除できませんでした', '閉じる', {
          duration: 4000,
        });
      }
    }

    this.attachmentsToRemove = [];
  }

  private isValidUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return !!url.protocol && !!url.host;
    } catch {
      return false;
    }
  }

  /**
   * URLラベルを抽出
   */
  private extractUrlLabel(url: string): string {
    try {
      const urlObj = new URL(url);
      // ホスト名またはパス名から短いラベルを作成
      const hostname = urlObj.hostname.replace('www.', '');
      return hostname || url.substring(0, 30);
    } catch {
      return url.substring(0, 30);
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

  trackPendingFile(_index: number, item: { id: string }): string {
    return item.id;
  }

  trackAttachment(_index: number, item: ProjectAttachment): string {
    return item.id;
  }
}
