import { Injectable } from '@angular/core';
import {
  CanActivate,
  Router,
  UrlTree,
} from '@angular/router';
import { Observable, map, of, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class RoomGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.authService.currentRoomId$.pipe(
      take(1),
      map((roomId) =>
        roomId ? true : this.router.createUrlTree(['/room-login'])
      )
    );
  }
}
