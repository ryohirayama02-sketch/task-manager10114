import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormArray,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { MemberManagementService } from '../../services/member-management.service';
import { Member } from '../../models/member.model';
import { ProjectAttachment } from '../../models/project.model';
import { ProjectAttachmentService } from '../../services/project-attachment.service';
import {
  PROJECT_THEME_COLORS,
  ProjectThemeColor,
} from '../../constants/project-theme-colors';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './project-form.component.html',
  styleUrl: './project-form.component.css',
})
export class ProjectFormComponent implements OnInit {
  projectForm: FormGroup;
  members: Member[] = [];
  selectedMembers: Member[] = [];
  selectedResponsibles: Member[] = [];
  selectedResponsibleIds: string[] = [];
  attachments: ProjectAttachment[] = [];
  pendingFiles: { id: string; file: File }[] = [];
  linkUrl: string = '';
  loading = false;
  isSubmitting = false;
  isUploading = false;
  currentLanguage: 'ja' | 'en' = 'ja';
  readonly fileAccept =
    '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.bmp,.heic,.webp,.svg,.txt,.csv,.zip';

  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  readonly themeColorOptions = PROJECT_THEME_COLORS;
  private returnUrl: string | null = null;
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

  constructor(
    private fb: FormBuilder,
    private projectService: ProjectService,
    private memberService: MemberManagementService,
    private snackBar: MatSnackBar,
    private router: Router,
    private attachmentService: ProjectAttachmentService,
    private location: Location
  ) {
    this.projectForm = this.fb.group({
      projectName: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(30)]],
      overview: [''],
      startDate: [''],
      endDate: [''],
      responsible: [[]],
      members: [[]],
      milestones: this.fb.array([]),
      themeColor: [null],
    });

    const nav = this.router.getCurrentNavigation();
    const navState = nav?.extras?.state as { returnUrl?: string } | undefined;
    const historyState = this.location.getState() as
      | { returnUrl?: string }
      | undefined;
    this.returnUrl = navState?.returnUrl ?? historyState?.returnUrl ?? null;
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/progress/projects']);
    }
  }

  ngOnInit(): void {
    this.currentLanguage = this.detectLanguage();
    this.loadMembers();
  }

  /**
   * メンバー一覧を読み込み
   */
  loadMembers(): void {
    this.loading = true;
    this.memberService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
        this.loading = false;
        console.log('メンバー一覧を読み込みました:', members.length, '件');
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
        this.snackBar.open('メンバー一覧の読み込みに失敗しました', '閉じる', {
          duration: 3000,
        });
        this.loading = false;
      },
    });
  }

  /**
   * メンバー選択の変更
   */
  onMemberSelectionChange(selectedMemberIds: string[]): void {
    this.selectedMembers = this.members.filter((member) =>
      selectedMemberIds.includes(member.id || '')
    );
    this.projectForm.patchValue({ members: selectedMemberIds });

    // 責任者は担当メンバー外でも保持できるため追加の処理は不要
  }

  /**
   * 責任者選択の変更
   */
  onResponsibleSelectionChange(selectedIds: string[]): void {
    this.selectedResponsibleIds = Array.isArray(selectedIds)
      ? selectedIds
      : [];
    this.selectedResponsibles = this.members.filter((member) =>
      this.selectedResponsibleIds.includes(member.id || '')
    );
    this.projectForm.patchValue({ responsible: this.selectedResponsibleIds });
  }

  /**
   * メンバーを削除
   */
  removeMember(member: Member): void {
    this.selectedMembers = this.selectedMembers.filter(
      (m) => m.id !== member.id
    );
    const memberIds = this.selectedMembers.map((m) => m.id || '');
    this.projectForm.patchValue({ members: memberIds });

    if (this.selectedResponsibleIds.includes(member.id || '')) {
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
    this.projectForm.patchValue({ responsible: this.selectedResponsibleIds });
  }

  /**
   * テーマ色を選択
   */
  selectThemeColor(color: ProjectThemeColor | null): void {
    const control = this.projectForm.get('themeColor');
    control?.setValue(color);
    control?.markAsDirty();
    control?.markAsTouched();
  }

  /**
   * テーマ色が選択済みか判定
   */
  isThemeColorSelected(color: ProjectThemeColor | null): boolean {
    return this.projectForm.get('themeColor')?.value === color;
  }

  clearThemeColor(): void {
    this.selectThemeColor(null);
  }

  getThemeColorLabel(color: ProjectThemeColor | string): string {
    return this.themeColorLabelMap[color as ProjectThemeColor] ?? color;
  }

  /**
   * ファイル選択イベント
   */
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
          { duration: 4000 }
        );
        return;
      }
      this.pendingFiles.push({ id: this.generateId(), file });
    });

    input.value = '';
  }

  /**
   * アップロード予定のファイルを削除
   */
  removePendingFile(pendingId: string): void {
    this.pendingFiles = this.pendingFiles.filter((item) => item.id !== pendingId);
  }

  /**
   * URL 添付を追加
   */
  addLinkAttachment(): void {
    const url = this.linkUrl.trim();
    if (!url) {
      this.snackBar.open('URLを入力してください', '閉じる', { duration: 3000 });
      return;
    }

    if (!this.isValidUrl(url)) {
      this.snackBar.open('URLの形式が正しくありません', '閉じる', { duration: 3000 });
      return;
    }

    this.attachments.push({
      id: this.generateId(),
      name: url,
      url,
      type: 'link',
      uploadedAt: new Date().toISOString(),
    });

    this.linkUrl = '';
  }

  /**
   * 添付済み資料を削除
   */
  removeAttachment(attachment: ProjectAttachment): void {
    this.attachments = this.attachments.filter((item) => item.id !== attachment.id);
  }

  /**
   * プロジェクトを作成
   */
  async onSubmit(): Promise<void> {
    if (this.isSubmitting || this.isUploading) {
      return;
    }

    if (this.projectForm.invalid) {
      this.snackBar.open('入力内容を確認してください', '閉じる', {
        duration: 3000,
      });
      return;
    }

    this.isSubmitting = true;

    try {
      const formData = this.projectForm.value;

      const linkAttachments = [...this.attachments];

      const selectedColor: string | null = formData.themeColor ?? null;
      // テーマ色が「なし」の場合は白（#ffffff）に設定
      const finalThemeColor = selectedColor === null ? '#ffffff' : selectedColor;

      const responsiblesPayload = this.selectedResponsibles.map((member) => ({
        memberId: member.id || '',
        memberName: member.name,
        memberEmail: member.email || '',
      }));

      const responsibleNames = responsiblesPayload
        .map((r) => r.memberName)
        .filter((name) => !!name)
        .join(', ');
      const responsibleIdsArray = responsiblesPayload
        .map((r) => r.memberId)
        .filter((id): id is string => !!id);
      const responsibleEmailsArray = responsiblesPayload
        .map((r) => r.memberEmail || '')
        .filter((email) => !!email);
      const primaryResponsibleId = responsibleIdsArray[0] ?? '';
      const primaryResponsibleEmail = responsibleEmailsArray[0] ?? '';

      const projectData = {
        projectName: formData.projectName,
        overview: formData.overview || '',
        startDate: formData.startDate || '',
        endDate: formData.endDate || '',
        themeColor: finalThemeColor,
        color: finalThemeColor,
        tags: [],
        responsibles: responsiblesPayload,
        responsible: responsibleNames,
        responsibleId: primaryResponsibleId,
        responsibleEmail: primaryResponsibleEmail,
        members: this.selectedMembers.map((member) => ({
          memberId: member.id || '',
          memberName: member.name,
          memberEmail: member.email,
        })),
        milestones: this.getPreparedMilestones(),
        attachments: linkAttachments,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('プロジェクトデータ:', projectData);

      const docRef = await this.projectService.addProject(projectData);

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

      this.snackBar.open('プロジェクトを作成しました', '閉じる', {
        duration: 3000,
      });

      // 作成したプロジェクトの詳細画面へ遷移
      if (docRef?.id) {
        if (this.returnUrl) {
          this.router.navigate(['/project', docRef.id], {
            state: { returnUrl: this.returnUrl },
            replaceUrl: true,
          });
        } else {
          this.router.navigate(['/project', docRef.id], { replaceUrl: true });
        }
      } else {
        this.router.navigate(['/progress/projects'], { replaceUrl: true });
      }
    } catch (error) {
      console.error('プロジェクト作成エラー:', error);
      this.snackBar.open('プロジェクトの作成に失敗しました', '閉じる', {
        duration: 3000,
      });
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * キャンセル
   */
  onCancel(): void {
    if (this.returnUrl) {
      this.router.navigateByUrl(this.returnUrl, { replaceUrl: true });
    } else {
      this.router.navigate(['/progress/projects'], { replaceUrl: true });
    }
  }

  /**
   * エラーメッセージを取得
   */
  getErrorMessage(fieldName: string): string {
    const field = this.projectForm.get(fieldName);
    if (field?.hasError('required')) {
      return '必須項目です';
    }
    if (field?.hasError('minlength')) {
      return '1文字以上入力してください';
    }
    if (field?.hasError('maxlength')) {
      if (fieldName === 'projectName') {
        return 'プロジェクト名は30文字以内で入力してください';
      }
    }
    return '';
  }

  /**
   * マイルストーンのフォーム配列を取得
   */
  get milestones(): FormArray {
    return this.projectForm.get('milestones') as FormArray;
  }

  /**
   * マイルストーンを追加
   */
  addMilestone(): void {
    this.milestones.push(
      this.fb.group({
        id: [this.generateId()],
        name: [''],
        date: [''],
        description: [''],
      })
    );
  }

  /**
   * マイルストーンを削除
   */
  removeMilestone(index: number): void {
    this.milestones.removeAt(index);
  }

  /**
   * 送信前にマイルストーンを整形
   */
  private getPreparedMilestones() {
    return (this.milestones.value as any[]).reduce((acc, milestone) => {
      const name = (milestone.name || '').trim();
      const date = (milestone.date || '').trim();
      const description = (milestone.description || '').trim();

      if (name || date || description) {
        acc.push({
          id: milestone.id || this.generateId(),
          name,
          date,
          description,
        });
      }

      return acc;
    }, [] as Array<{ id: string; name: string; date: string; description: string }>);
  }

  /**
   * マイルストーン表示用のトラック関数
   */
  trackMilestone(index: number, control: any): string {
    return control?.get('id')?.value || index.toString();
  }

  /**
   * 一意なIDを生成
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * ネイティブ日付ピッカーを開く
   */
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

  private async uploadPendingFiles(projectId: string): Promise<ProjectAttachment[]> {
    const uploaded: ProjectAttachment[] = [];
    if (this.pendingFiles.length === 0) {
      return uploaded;
    }

    this.isUploading = true;

    try {
      for (const pending of this.pendingFiles) {
        try {
          const attachment =
            await this.attachmentService.uploadAttachment(projectId, pending.file);
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

  private isValidUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return !!url.protocol && !!url.host;
    } catch {
      return false;
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

  private detectLanguage(): 'ja' | 'en' {
    if (typeof window !== 'undefined') {
      const htmlLang = window.document?.documentElement?.lang ?? '';
      if (htmlLang.toLowerCase().startsWith('ja')) {
        return 'ja';
      }
      const storedLang =
        window.localStorage.getItem('preferredLanguage') ||
        window.localStorage.getItem('language') ||
        window.localStorage.getItem('appLanguage') ||
        '';
      if (storedLang.toLowerCase().startsWith('ja')) {
        return 'ja';
      }
    }
    return 'en';
  }
}
