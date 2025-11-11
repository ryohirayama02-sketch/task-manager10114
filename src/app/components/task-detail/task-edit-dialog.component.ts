import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { TaskService } from '../../services/task.service';
import { MemberManagementService } from '../../services/member-management.service';
import { Task } from '../../models/task.model';
import { Member } from '../../models/member.model';
import { TaskDeleteConfirmDialogComponent } from './task-delete-confirm-dialog.component';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-task-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  template: `
    <div class="task-edit-dialog">
      <div class="dialog-header">
        <h2>{{ "taskEditDialog.title" | translate }}</h2>
      </div>

      <div class="dialog-content">
        <form (ngSubmit)="onSubmit()" #form="ngForm" class="form-container">
          <!-- タスク名 -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ "taskEditDialog.taskName" | translate }} *</mat-label>
            <input
              matInput
              [(ngModel)]="task.taskName"
              name="taskName"
              [placeholder]="'taskEditDialog.taskNamePlaceholder' | translate"
              required
            />
            <mat-icon matSuffix>assignment</mat-icon>
          </mat-form-field>

          <!-- 説明 -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ "taskEditDialog.description" | translate }}</mat-label>
            <textarea
              matInput
              [(ngModel)]="task.description"
              name="description"
              [placeholder]="'taskEditDialog.descriptionPlaceholder' | translate"
              rows="3"
              maxlength="200"
            ></textarea>
            <mat-icon matSuffix>description</mat-icon>
            <mat-hint align="end">{{ (task.description || '').length }}/200</mat-hint>
          </mat-form-field>

          <!-- タグ -->
          <div class="tag-section full-width">
            <mat-form-field appearance="outline" class="tag-input-field">
              <mat-label>{{ "taskEditDialog.tags" | translate }}</mat-label>
              <span matPrefix>#&nbsp;</span>
              <input
                id="tagInputField"
                matInput
                name="tagInput"
                [(ngModel)]="tagInputValue"
                [ngModelOptions]="{ standalone: true }"
                [placeholder]="'taskEditDialog.tagPlaceholder' | translate"
                (keydown.enter)="onTagInputEnter($event)"
                maxlength="20"
              />
              <mat-hint align="end">{{ (tagInputValue || '').length }}/20</mat-hint>
            </mat-form-field>
            <div class="tag-list" *ngIf="task.tags?.length">
              <div *ngFor="let tag of task.tags" class="tag-chip">
                <span class="tag-chip-label">#{{ tag }}</span>
                <button
                  type="button"
                  class="tag-remove-button"
                  (click)="removeTag(tag)"
                  [attr.aria-label]="('taskEditDialog.removeTag' | translate).replace('{tag}', tag)"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>
          </div>

          <!-- 担当者選択 -->
          <div class="assignee-selection">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ "taskEditDialog.assignee" | translate }}</mat-label>
              <mat-select
                [(ngModel)]="selectedMemberId"
                (selectionChange)="onMemberSelectionChange($event.value)"
                name="assignee"
              >
                <mat-option value="">{{ "taskEditDialog.noAssignee" | translate }}</mat-option>
                <mat-option *ngFor="let member of members" [value]="member.id">
                  {{ member.name }}
                </mat-option>
              </mat-select>
              <mat-icon matSuffix>person</mat-icon>
            </mat-form-field>

            <div *ngIf="membersLoading" class="loading-members">
              <mat-spinner diameter="20"></mat-spinner>
              <span>{{ "taskEditDialog.loadingMembers" | translate }}</span>
            </div>

            <div
              *ngIf="!membersLoading && members.length === 0"
              class="no-members"
            >
              <p>
                {{ "taskEditDialog.noMembers" | translate }}
              </p>
            </div>
          </div>

          <!-- ステータス -->
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>{{ "taskEditDialog.status" | translate }}</mat-label>
            <mat-select [(ngModel)]="task.status" name="status">
              <mat-option value="未着手">{{ "taskDetail.status.notStarted" | translate }}</mat-option>
              <mat-option value="作業中">{{ "taskDetail.status.inProgress" | translate }}</mat-option>
              <mat-option value="完了">{{ "taskDetail.status.completed" | translate }}</mat-option>
            </mat-select>
            <mat-icon matSuffix>flag</mat-icon>
          </mat-form-field>

          <!-- 優先度 -->
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>{{ "taskEditDialog.priority" | translate }}</mat-label>
            <mat-select [(ngModel)]="task.priority" name="priority">
              <mat-option value="高">{{ "taskDetail.priority.high" | translate }}</mat-option>
              <mat-option value="中">{{ "taskDetail.priority.medium" | translate }}</mat-option>
              <mat-option value="低">{{ "taskDetail.priority.low" | translate }}</mat-option>
            </mat-select>
            <mat-icon matSuffix>priority_high</mat-icon>
          </mat-form-field>

          <!-- 開始日 -->
          <div class="date-field">
            <label for="startDate">{{ "taskEditDialog.startDate" | translate }}</label>
            <input
              id="startDate"
              type="date"
              [(ngModel)]="task.startDate"
              name="startDate"
              [placeholder]="'taskEditDialog.startDatePlaceholder' | translate"
              class="date-input"
            />
          </div>

          <!-- 期日 -->
          <div class="date-field">
            <label for="dueDate">{{ "taskEditDialog.dueDate" | translate }}</label>
            <input
              id="dueDate"
              type="date"
              [(ngModel)]="task.dueDate"
              name="dueDate"
              [min]="task.startDate || ''"
              [placeholder]="'taskEditDialog.dueDatePlaceholder' | translate"
              class="date-input"
            />
          </div>
        </form>
      </div>

      <!-- ボタン -->
      <div class="dialog-actions">
        <!-- 削除ボタン -->
        <button
          mat-raised-button
          color="warn"
          class="delete-button"
          (click)="confirmDeleteTask()"
        >
          <mat-icon>delete</mat-icon>
          {{ "taskEditDialog.deleteTask" | translate }}
        </button>

        <button
          mat-raised-button
          type="button"
          (click)="onCancel()"
          class="cancel-button"
        >
          {{ "taskEditDialog.cancel" | translate }}
        </button>

        <button
          mat-raised-button
          type="submit"
          color="primary"
          [disabled]="!task.taskName || isSaving"
          (click)="onSubmit()"
        >
          <mat-spinner *ngIf="isSaving" diameter="20"></mat-spinner>
          <mat-icon *ngIf="!isSaving">save</mat-icon>
          {{ isSaving ? ("taskEditDialog.saving" | translate) : ("taskEditDialog.save" | translate) }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .task-edit-dialog {
        display: flex;
        flex-direction: column;
        max-height: 90vh;
        width: 100%;
        max-width: 600px;
      }

      .dialog-header {
        flex-shrink: 0;
        padding: 20px 24px 0;
        border-bottom: 1px solid #e0e0e0;
      }

      .dialog-header h2 {
        margin: 0;
        color: #333;
        font-size: 24px;
        font-weight: 500;
      }

      .dialog-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
      }

      .form-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .full-width {
        grid-column: 1 / -1;
      }

      .half-width {
        grid-column: span 1;
      }

      .tag-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .tag-input-field {
        width: 100%;
      }

      .tag-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .tag-chip {
        display: inline-flex;
        align-items: center;
        background-color: #e3f2fd;
        color: #0d47a1;
        border-radius: 16px;
        padding: 6px 10px;
        font-size: 13px;
        font-weight: 500;
        line-height: 1;
      }

      .tag-chip-label {
        display: inline-flex;
        align-items: center;
      }

      .tag-remove-button {
        border: none;
        background: transparent;
        cursor: pointer;
        margin-left: 6px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: inherit;
      }

      .tag-remove-button mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .tag-remove-button:hover {
        color: #c62828;
      }

      .tag-remove-button:focus-visible {
        outline: 2px solid #1976d2;
        border-radius: 50%;
        outline-offset: 2px;
      }

      .date-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .date-field label {
        font-size: 14px;
        font-weight: 500;
        color: #666;
      }

      .date-input {
        width: 100%;
        padding: 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 16px;
        background-color: white;
        cursor: pointer;
      }

      .date-input:focus {
        outline: none;
        border-color: #1976d2;
        box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
      }

      .assignee-selection {
        position: relative;
      }

      .loading-members {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
        color: #666;
        font-size: 14px;
      }

      .no-members {
        padding: 8px 0;
        color: #666;
        font-size: 14px;
      }

      .no-members p {
        margin: 0;
      }

      .dialog-actions {
        flex-shrink: 0;
        display: flex;
        gap: 12px;
        justify-content: flex-start;
        align-items: center;
        padding: 20px 24px;
        border-top: 1px solid #e0e0e0;
        background-color: #f8f9fa;
      }

      .dialog-actions button {
        min-width: 120px;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s ease;
      }

      .delete-button {
        background-color: #f44336;
        color: white;
        margin-right: auto;
      }

      .delete-button:hover {
        background-color: #d32f2f;
      }

      .cancel-button {
        background-color: #e0e0e0;
        color: #333;
      }

      .cancel-button:hover {
        background-color: #d0d0d0;
      }

      /* レスポンシブデザイン */
      @media (max-width: 768px) {
        .form-container {
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .half-width {
          grid-column: span 1;
        }

        .dialog-actions {
          flex-direction: column;
          padding: 16px;
        }

        .dialog-actions button {
          width: 100%;
        }
      }

      /* ダークモード対応 */
      @media (prefers-color-scheme: dark) {
        .dialog-header h2 {
          color: #fff;
        }

        .date-field label {
          color: #ccc;
        }

        .date-input {
          background-color: #2a2a2a;
          border-color: #555;
          color: #fff;
        }

        .date-input:focus {
          border-color: #1976d2;
        }

        .loading-members,
        .no-members {
          color: #ccc;
        }
      }
    `,
  ],
})
export class TaskEditDialogComponent implements OnInit {
  task: Task;
  members: Member[] = [];
  selectedMemberId: string = '';
  membersLoading = false;
  isSaving = false;
  tagInputValue = '';
  private childTasksForValidation: Task[] = [];

