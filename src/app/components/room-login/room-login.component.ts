import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RoomService } from '../../services/room.service';

@Component({
  selector: 'app-room-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="room-login">
      <form (ngSubmit)="enterRoom()" #roomForm="ngForm">
        <label>
          Room ID
          <input
            type="text"
            name="roomId"
            required
            [(ngModel)]="roomId"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            required
            [(ngModel)]="password"
          />
        </label>
        <button type="submit" [disabled]="roomForm.invalid || isLoading">
          入室
        </button>
      </form>
      <p *ngIf="error" class="error">{{ error }}</p>
      <button type="button" (click)="showCreateRoom = !showCreateRoom">
        新規ルーム作成
      </button>
      <form
        *ngIf="showCreateRoom"
        (ngSubmit)="createRoom()"
        #createRoomForm="ngForm"
      >
        <label>
          Room ID
          <input
            type="text"
            name="newRoomId"
            required
            [(ngModel)]="newRoomId"
            (input)="checkRoomIdExists()"
            [class.error]="roomIdExistsError"
          />
          <span *ngIf="roomIdExistsError" class="error-message">
            {{ roomIdExistsError }}
          </span>
        </label>
        <label>
          表示名
          <input
            type="text"
            name="newRoomName"
            required
            [(ngModel)]="newRoomName"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="newRoomPassword"
            required
            [(ngModel)]="newRoomPassword"
          />
        </label>
        <button
          type="submit"
          [disabled]="createRoomForm.invalid || isCreating || !!roomIdExistsError || isCheckingRoomId"
        >
          作成
        </button>
      </form>
    </div>
  `,
  styles: [
    `
      .room-login {
        max-width: 320px;
        margin: 40px auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      input {
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      button {
        padding: 8px;
      }
      .error {
        color: #d32f2f;
        text-align: center;
      }
      input.error {
        border-color: #d32f2f;
      }
      .error-message {
        color: #d32f2f;
        font-size: 12px;
        margin-top: 4px;
      }
    `,
  ],
})
export class RoomLoginComponent {
  roomId = localStorage.getItem('roomId') || '';
  password = '';
  error: string | null = null;
  isLoading = false;
  showCreateRoom = false;
  newRoomId = '';
  newRoomName = '';
  newRoomPassword = '';
  isCreating = false;
  roomIdExistsError: string | null = null;
  isCheckingRoomId = false;

  constructor(
    private roomService: RoomService,
    private authService: AuthService,
    private router: Router
  ) {}

  async enterRoom() {
    if (!this.roomId || !this.password) {
      return;
    }
    this.error = null;
    this.showCreateRoom = false;
    this.isLoading = true;
    try {
      const roomDoc = await this.roomService.joinRoom(
        this.roomId,
        this.password
      );
      if (!roomDoc) {
        this.error = 'ルーム情報が正しくありません。';
        return;
      }
      this.authService.setRoomId(this.roomId, roomDoc.id);
      await this.router.navigate(['/projects']);
    } catch (err) {
      console.error('Failed to join room', err);
      this.error = 'ルーム情報が正しくありません。';
    } finally {
      this.isLoading = false;
    }
  }

  async checkRoomIdExists() {
    if (!this.newRoomId || this.newRoomId.trim() === '') {
      this.roomIdExistsError = null;
      return;
    }

    this.isCheckingRoomId = true;
    this.roomIdExistsError = null;

    try {
      const exists = await this.roomService.roomIdExists(this.newRoomId.trim());
      if (exists) {
        this.roomIdExistsError = 'このroomIDはすでに作られています。別のroomIDにしてください。';
      }
    } catch (err) {
      console.error('Failed to check room ID', err);
      // エラーが発生した場合は警告を表示しない（ネットワークエラーなどの可能性）
    } finally {
      this.isCheckingRoomId = false;
    }
  }

  async createRoom() {
    if (!this.newRoomId || !this.newRoomName || !this.newRoomPassword) {
      return;
    }

    // roomIDが既に存在する場合は作成を防ぐ
    if (this.roomIdExistsError) {
      return;
    }

    // 念のため再度チェック
    const exists = await this.roomService.roomIdExists(this.newRoomId.trim());
    if (exists) {
      this.roomIdExistsError = 'このroomIDはすでに作られています。別のroomIDにしてください。';
      return;
    }

    this.error = null;
    this.isCreating = true;
    try {
      const createdBy =
        this.authService.getCurrentUser()?.email || 'unknown';
      const docRef = await this.roomService.createRoom(
        this.newRoomName,
        this.newRoomPassword,
        createdBy,
        this.newRoomId.trim()
      );
      this.authService.setRoomId(this.newRoomId.trim(), docRef.id);
      await this.router.navigate(['/projects']);
    } catch (err) {
      console.error('Failed to create room', err);
      this.error = 'ルームを作成できませんでした。';
    } finally {
      this.isCreating = false;
    }
  }
}
