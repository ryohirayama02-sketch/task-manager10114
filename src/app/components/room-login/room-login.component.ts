import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RoomService } from '../../services/room.service';
import { HomeScreenSettingsService } from '../../services/home-screen-settings.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-room-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="room-login">
      <form (ngSubmit)="enterRoom()" #roomForm="ngForm">
        <label>
          {{ 'roomLogin.roomId' | translate }}
          <input
            type="text"
            name="roomId"
            required
            [(ngModel)]="roomId"
            maxlength="20"
          />
        </label>
        <label>
          {{ 'roomLogin.password' | translate }}
          <input
            type="password"
            name="password"
            required
            [(ngModel)]="password"
            maxlength="20"
          />
        </label>
        <button type="submit" [disabled]="roomForm.invalid || isLoading">
          {{ 'roomLogin.enter' | translate }}
        </button>
      </form>
      <p *ngIf="error" class="error">{{ error }}</p>
      <button type="button" (click)="showCreateRoom = !showCreateRoom">
        {{ 'roomLogin.createRoom' | translate }}
      </button>
      <form
        *ngIf="showCreateRoom"
        (ngSubmit)="createRoom()"
        #createRoomForm="ngForm"
      >
        <label>
          {{ 'roomLogin.roomId' | translate }}
          <input
            type="text"
            name="newRoomId"
            required
            [(ngModel)]="newRoomId"
            (input)="checkRoomIdExists()"
            [class.error]="roomIdExistsError"
            maxlength="20"
            [placeholder]="'roomLogin.maxLength' | translate"
          />
          <span *ngIf="roomIdExistsError" class="error-message">
            {{ roomIdExistsError }}
          </span>
          <span class="hint-text">{{ 'roomLogin.maxLength' | translate }}</span>
        </label>
        <label>
          {{ 'roomLogin.displayName' | translate }}
          <input
            type="text"
            name="newRoomName"
            required
            [(ngModel)]="newRoomName"
            maxlength="20"
            [placeholder]="'roomLogin.maxLength' | translate"
          />
          <span class="hint-text">{{ 'roomLogin.maxLength' | translate }}</span>
        </label>
        <label>
          {{ 'roomLogin.password' | translate }}
          <input
            type="password"
            name="newRoomPassword"
            required
            [(ngModel)]="newRoomPassword"
            maxlength="20"
            [placeholder]="'roomLogin.maxLength' | translate"
          />
          <span class="hint-text">{{ 'roomLogin.maxLength' | translate }}</span>
        </label>
        <button
          type="submit"
          [disabled]="
            createRoomForm.invalid ||
            isCreating ||
            !!roomIdExistsError ||
            isCheckingRoomId
          "
        >
          {{ 'roomLogin.create' | translate }}
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
      .hint-text {
        color: #999;
        font-size: 11px;
        margin-top: 2px;
      }
      input::placeholder {
        color: #999;
        opacity: 0.6;
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
    private router: Router,
    private homeScreenSettingsService: HomeScreenSettingsService,
    private languageService: LanguageService
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
        this.error = this.languageService.translate(
          'roomLogin.error.invalidInput'
        );
        return;
      }
      this.authService.setRoomId(this.roomId, roomDoc.id);
      await this.navigateToHomeScreen();
    } catch (err) {
      console.error('Failed to join room', err);
      this.error = this.languageService.translate(
        'roomLogin.error.invalidInput'
      );
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
        this.roomIdExistsError = this.languageService.translate(
          'roomLogin.error.roomIdExists'
        );
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
      this.roomIdExistsError = this.languageService.translate(
        'roomLogin.error.roomIdExists'
      );
      return;
    }

    this.error = null;
    this.isCreating = true;
    try {
      const createdBy = this.authService.getCurrentUser()?.email || 'unknown';
      const docRef = await this.roomService.createRoom(
        this.newRoomName,
        this.newRoomPassword,
        createdBy,
        this.newRoomId.trim()
      );
      this.authService.setRoomId(this.newRoomId.trim(), docRef.id);
      await this.navigateToHomeScreen();
    } catch (err) {
      console.error('Failed to create room', err);
      this.error = this.languageService.translate(
        'roomLogin.error.createFailed'
      );
    } finally {
      this.isCreating = false;
    }
  }

  /**
   * ホーム画面設定に基づいて遷移先を決定して遷移
   */
  private async navigateToHomeScreen(): Promise<void> {
    try {
      const settings = await firstValueFrom(
        this.homeScreenSettingsService.getHomeScreenSettings()
      );
      const homeScreen =
        settings?.homeScreen ||
        this.homeScreenSettingsService.getDefaultHomeScreen();
      await this.router.navigate([`/${homeScreen}`]);
    } catch (error) {
      console.error('ホーム画面設定の取得エラー:', error);
      // エラー時はデフォルトのカンバン画面に遷移
      await this.router.navigate(['/kanban']);
    }
  }
}