  constructor(
    private taskService: TaskService,
    private memberService: MemberManagementService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<TaskEditDialogComponent>,
    private dialog: MatDialog,
    private languageService: LanguageService,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      task: Task;
      projectId: string;
      projectName: string;
      oldTaskData?: Task;
      childTasks?: Task[];
    }
  ) {
    this.task = { ...data.task };
    this.task.tags = Array.isArray(this.task.tags)
      ? [...this.task.tags]
      : this.task.tags
      ? [this.task.tags]
      : [];
    this.childTasksForValidation = data.childTasks || [];
  }

  async ngOnInit(): Promise<void> {
    await this.loadMembers();
  }

  /** メンバー一覧を読み込み */
  async loadMembers(): Promise<void> {
    this.membersLoading = true;
    try {
      this.members =
        (await firstValueFrom(this.memberService.getMembers())) || [];

      // 既存の担当者を選択状態に設定
      // まず assigneeEmail で検索
      if (this.task.assigneeEmail) {
        const member = this.members.find(
          (m) => m.email === this.task.assigneeEmail
        );
        if (member) {
          this.selectedMemberId = member.id;
          return;
        }
      }
      
      // assigneeEmail が見つからない場合、assignee（名前）で検索
      if (this.task.assignee) {
        const member = this.members.find(
          (m) => m.name === this.task.assignee
        );
        if (member) {
          this.selectedMemberId = member.id;
          // assigneeEmail も設定
          this.task.assigneeEmail = member.email;
        }
      }
    } catch (error) {
      console.error('メンバー読み込みエラー:', error);
      this.snackBar.open(
        this.languageService.translate('taskEditDialog.error.membersLoadFailed'),
        this.languageService.translate('common.close'),
        {
          duration: 3000,
        }
      );
    } finally {
      this.membersLoading = false;
    }
  }

  /** メンバー選択変更 */
  onMemberSelectionChange(memberId: string): void {
    if (!memberId) {
      this.task.assignee = '';
      this.task.assigneeEmail = '';
      return;
    }

    const selectedMember = this.members.find(
      (member) => member.id === memberId
    );
    if (selectedMember) {
      this.task.assignee = selectedMember.name;
      this.task.assigneeEmail = selectedMember.email;
    }
  }

  /** タグ入力のEnter処理 */
  onTagInputEnter(event: Event): void {
    event.preventDefault();
    this.addTagFromInput();
  }

  /** 入力欄からタグを追加 */
  addTagFromInput(): void {
    const value = this.tagInputValue.trim();
    if (!value) {
      this.tagInputValue = '';
      return;
    }

    if (!this.task.tags) {
      this.task.tags = [];
    }

    if (this.task.tags.includes(value)) {
      this.tagInputValue = '';
      return;
    }

    this.task.tags.push(value);
    this.tagInputValue = '';
  }

  /** タグを削除 */
  removeTag(tag: string): void {
    if (!this.task.tags) {
      return;
    }
    this.task.tags = this.task.tags.filter((t) => t !== tag);
  }

  /** タスク削除の確認ダイアログ */
  confirmDeleteTask(): void {
    const childTasksCount = this.childTasksForValidation?.length || 0;
    const dialogRef = this.dialog.open(TaskDeleteConfirmDialogComponent, {
      width: '400px',
      data: {
        taskName: this.task.taskName,
        taskId: this.task.id,
        childTasksCount: childTasksCount,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === true) {
        this.deleteTask();
      }
    });
  }

  /** タスクを削除 */
  async deleteTask(): Promise<void> {
    if (!this.task.id) {
      return;
    }

    const childTasksCount = this.childTasksForValidation?.length || 0;
    const taskData = {
      taskName: this.task.taskName,
      projectName: this.data.projectName || this.languageService.translate('common.project'),
      attachments: this.task.attachments || [],
    };

    try {
      await this.taskService.deleteTask(
        this.task.id,
        taskData,
        this.data.projectId
      );
      
      let message: string;
      if (childTasksCount > 0) {
        message = this.languageService.translateWithParams(
          'taskEditDialog.success.deletedWithChildren',
          { taskName: this.task.taskName, count: childTasksCount.toString() }
        );
      } else {
        message = this.languageService.translateWithParams(
          'taskEditDialog.success.deleted',
          { taskName: this.task.taskName }
        );
      }
      
      this.snackBar.open(
        message,
        this.languageService.translate('common.close'),
        { duration: 3000 }
      );

      // ダイアログを閉じて削除完了を通知
      this.dialogRef.close({ deleted: true });
    } catch (error) {
      console.error('タスク削除エラー:', error);
      this.snackBar.open(
        this.languageService.translate('taskEditDialog.error.deleteFailed'),
        this.languageService.translate('common.close'),
        {
          duration: 3000,
        }
      );
    }
  }

  /** 保存 */
  async onSubmit(): Promise<void> {
    if (!this.task.taskName) {
      this.snackBar.open(
        this.languageService.translate('taskEditDialog.error.taskNameRequired'),
        this.languageService.translate('common.close'),
        {
          duration: 3000,
        }
      );
      return;
    }

    if (this.task.tags) {
      this.task.tags = this.task.tags
        .map((tag) => tag.trim())
        .filter((tag, index, arr) => tag && arr.indexOf(tag) === index);
    } else {
      this.task.tags = [];
    }

    // タスク名の重複チェック
    const taskName = this.task.taskName.trim();
    if (taskName) {
      try {
        const isSubtask = !!this.task.parentTaskId;
        if (isSubtask && this.task.parentTaskId) {
          // 子タスクの場合
          const exists = await this.taskService.childTaskNameExists(
            this.data.projectId,
            this.task.parentTaskId,
            taskName,
            this.task.id
          );
          if (exists) {
            this.snackBar.open(
              this.languageService.translate('taskEditDialog.error.childTaskNameExists'),
              this.languageService.translate('common.close'),
              {
                duration: 5000,
              }
            );
            return;
          }
        } else {
          // 親タスクの場合
          const exists = await this.taskService.taskNameExists(
            this.data.projectId,
            taskName,
            this.task.id
          );
          if (exists) {
            this.snackBar.open(
              this.languageService.translate('taskEditDialog.error.taskNameExists'),
              this.languageService.translate('common.close'),
              {
                duration: 5000,
              }
            );
            return;
          }
        }
      } catch (error) {
        console.error('タスク名重複チェックエラー:', error);
        // エラーが発生してもタスク保存は続行
      }
    }

    const detailSettings =
      this.task.detailSettings || this.data.oldTaskData?.detailSettings;
    const requireChildCompletion =
      detailSettings?.taskOrder?.requireSubtaskCompletion === true;

    if (
      requireChildCompletion &&
      this.task.status === '完了'
    ) {
      const incompleteChild = this.childTasksForValidation.find(
        (child) => child.status !== '完了'
      );
      if (incompleteChild) {
        const previousStatus = this.data.oldTaskData?.status || '作業中';
        this.task.status = previousStatus;
        const message = this.languageService.translateWithParams(
          'taskEditDialog.error.incompleteChildTask',
          { taskName: incompleteChild.taskName || this.languageService.translate('common.nameNotSet') }
        );
        this.snackBar.open(
          message,
          this.languageService.translate('common.close'),
          {
            duration: 4000,
          }
        );
        return;
      }
    }

    this.isSaving = true;
    try {
      await this.taskService.updateTask(
        this.task.id!,
        this.task,
        this.data.oldTaskData, // 古いタスクデータ
        this.data.projectId // プロジェクトID
      );

      this.snackBar.open(
        this.languageService.translate('taskEditDialog.success.updated'),
        this.languageService.translate('common.close'),
        { duration: 3000 }
      );
      this.dialogRef.close({ success: true });
    } catch (error) {
      console.error('タスク更新エラー:', error);
      this.snackBar.open(
        this.languageService.translate('taskEditDialog.error.updateFailed'),
        this.languageService.translate('common.close'),
        {
          duration: 3000,
        }
      );
    } finally {
      this.isSaving = false;
    }
  }

  /** キャンセル */
  onCancel(): void {
    this.dialogRef.close();
  }
}
