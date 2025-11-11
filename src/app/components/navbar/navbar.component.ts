import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { User } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

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
  memberName$: Observable<string | null>;
  displayName$: Observable<string>;

  constructor(
    private authService: AuthService,
    private languageService: LanguageService
  ) {
    this.user$ = this.authService.user$;
    this.memberName$ = this.authService.currentMemberName$;
    // memberName$ が null の場合は「ユーザー」を表示
    this.displayName$ = this.memberName$.pipe(
      map(name => name || this.languageService.translate('common.user'))
    );
  }

  ngOnInit(): void {
    // memberName$ の購読は template側で async pipe を使用
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
