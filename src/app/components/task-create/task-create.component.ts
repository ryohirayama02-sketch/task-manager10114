import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { FormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProjectService } from '../../services/project.service';
import { MemberManagementService } from '../../services/member-management.service';
import { Member } from '../../models/member.model';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-task-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './task-create.component.html',
  styleUrl: './task-create.component.css',
})
export class TaskCreatePageComponent implements OnInit {
  projectName: string = '';
  projectId: string = '';
  returnUrl: string = '';
  members: Member[] = [];
  isLoading = false;
  isSaving = false;

  taskForm = {
    taskName: '',
    status: '未着手',
    priority: '中',
    assignee: '',
    startDate: '',
    dueDate: '',
    tags: [] as string[],
    description: '',
    calendarSyncEnabled: false,
  };

  selectedMemberIds: string[] = [];
  newTag: string = '';
  statusOptions = ['未着手', '作業中', '完了'];
  priorityOptions = ['高', '中', '低'];

  constructor(
    private router: Router,
    private location: Location,
    private projectService: ProjectService,
    private memberService: MemberManagementService
  ) {}

  ngOnInit() {
    const navState = this.location.getState() as any;
    this.projectName = navState?.projectName || '';
    this.projectId = navState?.projectId || '';
    this.returnUrl = navState?.returnUrl || '/kanban';
    this.loadMembers();
  }

  loadMembers() {
    this.memberService.getMembers().subscribe({
      next: (members) => {
        this.members = members;
      },
      error: (error) => {
        console.error('メンバー一覧の読み込みエラー:', error);
      },
    });
  }

  onMembersSelectionChange(memberIds: string[]) {
    this.selectedMemberIds = memberIds;
    this.taskForm.assignee = this.selectedMemberIds
      .map((id) => this.members.find((m) => m.id === id)?.name)
      .join(', ');
  }

  addTag() {
    if (this.newTag && !this.taskForm.tags.includes(this.newTag)) {
      this.taskForm.tags.push(this.newTag);
      this.newTag = '';
    }
  }

  removeTag(tag: string) {
    this.taskForm.tags = this.taskForm.tags.filter((t) => t !== tag);
  }

  async save() {
    if (!this.taskForm.taskName.trim()) {
      alert('タスク名を入力してください');
      return;
    }

    if (!this.projectId) {
      alert('プロジェクトが指定されていません');
      return;
    }

    this.isSaving = true;
    try {
      await this.projectService.addTaskToProject(this.projectId, {
        ...this.taskForm,
        projectName: this.projectName,
      });
      console.log('タスク追加成功');
      this.goBack();
    } catch (error) {
      console.error('タスク追加失敗:', error);
      alert('保存に失敗しました');
    } finally {
      this.isSaving = false;
    }
  }

  cancel() {
    this.goBack();
  }

  goBack() {
    if (this.returnUrl) {
      this.router.navigateByUrl(this.returnUrl);
    } else {
      this.location.back();
    }
  }
}
