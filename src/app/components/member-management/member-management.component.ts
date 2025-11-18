import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MemberManagementService } from '../../services/member-management.service';
import { Member } from '../../models/member.model';
import { MemberFormDialogComponent } from './member-form-dialog/member-form-dialog.component';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { ProjectService } from '../../services/project.service';
import {
  MemberRemoveConfirmDialogComponent,
  MemberRemoveConfirmDialogData,
} from '../project-detail/member-remove-confirm-dialog.component';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Task } from '../../models/task.model';

@Component({
  selector: 'app-member-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe,
  ],
  templateUrl: './member-management.component.html',
  styleUrls: ['./member-management.component.css'],
})
export class MemberManagementComponent implements OnInit, OnDestroy {
  members: Member[] = [];
  displayedColumns: string[] = ['name', 'email', 'actions'];
  loading = false;
  private memberAddedFeedback = false;
  memberCountLimitReached = false;
  readonly maxMemberCount = 10;
  private destroy$ = new Subject<void>();

  constructor(
    private memberService: MemberManagementService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
    private languageService: LanguageService,
    private projectService: ProjectService
  ) {}

  ngOnInit(): void {
    const historyState = window.history.state as { memberAdded?: boolean };
    this.memberAddedFeedback = !!historyState?.memberAdded;
    this.loadMembers();
  }

  /**
   * メンバー一覧を読み込み
   */
  loadMembers(): void {
    this.loading = true;
    this.memberService.getMembers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (members) => {
        this.members = members;
        this.memberCountLimitReached = members.length >= this.maxMemberCount;
        this.loading = false;
        console.log('メンバー一覧を読み込みました:', members.length, '件');
        if (this.memberAddedFeedback) {
          this.memberAddedFeedback = false;
          this.snackBar.open(
            this.languageService.translate('memberManagement.memberAdded'),
            this.languageService.translate('memberManagement.close'),
            {
              duration: 3000,
            }
          );
          const historyState = window.history.state ?? {};
          const { memberAdded, ...rest } = historyState;
          window.history.replaceState(rest, document.title);
        }
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
        this.snackBar.open(
          this.languageService.translate('memberManagement.loadFailed'),
          this.languageService.translate('common.close'),
          {
            duration: 3000,
          }
        );
        this.loading = false;
      },
    });
  }

  /**
   * メンバー追加ダイアログを開く
   */
  openAddMemberDialog(): void {
    this.router.navigate(['/members/add']);
  }

  /**
   * メンバー編集ダイアログを開く
   */
  openEditMemberDialog(member: Member): void {
    const dialogRef = this.dialog.open(MemberFormDialogComponent, {
      width: '90vw',
      maxWidth: '600px',
      maxHeight: '90vh',
      data: { mode: 'edit', member: member },
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (result === 'success') {
          this.loadMembers();
          this.snackBar.open(
            this.languageService.translate('memberManagement.memberUpdated'),
            this.languageService.translate('common.close'),
            {
              duration: 3000,
            }
          );
        }
      });
  }

  /**
   * メンバーを削除
   */
  async deleteMember(member: Member): Promise<void> {
    if (!member.id) {
      console.error('メンバーIDがありません');
      return;
    }

    const memberId = member.id;

    // すべてのプロジェクトとタスクを取得して影響をカウント
    let affectedTasksCount = 0;
    let tasksToDeleteCount = 0;

    try {
      // すべてのプロジェクトを取得
      const allProjects = await firstValueFrom(
        this.projectService.getProjects()
      ).catch(() => []);

      // 各プロジェクトのタスクを確認
      for (const project of allProjects) {
        if (!project.id) continue;

        const allTasks = await firstValueFrom(
          this.projectService.getTasksByProjectId(project.id)
        ).catch(() => [] as Task[]);

        for (const task of allTasks) {
          const assignedMembers = Array.isArray(task.assignedMembers)
            ? task.assignedMembers
            : [];
          const hasMember = assignedMembers.includes(memberId);

          if (hasMember) {
            affectedTasksCount++;
            // このメンバーしか担当者がいない場合は削除対象
            if (assignedMembers.length === 1) {
              tasksToDeleteCount++;
            }
          }
        }
      }
    } catch (error) {
      console.error('タスク数のカウントエラー:', error);
      // エラーが発生しても警告ダイアログは表示する
    }

    // 警告ダイアログを表示
    const dialogData: MemberRemoveConfirmDialogData = {
      memberName: member.name || '',
      memberId: memberId,
      affectedTasksCount,
      tasksToDeleteCount,
      isFromManagement: true, // メンバー管理から削除する場合
    };

    const dialogRef = this.dialog.open(MemberRemoveConfirmDialogComponent, {
      width: '90vw',
      maxWidth: '500px',
      data: dialogData,
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (confirmed) => {
        if (!confirmed) {
          return;
        }

        try {
          await this.memberService.deleteMember(memberId);
          this.loadMembers();
          this.snackBar.open(
            this.languageService.translate('memberManagement.memberDeleted'),
            this.languageService.translate('common.close'),
            {
              duration: 3000,
            }
          );
        } catch (error) {
          console.error('メンバー削除エラー:', error);
          this.snackBar.open(
            this.languageService.translate('memberManagement.deleteFailed'),
            this.languageService.translate('common.close'),
            {
              duration: 3000,
            }
          );
        }
      });
  }

  /**
   * 日付をフォーマット
   */
  formatDate(date: Date | string | any | undefined): string {
    if (!date) return '-';

    let d: Date;

    // FirestoreのTimestampオブジェクトの場合
    if (date && typeof date === 'object' && 'toDate' in date) {
      d = date.toDate();
    }
    // 文字列の場合
    else if (typeof date === 'string') {
      d = new Date(date);
    }
    // Dateオブジェクトの場合
    else if (date instanceof Date) {
      d = date;
    }
    // その他の場合（数値のタイムスタンプなど）
    else {
      d = new Date(date);
    }

    // 無効な日付の場合は'-'を返す
    if (isNaN(d.getTime())) {
      return '-';
    }

    const locale =
      this.languageService.getCurrentLanguage() === 'ja' ? 'ja-JP' : 'en-US';
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  /**
   * メールアドレスを30文字で切り詰める
   */
  truncateEmail(email: string | undefined): string {
    if (!email) return '';
    if (email.length <= 30) return email;
    return email.substring(0, 30) + '...';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * メンバー数の上限メッセージを取得
   */
  getMaxMemberLimitMessage(): string {
    return this.languageService.translateWithParams(
      'memberManagement.maxMemberLimit',
      {
        count: this.maxMemberCount.toString(),
      }
    );
  }
}
