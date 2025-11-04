import { Component, OnInit } from '@angular/core';
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
  ],
  templateUrl: './member-management.component.html',
  styleUrls: ['./member-management.component.css'],
})
export class MemberManagementComponent implements OnInit {
  members: Member[] = [];
  displayedColumns: string[] = ['name', 'email', 'createdAt', 'actions'];
  loading = false;
  private memberAddedFeedback = false;

  constructor(
    private memberService: MemberManagementService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router
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
    this.memberService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
        this.loading = false;
        console.log('メンバー一覧を読み込みました:', members.length, '件');
        if (this.memberAddedFeedback) {
          this.memberAddedFeedback = false;
          this.snackBar.open('メンバーを追加しました', '閉じる', {
            duration: 3000,
          });
          const historyState = window.history.state ?? {};
          const { memberAdded, ...rest } = historyState;
          window.history.replaceState(rest, document.title);
        }
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
      width: '400px',
      data: { mode: 'edit', member: member },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'success') {
        this.loadMembers();
        this.snackBar.open('メンバーを更新しました', '閉じる', {
          duration: 3000,
        });
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

    if (!confirm(`「${member.name}」を削除してもよろしいですか？`)) {
      return;
    }

    try {
      await this.memberService.deleteMember(member.id);
      this.loadMembers();
      this.snackBar.open('メンバーを削除しました', '閉じる', {
        duration: 3000,
      });
    } catch (error) {
      console.error('メンバー削除エラー:', error);
      this.snackBar.open('メンバーの削除に失敗しました', '閉じる', {
        duration: 3000,
      });
    }
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

    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
}
