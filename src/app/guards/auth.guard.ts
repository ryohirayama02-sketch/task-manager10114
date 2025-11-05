import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take, filter, skipWhile } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean> {
    return this.authService.user$.pipe(
      // null 以外の値（ユーザーまたは false 的な確定状態）が来るまで待機
      skipWhile((user) => user === null),
      take(1),
      map((user) => {
        if (user) {
          console.log('✅ 認証確認: ユーザーログイン済み');
          return true;
        } else {
          console.log('❌ 認証確認: ユーザーログインなし。ログイン画面へ');
          this.router.navigate(['/login']);
          return false;
        }
      })
    );
  }
}
