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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
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
import { LanguageService } from '../../services/language.service';
import { AuthService } from '../../services/auth.service';
import { filter, take, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

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
    MatDatepickerModule,
    MatNativeDateModule,
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
  projectCountLimitReached = false;
  projectCountLimitMessage = '';
  startDateObj: Date | null = null; // Material date picker用
  endDateObj: Date | null = null; // Material date picker用
  maxDate = new Date(9999, 11, 31); // 9999-12-31
  startDateError: string | null = null; // 開始日のエラーメッセージ
  endDateError: string | null = null; // 終了日のエラーメッセージ
  readonly fileAccept =
    '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.bmp,.heic,.webp,.svg,.txt,.csv,.zip';

  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  readonly themeColorOptions = PROJECT_THEME_COLORS;
  private returnUrl: string | null = null;
  private readonly themeColorLabelMap: Record<ProjectThemeColor, string> = {
    '#fde4ec': 'projectForm.themeColor.pink',
    '#ffe6dc': 'projectForm.themeColor.peach',
    '#ffedd6': 'projectForm.themeColor.apricot',
    '#fff8e4': 'projectForm.themeColor.yellow',
    '#eef6da': 'projectForm.themeColor.lime',
    '#e4f4e8': 'projectForm.themeColor.mint',
    '#dcf3f0': 'projectForm.themeColor.blueGreen',
    '#def3ff': 'projectForm.themeColor.skyBlue',
    '#e6e9f9': 'projectForm.themeColor.lavenderBlue',
    '#ece6f8': 'projectForm.themeColor.purple',
  };

  constructor(
    private fb: FormBuilder,
    private projectService: ProjectService,
    private memberService: MemberManagementService,
    private snackBar: MatSnackBar,
    private router: Router,
    private attachmentService: ProjectAttachmentService,
    private location: Location,
    private languageService: LanguageService,
    private authService: AuthService
  ) {
    this.projectForm = this.fb.group({
      projectName: [
        '',
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(30),
        ],
      ],
      overview: [''],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
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
    this.checkProjectCountLimit();
  }

  /**
   * プロジェクト数の制限をチェック
   * ✅ 修正: roomIdが設定されるまで待ってから処理を進める
   */
  async checkProjectCountLimit(): Promise<void> {
    try {
      // roomIdが設定されるまで待つ
      const roomId = await new Promise<string | null>((resolve) => {
        this.authService.currentRoomId$
          .pipe(
            filter((id) => !!id),
            take(1)
          )
          .subscribe((id) => {
            console.log('🔑 roomIdが設定されました（プロジェクト作成）:', id);
            resolve(id);
          });
      });

      if (!roomId) {
        console.warn('roomIdが設定されていません');
        return;
      }

      const currentCount = await this.projectService.getProjectCount();
      const maxCount = 10;
      if (currentCount >= maxCount) {
        this.projectCountLimitReached = true;
        const message = this.languageService.translate(
          'projectForm.maxProjectLimit'
        );
        this.projectCountLimitMessage = message.replace(
          '{{count}}',
          maxCount.toString()
        );
      } else {
        this.projectCountLimitReached = false;
        this.projectCountLimitMessage = '';
      }
    } catch (error) {
      console.error(
        this.languageService.translate('projectForm.error.projectCountFetch'),
        error
      );
    }
  }

  // 開始日変更時の処理（カレンダー選択時）
  onStartDateChange(): void {
    if (this.startDateObj) {
      const year = this.startDateObj.getFullYear();
      // 年が4桁であることをチェック
      if (year < 1000 || year > 9999) {
        this.startDateError = this.languageService.translate(
          'projectForm.error.yearMustBe4Digits'
        );
        this.startDateObj = null;
        this.projectForm.patchValue({ startDate: '' });
        return;
      }

      // 開始日が終了日より後の場合は、終了日を開始日に合わせる
      if (this.endDateObj && this.startDateObj > this.endDateObj) {
        this.endDateObj = new Date(this.startDateObj);
        const endYear = this.endDateObj.getFullYear();
        const endMonth = String(this.endDateObj.getMonth() + 1).padStart(
          2,
          '0'
        );
        const endDay = String(this.endDateObj.getDate()).padStart(2, '0');
        this.projectForm.patchValue({
          endDate: `${endYear}-${endMonth}-${endDay}`,
        });
      }

      this.startDateError = null;
      const month = String(this.startDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(this.startDateObj.getDate()).padStart(2, '0');
      this.projectForm.patchValue({ startDate: `${year}-${month}-${day}` });
    } else {
      this.startDateError = null;
      this.projectForm.patchValue({ startDate: '' });
    }
  }

  // 開始日手入力時の処理
  onStartDateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();

    // 空の場合はクリア
    if (!value) {
      this.startDateObj = null;
      this.startDateError = null;
      this.projectForm.patchValue({ startDate: '' });
      return;
    }

    // 年が4桁であることをチェック
    const yearValidation = this.validateYearFormat(value);
    if (!yearValidation.isValid) {
      this.startDateError = yearValidation.errorMessage;
      this.startDateObj = null;
      this.projectForm.patchValue({ startDate: '' });
      return;
    }

    // Material Datepickerが自動的に処理する場合があるため、
    // 日付が完全に入力されている場合のみパースを試みる
    // 日付文字列をパース
    const parsedDate = this.parseDateString(value);
    if (parsedDate && this.isValidDate(parsedDate)) {
      // 年が4桁であることを再確認
      const year = parsedDate.getFullYear();
      if (year < 1000 || year > 9999) {
        this.startDateError = this.languageService.translate(
          'projectForm.error.yearMustBe4Digits'
        );
        this.startDateObj = null;
        this.projectForm.patchValue({ startDate: '' });
        return;
      }

      // 日付が有効な場合のみ更新
      this.startDateObj = parsedDate;
      this.startDateError = null;
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsedDate.getDate()).padStart(2, '0');
      this.projectForm.patchValue({ startDate: `${year}-${month}-${day}` });
    } else {
      // パースできない場合、エラーをクリア（Material Datepickerのエラーハンドリングに任せる）
      this.startDateError = null;
    }
  }

  // 終了日変更時の処理（カレンダー選択時）
  onEndDateChange(): void {
    if (this.endDateObj) {
      const year = this.endDateObj.getFullYear();
      // 年が4桁であることをチェック
      if (year < 1000 || year > 9999) {
        this.endDateError = this.languageService.translate(
          'projectForm.error.yearMustBe4Digits'
        );
        this.endDateObj = null;
        this.projectForm.patchValue({ endDate: '' });
        return;
      }
      this.endDateError = null;
      const month = String(this.endDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(this.endDateObj.getDate()).padStart(2, '0');
      this.projectForm.patchValue({ endDate: `${year}-${month}-${day}` });
    } else {
      this.endDateError = null;
      this.projectForm.patchValue({ endDate: '' });
    }
  }

  // 終了日手入力時の処理
  onEndDateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();

    // 空の場合はクリア
    if (!value) {
      this.endDateObj = null;
      this.endDateError = null;
      this.projectForm.patchValue({ endDate: '' });
      return;
    }

    // 年が4桁であることをチェック
    const yearValidation = this.validateYearFormat(value);
    if (!yearValidation.isValid) {
      this.endDateError = yearValidation.errorMessage;
      this.endDateObj = null;
      this.projectForm.patchValue({ endDate: '' });
      return;
    }

    // Material Datepickerが自動的に処理する場合があるため、
    // 日付が完全に入力されている場合のみパースを試みる
    // 日付文字列をパース
    const parsedDate = this.parseDateString(value);
    if (parsedDate && this.isValidDate(parsedDate)) {
      // 年が4桁であることを再確認
      const year = parsedDate.getFullYear();
      if (year < 1000 || year > 9999) {
        this.endDateError = this.languageService.translate(
          'projectForm.error.yearMustBe4Digits'
        );
        this.endDateObj = null;
        this.projectForm.patchValue({ endDate: '' });
        return;
      }

      // 日付が有効な場合のみ更新
      this.endDateObj = parsedDate;
      this.endDateError = null;
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsedDate.getDate()).padStart(2, '0');
      this.projectForm.patchValue({ endDate: `${year}-${month}-${day}` });
    } else {
      // パースできない場合、エラーをクリア（Material Datepickerのエラーハンドリングに任せる）
      this.endDateError = null;
    }
  }

  /**
   * 日付文字列をパースしてDateオブジェクトに変換
   * 複数の形式に対応: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY など
   */
  private parseDateString(dateString: string): Date | null {
    if (!dateString || !dateString.trim()) {
      return null;
    }

    const trimmed = dateString.trim();

    // YYYY-MM-DD形式
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const date = new Date(year, month, day);
        if (
          this.isValidDate(date) &&
          date.getFullYear() === year &&
          date.getMonth() === month &&
          date.getDate() === day
        ) {
          return date;
        }
      }
    }

    // YYYY/MM/DD形式（日本語形式）
    const jpMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (jpMatch) {
      const year = parseInt(jpMatch[1], 10);
      const month = parseInt(jpMatch[2], 10) - 1;
      const day = parseInt(jpMatch[3], 10);
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const date = new Date(year, month, day);
        if (
          this.isValidDate(date) &&
          date.getFullYear() === year &&
          date.getMonth() === month &&
          date.getDate() === day
        ) {
          return date;
        }
      }
    }

    // MM/DD/YYYY形式（英語形式）
    const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) {
      const month = parseInt(usMatch[1], 10) - 1;
      const day = parseInt(usMatch[2], 10);
      const year = parseInt(usMatch[3], 10);
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const date = new Date(year, month, day);
        if (
          this.isValidDate(date) &&
          date.getFullYear() === year &&
          date.getMonth() === month &&
          date.getDate() === day
        ) {
          return date;
        }
      }
    }

    // DD/MM/YYYY形式（ヨーロッパ形式）
    const euMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (euMatch) {
      const day = parseInt(euMatch[1], 10);
      const month = parseInt(euMatch[2], 10) - 1;
      const year = parseInt(euMatch[3], 10);
      // MM/DD/YYYYとして既に試した場合はスキップ
      if (
        !(
          month >= 0 &&
          month <= 11 &&
          day >= 1 &&
          day <= 31 &&
          parseInt(euMatch[1], 10) <= 12
        )
      ) {
        if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          const date = new Date(year, month, day);
          if (
            this.isValidDate(date) &&
            date.getFullYear() === year &&
            date.getMonth() === month &&
            date.getDate() === day
          ) {
            return date;
          }
        }
      }
    }

    // その他の形式はブラウザのDate.parseに任せる（最後の手段）
    try {
      const parsed = new Date(trimmed);
      if (this.isValidDate(parsed) && !isNaN(parsed.getTime())) {
        // 日付が妥当な範囲内かチェック
        const year = parsed.getFullYear();
        if (year >= 1900 && year <= 9999) {
          return parsed;
        }
      }
    } catch (e) {
      // パースエラーは無視
    }

    return null;
  }

  /**
   * 有効な日付かどうかをチェック
   */
  private isValidDate(date: Date): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * 日付文字列の年が4桁であることをバリデーション
   */
  private validateYearFormat(dateString: string): {
    isValid: boolean;
    errorMessage: string | null;
  } {
    if (!dateString || !dateString.trim()) {
      return { isValid: true, errorMessage: null };
    }

    const trimmed = dateString.trim();

    // YYYY-MM-DD形式
    const isoMatch = trimmed.match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const year = isoMatch[1];
      if (year.length !== 4) {
        return {
          isValid: false,
          errorMessage: this.languageService.translate(
            'projectForm.error.yearMustBe4Digits'
          ),
        };
      }
    }

    // YYYY/MM/DD形式（日本語形式）
    const jpMatch = trimmed.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,2})$/);
    if (jpMatch) {
      const year = jpMatch[1];
      if (year.length !== 4) {
        return {
          isValid: false,
          errorMessage: this.languageService.translate(
            'projectForm.error.yearMustBe4Digits'
          ),
        };
      }
    }

    // MM/DD/YYYY形式（英語形式）
    const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/);
    if (usMatch) {
      const year = usMatch[3];
      if (year.length !== 4) {
        return {
          isValid: false,
          errorMessage: this.languageService.translate(
            'projectForm.error.yearMustBe4Digits'
          ),
        };
      }
    }

    // DD/MM/YYYY形式（ヨーロッパ形式）
    const euMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/);
    if (euMatch) {
      const year = euMatch[3];
      if (year.length !== 4) {
        return {
          isValid: false,
          errorMessage: this.languageService.translate(
            'projectForm.error.yearMustBe4Digits'
          ),
        };
      }
    }

    return { isValid: true, errorMessage: null };
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
        console.error(
          this.languageService.translate('projectForm.error.membersLoadFailed'),
          error
        );
        this.snackBar.open(
          this.languageService.translate('projectForm.error.membersLoad'),
          this.languageService.translate('projectForm.close'),
          {
            duration: 3000,
          }
        );
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
    this.selectedResponsibleIds = Array.isArray(selectedIds) ? selectedIds : [];
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
    const translationKey = this.themeColorLabelMap[color as ProjectThemeColor];
    if (translationKey) {
      return this.languageService.translate(translationKey);
    }
    return color;
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

    // ファイルとURLの合計が3つを超えないようにチェック
    const currentTotal = this.attachments.length + this.pendingFiles.length;
    if (currentTotal >= 3) {
      this.snackBar.open(
        this.languageService.translate(
          'projectForm.error.maxAttachmentsReached'
        ),
        this.languageService.translate('projectForm.close'),
        { duration: 3000 }
      );
      input.value = '';
      return;
    }

    Array.from(files).forEach((file) => {
      // ファイルとURLの合計が3つを超えないようにチェック
      if (this.attachments.length + this.pendingFiles.length >= 3) {
        this.snackBar.open(
          this.languageService.translate(
            'projectForm.error.maxAttachmentsReached'
          ),
          this.languageService.translate('projectForm.close'),
          { duration: 3000 }
        );
        return;
      }

      if (file.size > this.MAX_FILE_SIZE) {
        this.snackBar.open(
          file.name +
            this.languageService.translate(
              'projectForm.error.fileSizeExceeded'
            ),
          this.languageService.translate('projectForm.close'),
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
    this.pendingFiles = this.pendingFiles.filter(
      (item) => item.id !== pendingId
    );
  }

  /**
   * URL 添付を追加
   */
  addLinkAttachment(): void {
    if (!this.linkUrl || !this.linkUrl.trim()) {
      this.snackBar.open(
        this.languageService.translate('projectForm.error.enterUrl'),
        this.languageService.translate('projectForm.close'),
        { duration: 3000 }
      );
      return;
    }

    const url = this.linkUrl.trim();

    // プロトコルがない場合は自動的にhttps://を追加
    let trimmedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      trimmedUrl = 'https://' + url;
    }

    if (!this.isValidUrl(trimmedUrl)) {
      this.snackBar.open(
        this.languageService.translate('projectForm.error.invalidUrl'),
        this.languageService.translate('projectForm.close'),
        { duration: 3000 }
      );
      return;
    }

    // ファイルとURLの合計が3つを超えないようにチェック
    if (this.attachments.length + this.pendingFiles.length >= 3) {
      this.snackBar.open(
        this.languageService.translate(
          'projectForm.error.maxAttachmentsReached'
        ),
        this.languageService.translate('projectForm.close'),
        { duration: 3000 }
      );
      return;
    }

    // 既に同じURLが存在するかチェック
    const exists = this.attachments.some(
      (att) => att.type === 'link' && att.url === trimmedUrl
    );

    if (exists) {
      this.snackBar.open(
        this.languageService.translate('projectForm.error.urlAlreadyAdded'),
        this.languageService.translate('projectForm.close'),
        { duration: 3000 }
      );
      return;
    }

    const newAttachment = {
      id: this.generateId(),
      name: this.extractUrlLabel(trimmedUrl),
      url: trimmedUrl,
      type: 'link' as const,
      uploadedAt: new Date().toISOString(),
    };

    this.attachments.push(newAttachment);
    this.linkUrl = '';
  }

  /**
   * 添付済み資料を削除
   */
  removeAttachment(attachment: ProjectAttachment): void {
    this.attachments = this.attachments.filter(
      (item) => item.id !== attachment.id
    );
  }

  /**
   * プロジェクトを作成
   */
  async onSubmit(): Promise<void> {
    if (this.isSubmitting || this.isUploading) {
      return;
    }

    // 日付オブジェクトからフォームに値を設定
    if (this.startDateObj) {
      const year = this.startDateObj.getFullYear();
      const month = String(this.startDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(this.startDateObj.getDate()).padStart(2, '0');
      this.projectForm.patchValue({ startDate: `${year}-${month}-${day}` });
    }
    if (this.endDateObj) {
      const year = this.endDateObj.getFullYear();
      const month = String(this.endDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(this.endDateObj.getDate()).padStart(2, '0');
      this.projectForm.patchValue({ endDate: `${year}-${month}-${day}` });
    }

    // 開始日と終了日の必須チェック
    if (
      !this.projectForm.get('startDate')?.value ||
      !this.projectForm.get('endDate')?.value
    ) {
      this.snackBar.open(
        this.languageService.translate('projectForm.error.datesRequired'),
        this.languageService.translate('projectForm.close'),
        {
          duration: 3000,
        }
      );
      return;
    }

    // 責任者の必須チェック
    if (!this.selectedResponsibles || this.selectedResponsibles.length === 0) {
      this.snackBar.open(
        this.languageService.translate('projectForm.error.responsibleRequired'),
        this.languageService.translate('projectForm.close'),
        {
          duration: 3000,
        }
      );
      return;
    }

    // プロジェクトメンバーの必須チェック
    if (!this.selectedMembers || this.selectedMembers.length === 0) {
      this.snackBar.open(
        this.languageService.translate('projectForm.error.membersRequired'),
        this.languageService.translate('projectForm.close'),
        {
          duration: 3000,
        }
      );
      return;
    }

    if (this.projectForm.invalid) {
      this.snackBar.open(
        this.languageService.translate('projectForm.error.checkInput'),
        this.languageService.translate('projectForm.close'),
        {
          duration: 3000,
        }
      );
      return;
    }

    // プロジェクト数の制限をチェック
    await this.checkProjectCountLimit();
    if (this.projectCountLimitReached) {
      this.snackBar.open(
        this.projectCountLimitMessage,
        this.languageService.translate('projectForm.close'),
        {
          duration: 5000,
        }
      );
      return;
    }

    // プロジェクト名の重複チェック
    const projectName = this.projectForm.get('projectName')?.value?.trim();
    if (projectName) {
      const exists = await this.projectService.projectNameExists(projectName);
      if (exists) {
        this.snackBar.open(
          this.languageService.translate('projectForm.error.projectNameExists'),
          this.languageService.translate('projectForm.close'),
          {
            duration: 5000,
          }
        );
        return;
      }
    }

    this.isSubmitting = true;

    try {
      const formData = this.projectForm.value;

      const linkAttachments = [...this.attachments];

      const selectedColor: string | null = formData.themeColor ?? null;
      // テーマ色が「なし」の場合は白（#ffffff）に設定
      const finalThemeColor =
        selectedColor === null ? '#ffffff' : selectedColor;

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
        members: this.selectedMembers.map((member) => member.name).join(', '),
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
          await this.projectService.updateProject(
            docRef.id,
            {
              attachments: merged,
              updatedAt: new Date(),
            },
            true
          ); // skipLogging: true - 作成直後の添付ファイル更新はログに記録しない
        }
      }

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
      return this.languageService.translate('projectForm.error.required');
    }
    if (field?.hasError('minlength')) {
      return this.languageService.translate('projectForm.error.minLength');
    }
    if (field?.hasError('maxlength')) {
      if (fieldName === 'projectName') {
        return this.languageService.translate(
          'projectForm.error.projectNameMaxLength'
        );
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
    if (this.milestones.length >= 3) {
      this.snackBar.open(
        this.languageService.translate('projectForm.maxMilestonesReached'),
        this.languageService.translate('projectForm.close'),
        {
          duration: 3000,
        }
      );
      return;
    }
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
   * マイルストーンの日付をDateオブジェクトに変換して取得
   */
  getMilestoneDate(index: number): Date | null {
    const milestone = this.milestones.at(index);
    if (!milestone) {
      return null;
    }
    const dateValue = milestone.get('date')?.value;
    if (!dateValue) {
      return null;
    }
    return new Date(dateValue);
  }

  /**
   * マイルストーンの日付変更時の処理
   */
  onMilestoneDateChange(index: number, event: any): void {
    const milestone = this.milestones.at(index);
    if (!milestone) {
      return;
    }
    const date = event.value;
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      milestone.patchValue({ date: `${year}-${month}-${day}` });
    } else {
      milestone.patchValue({ date: '' });
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
          console.error(
            this.languageService.translate(
              'projectForm.error.attachmentUploadFailed'
            ),
            error
          );
          this.snackBar.open(
            pending.file.name +
              this.languageService.translate('projectForm.error.uploadFailed'),
            this.languageService.translate('projectForm.close'),
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
