import { Component, Input, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  Firestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { AuthService } from '../../services/auth.service';
import { ProjectService } from '../../services/project.service';
import { Member } from '../../models/member.model';
import { ChatMessage } from '../../models/task.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface MentionCandidate {
  uid: string;
  displayName: string;
  photoURL?: string;
}

@Component({
  selector: 'app-project-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
  ],
  templateUrl: './project-chat.component.html',
  styleUrls: ['./project-chat.component.css'],
})
export class ProjectChatComponent implements OnInit, OnDestroy {
  @Input() projectId: string = '';
  @Input() chatTitle: string = 'チャット';
  @Input() members: Member[] = []; // 外部からメンバーを受け取る
  @ViewChild('messageInput', { static: false }) messageInput?: ElementRef;

  messages: ChatMessage[] = [];
  newMessage = '';
  loading = true;
  currentUserId: string | null = null;
  currentUserName: string = '';

  // メンション関連プロパティ
  showMentionCandidates = false;
  mentionCandidates: MentionCandidate[] = [];
  mentionSearchTerm = '';
  mentionCursorPosition = 0;
  projectMembers: Member[] = [];
  selectedMentionCandidate = -1;

  private destroy$ = new Subject<void>();

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private projectService: ProjectService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.authService.user$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      if (user) {
        this.currentUserId = user.uid;
        this.currentUserName = user.displayName || user.email || 'Anonymous';
      }
    });

    if (this.projectId) {
      // メンバーが外部から渡されていない場合のみ取得
      if (this.members && this.members.length > 0) {
        this.projectMembers = this.members;
      } else {
        this.loadProjectMembers();
      }
      this.loadMessages();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProjectMembers() {
    this.projectService
      .getProjectById(this.projectId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((project) => {
        if (project && Array.isArray(project.members)) {
          // members がオブジェクト配列の場合
          if (
            project.members.length > 0 &&
            typeof project.members[0] === 'object'
          ) {
            this.projectMembers = project.members as any[];
          } else if (typeof project.members === 'string') {
            // members が文字列の場合はパース
            const memberNames = project.members
              .split(',')
              .map((name) => name.trim());
            // ここではメンバーのUID情報がないため、取得する必要があります
            this.loadMembersFromService();
          }
        } else {
          this.loadMembersFromService();
        }
      });
  }

  private loadMembersFromService() {
    // プロジェクトのメンバー情報を取得
    // このプロジェクトのメンバーIDから実際のメンバー情報を取得
  }

  private loadMessages() {
    if (!this.projectId) return;

    const messagesRef = collection(
      this.firestore,
      `projects/${this.projectId}/messages`
    );
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      this.messages = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // createdAt をタイムスタンプフィールドとして統一
          timestamp: data['createdAt'] || data['timestamp'] || new Date(),
        } as ChatMessage;
      });
      this.loading = false;
    });

    this.destroy$.subscribe(() => unsubscribe());
  }

  async sendMessage() {
    if (!this.newMessage.trim() || !this.projectId || !this.currentUserId) {
      return;
    }

    try {
      // メンションを解析
      const mentions = this.extractMentions(this.newMessage);

      const messagesRef = collection(
        this.firestore,
        `projects/${this.projectId}/messages`
      );

      await addDoc(messagesRef, {
        content: this.newMessage,
        sender: this.currentUserName,
        senderId: this.currentUserId,
        mentions,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      this.newMessage = '';
      this.showMentionCandidates = false;
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
    }
  }

  private extractMentions(text: string): string[] {
    const mentionRegex = /@([^\s@]+)/g;
    const mentions: string[] = [];
    const seenIds = new Set<string>(); // 重複を避ける
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionName = match[1];
      const member = this.projectMembers.find((m) => {
        const displayName = m.displayName || m.name || '';
        return displayName === mentionName || m.email === mentionName;
      });
      if (member && member.id && !seenIds.has(member.id)) {
        mentions.push(member.id);
        seenIds.add(member.id);
      }
    }

    return mentions;
  }

  onMessageInputChange(event: Event) {
    const input = event.target as HTMLTextAreaElement;
    this.newMessage = input.value;
    this.mentionCursorPosition = input.selectionStart || 0;

    // @の入力を検出
    const lastAtIndex = this.newMessage.lastIndexOf('@', this.mentionCursorPosition);
    if (lastAtIndex > -1) {
      const afterAt = this.newMessage.substring(
        lastAtIndex + 1,
        this.mentionCursorPosition
      );
      // スペースが含まれていない場合のみ検索
      if (!afterAt.includes(' ')) {
        this.mentionSearchTerm = afterAt.toLowerCase();
        this.updateMentionCandidates();
        this.showMentionCandidates = true;
        this.selectedMentionCandidate = -1;
      } else {
        this.showMentionCandidates = false;
      }
    } else {
      this.showMentionCandidates = false;
    }
  }

  private updateMentionCandidates() {
    const getDisplayName = (member: Member): string => {
      return member.displayName || member.name || member.email || '';
    };

    if (this.mentionSearchTerm.length === 0) {
      this.mentionCandidates = this.projectMembers.map((member) => ({
        uid: member.id || '',
        displayName: getDisplayName(member),
        photoURL: member.photoURL,
      }));
    } else {
      this.mentionCandidates = this.projectMembers
        .filter(
          (member) =>
            getDisplayName(member)
              .toLowerCase()
              .includes(this.mentionSearchTerm) ||
            (member.email || '').toLowerCase().includes(this.mentionSearchTerm)
        )
        .map((member) => ({
          uid: member.id || '',
          displayName: getDisplayName(member),
          photoURL: member.photoURL,
        }));
    }
  }

  selectMentionCandidate(candidate: MentionCandidate) {
    const lastAtIndex = this.newMessage.lastIndexOf('@', this.mentionCursorPosition);
    if (lastAtIndex === -1) return;

    const beforeAt = this.newMessage.substring(0, lastAtIndex);
    const afterCursor = this.newMessage.substring(this.mentionCursorPosition);

    // @displayName にスペースを付与し、メンション挿入
    this.newMessage = `${beforeAt}@${candidate.displayName} ${afterCursor}`;
    this.showMentionCandidates = false;
    this.mentionSearchTerm = '';
    this.selectedMentionCandidate = -1;

    // フォーカスを戻す
    setTimeout(() => {
      if (this.messageInput) {
        this.messageInput.nativeElement.focus();
        const newPosition = beforeAt.length + candidate.displayName.length + 2; // @ + name + space
        this.messageInput.nativeElement.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  }

  onMentionKeyDown(event: KeyboardEvent) {
    if (!this.showMentionCandidates || this.mentionCandidates.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedMentionCandidate = Math.min(
          this.selectedMentionCandidate + 1,
          this.mentionCandidates.length - 1
        );
        this.scrollMentionCandidateIntoView();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedMentionCandidate = Math.max(
          this.selectedMentionCandidate - 1,
          -1
        );
        this.scrollMentionCandidateIntoView();
        break;
      case 'Enter':
        event.preventDefault();
        if (this.selectedMentionCandidate >= 0) {
          this.selectMentionCandidate(
            this.mentionCandidates[this.selectedMentionCandidate]
          );
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.showMentionCandidates = false;
        break;
    }
  }

  private scrollMentionCandidateIntoView() {
    setTimeout(() => {
      const selectedElement = document.querySelector(
        '.mention-candidate-item.selected'
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }, 0);
  }

  // メンション部分を青文字で表示するために使用
  getDisplayMessage(message: ChatMessage): { text: string; mentions: string[] } {
    const mentions = message.mentions || [];
    return {
      text: message.content || '',
      mentions,
    };
  }

  getMemberNameById(uid: string): string {
    const member = this.projectMembers.find((m) => m.id === uid);
    return member
      ? (member.displayName || member.name || member.email || uid)
      : uid;
  }

  formatTime(timestamp: any): string {
    if (!timestamp) return '';
    const date =
      timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  highlightMentions(text: string, mentions: string[]): SafeHtml {
    let highlightedText = text;
    const mentionRegex = /@([^\s@]+)/g;
    
    highlightedText = highlightedText.replace(mentionRegex, (match, name) => {
      const member = this.projectMembers.find((m) => {
        const displayName = m.displayName || m.name || '';
        return displayName === name || m.email === name;
      });
      if (member && member.id && mentions.includes(member.id)) {
        return `<span class="mention">${match}</span>`;
      }
      return match;
    });

    return this.sanitizer.bypassSecurityTrustHtml(highlightedText);
  }
}
