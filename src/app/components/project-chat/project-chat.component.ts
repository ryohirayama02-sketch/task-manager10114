import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  orderBy,
  query,
  limit,
  where,
  DocumentSnapshot,
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { ChatMessage } from '../../models/task.model';
import { AuthService } from '../../services/auth.service';

// Firestore Timestamp型の定義
interface FirestoreTimestamp {
  toDate(): Date;
  seconds: number;
  nanoseconds: number;
}

@Component({
  selector: 'app-project-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatInputModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
  ],
  templateUrl: './project-chat.component.html',
  styleUrls: ['./project-chat.component.css'],
})
export class ProjectChatComponent implements OnInit, OnDestroy {
  @Input() projectId!: string;
  @ViewChild('chatContainer', { static: false }) chatContainer!: ElementRef;
  @ViewChild('messageInput', { static: false }) messageInput!: ElementRef;

  messages: ChatMessage[] = [];
  newMessage: string = '';
  currentUser: any = null;
  isLoading = false;
  hasMoreMessages = true;
  lastVisibleMessage: DocumentSnapshot | null = null;
  showScrollToBottom = false;
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);

  constructor(private firestore: Firestore, private authService: AuthService) {}

  ngOnInit() {
    // 認証状態を取得
    this.authService.user$.subscribe((user) => {
      this.currentUser = user;
    });

    // メッセージの監視
    this.messagesSubject.subscribe((messages) => {
      this.messages = messages;
    });

    // チャット履歴を読み込み
    this.loadChatMessages();
  }

  ngOnDestroy() {
    this.messagesSubject.complete();
  }

  /** チャットメッセージを読み込み */
  loadChatMessages() {
    if (!this.projectId) return;

    this.isLoading = true;
    const messagesRef = collection(
      this.firestore,
      `projects/${this.projectId}/chat`
    );
    // 初期読み込み時は最新20件に制限
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(20));

    // リアルタイムでメッセージを監視
    collectionData(q, { idField: 'id' })
      .pipe(map((messages) => messages as ChatMessage[]))
      .subscribe({
        next: (messages) => {
          // 古い順に並び替え
          this.messages = messages.reverse();
          this.messagesSubject.next(this.messages);

          // より古いメッセージがあるかチェック
          this.hasMoreMessages = messages.length === 20;

          this.isLoading = false;
          this.scrollToBottom();
        },
        error: (error) => {
          console.error('チャットメッセージの読み込みエラー:', error);
          this.isLoading = false;
        },
      });
  }

  /** メッセージを送信 */
  async sendMessage() {
    if (!this.newMessage.trim() || !this.currentUser || !this.projectId) return;

    const messageContent = this.newMessage.trim();
    this.newMessage = ''; // 即座にUIからメッセージをクリア

    const message: Omit<ChatMessage, 'id'> = {
      content: messageContent,
      sender:
        this.currentUser.displayName ||
        this.currentUser.email ||
        'Unknown User',
      timestamp: new Date(),
    };

    try {
      const messagesRef = collection(
        this.firestore,
        `projects/${this.projectId}/chat`
      );
      await addDoc(messagesRef, message);
      console.log('メッセージ送信成功:', message);
      this.scrollToBottom();
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      alert('メッセージの送信に失敗しました。');
      // エラー時はメッセージを復元
      this.newMessage = messageContent;
    }
  }

  /** より多くのメッセージを読み込み */
  loadMoreMessages() {
    if (!this.hasMoreMessages || this.isLoading) return;

    console.log(
      'loadMoreMessages called. Current messages count:',
      this.messages.length
    );
    this.isLoading = true;

    const messagesRef = collection(
      this.firestore,
      `projects/${this.projectId}/chat`
    );

    // 現在のメッセージの最初のメッセージより古いメッセージを取得
    const oldestMessage = this.messages[0];
    let q;

    if (oldestMessage && oldestMessage.timestamp) {
      // 既存のメッセージより古いメッセージを取得
      let oldestTimestamp;

      // タイムスタンプの形式を確認して適切に変換
      if (typeof oldestMessage.timestamp === 'string') {
        oldestTimestamp = new Date(oldestMessage.timestamp);
      } else if (
        oldestMessage.timestamp &&
        typeof (oldestMessage.timestamp as unknown as FirestoreTimestamp)
          .toDate === 'function'
      ) {
        // Firestore Timestamp オブジェクトの場合
        oldestTimestamp = (
          oldestMessage.timestamp as unknown as FirestoreTimestamp
        ).toDate();
      } else if (
        oldestMessage.timestamp &&
        typeof (oldestMessage.timestamp as any).seconds === 'number'
      ) {
        // Firestore Timestamp の seconds プロパティがある場合
        oldestTimestamp = new Date(
          (oldestMessage.timestamp as any).seconds * 1000
        );
      } else {
        console.error('Invalid timestamp format:', oldestMessage.timestamp);
        this.isLoading = false;
        return;
      }

      // 有効な日付かチェック
      if (isNaN(oldestTimestamp.getTime())) {
        console.error('Invalid timestamp value:', oldestMessage.timestamp);
        this.isLoading = false;
        return;
      }

      console.log('Loading messages older than:', oldestTimestamp);

      q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        where('timestamp', '<', oldestTimestamp),
        limit(10)
      );
    } else {
      // 最初の読み込みの場合（通常は発生しない）
      q = query(messagesRef, orderBy('timestamp', 'desc'), limit(10));
    }

    collectionData(q, { idField: 'id' })
      .pipe(
        map((messages) => messages as ChatMessage[]),
        take(1)
      )
      .subscribe({
        next: (newMessages) => {
          console.log('Loaded more messages:', newMessages.length);
          if (newMessages.length > 0) {
            // 新しいメッセージを古い順に並び替えて、既存のメッセージの前に追加
            const reversedMessages = newMessages.reverse();
            this.messages = [...reversedMessages, ...this.messages];
            this.messagesSubject.next(this.messages);

            // より古いメッセージがあるかチェック
            this.hasMoreMessages = newMessages.length === 10;
            console.log('Has more messages:', this.hasMoreMessages);
          } else {
            this.hasMoreMessages = false;
            console.log('No more messages to load');
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('追加メッセージの読み込みエラー:', error);
          console.error('Error details:', error);
          this.isLoading = false;
        },
      });
  }

  /** チャットを最下部にスクロール */
  scrollToBottom() {
    setTimeout(() => {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop =
          this.chatContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  /** スクロール位置を監視 */
  onScroll(event: Event) {
    const element = event.target as HTMLElement;
    const isAtBottom =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 10;
    this.showScrollToBottom = !isAtBottom && this.messages.length > 3;
  }

  /** メッセージの時刻をフォーマット */
  formatTimestamp(timestamp: Date | string | any): string {
    let date: Date;

    // タイムスタンプの形式を確認して適切に変換
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (
      timestamp &&
      typeof (timestamp as unknown as FirestoreTimestamp).toDate === 'function'
    ) {
      // Firestore Timestamp オブジェクトの場合
      date = (timestamp as unknown as FirestoreTimestamp).toDate();
    } else if (timestamp && typeof (timestamp as any).seconds === 'number') {
      // Firestore Timestamp の seconds プロパティがある場合
      date = new Date((timestamp as any).seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      console.error('Invalid timestamp format in formatTimestamp:', timestamp);
      return 'Invalid time';
    }

    // 有効な日付かチェック
    if (isNaN(date.getTime())) {
      console.error('Invalid timestamp value in formatTimestamp:', timestamp);
      return 'Invalid time';
    }

    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else {
      return date.toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric',
      });
    }
  }

  /** Enterキーでメッセージ送信 */
  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  /** 自分のメッセージかどうかを判定 */
  isOwnMessage(message: ChatMessage): boolean {
    if (!this.currentUser) return false;
    const currentUserName =
      this.currentUser.displayName || this.currentUser.email || 'Unknown User';
    return message.sender === currentUserName;
  }

  /** メッセージのトラッキング用 */
  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id || index.toString();
  }
}
