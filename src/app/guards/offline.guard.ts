import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OfflineService } from '../services/offline.service';

@Injectable({
  providedIn: 'root',
})
export class OfflineGuard implements CanActivate {
  constructor(
    private offlineService: OfflineService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  canActivate(): boolean {
    if (!this.offlineService.isOnline) {
      this.snackBar.open(
        'オフライン時はこの機能を利用できません。オンライン復帰後に再度お試しください。',
        '閉じる',
        {
          duration: 5000,
          panelClass: ['warning-snackbar'],
        }
      );
      // カンバン画面にリダイレクト
      this.router.navigate(['/kanban']);
      return false;
    }
    return true;
  }
}
