import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { User } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { TranslatePipe } from '../../pipes/translate.pipe';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';
import { filter, take } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    TranslatePipe,
  ],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit {
  user$: Observable<User | null>;
  navbarUserName: string = '';

  constructor(private authService: AuthService, private firestore: Firestore) {
    this.user$ = this.authService.user$;
  }

  ngOnInit(): void {
    // user$ を購読し、email が得られた時点で loadUserInfo を実行
    this.authService.user$
      .pipe(
        filter((user): user is User => user !== null && user.email !== null),
        take(1)
      )
      .subscribe((user) => {
        this.loadUserInfo();
      });
  }

  /** Firestoreメンバー情報を読み込み */
  private async loadUserInfo(): Promise<void> {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser?.email) {
        console.warn('⚠️ ユーザーまたはメールアドレスが見つかりません');
        this.navbarUserName = currentUser?.displayName || 'ユーザー';
        return;
      }

      // メールアドレスで members コレクションを照合
      this.navbarUserName = await this.resolveNavbarNameByEmail(
        currentUser.email
      );
    } catch (error) {
      console.error('❌ ユーザー情報の読み込みエラー:', error);
      const currentUser = this.authService.getCurrentUser();
      this.navbarUserName =
        currentUser?.displayName || currentUser?.email || 'ユーザー';
    }
  }

  /** Firestoreの members コレクションからメール照合で名前を取得 */
  private async resolveNavbarNameByEmail(email: string): Promise<string> {
    try {
      const col = collection(this.firestore, 'members');
      const q = query(col, where('email', '==', email));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const doc = snap.docs[0].data() as { name?: string };
        if (doc?.name) {
          console.log('✅ メンバー名を取得 (members.name):', doc.name);
          return doc.name;
        }
      }

      // members に一致なし、または name がない場合はフォールバック
      const currentUser = this.authService.getCurrentUser();
      const fallbackName =
        currentUser?.displayName || currentUser?.email || 'ユーザー';
      console.log('⚠️ members.name なし。フォールバック:', fallbackName);
      return fallbackName;
    } catch (error) {
      console.error('❌ resolveNavbarNameByEmail エラー:', error);
      const currentUser = this.authService.getCurrentUser();
      return currentUser?.displayName || currentUser?.email || 'ユーザー';
    }
  }

  /** ログアウト */
  async logout() {
    try {
      await this.authService.signOut();
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  }
}
