import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class NavigationHistoryService {
  private history: string[] = [];
  private readonly CREATE_PAGES = ['/project-form', '/task-create'];

  constructor(private router: Router) {
    // ナビゲーション履歴を追跡
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const url = event.urlAfterRedirects;
        // 同じURLが連続しない場合のみ追加
        if (this.history.length === 0 || this.history[this.history.length - 1] !== url) {
          this.history.push(url);
          // 履歴が長すぎないように制限（最新50件）
          if (this.history.length > 50) {
            this.history.shift();
          }
        }
      });
  }

  /**
   * 直前の画面が作成画面かどうかを確認
   */
  isPreviousPageCreatePage(): boolean {
    if (this.history.length < 2) {
      return false;
    }
    const previousUrl = this.history[this.history.length - 2];
    return this.CREATE_PAGES.some((createPage) => previousUrl.startsWith(createPage));
  }

  /**
   * 作成画面をスキップして戻る必要がある回数を取得
   * @returns 戻る回数（1 = 通常の戻る、2以上 = 作成画面をスキップ）
   */
  getBackCount(): number {
    if (this.history.length < 2) {
      return 1; // 履歴が不足している場合は通常の戻る
    }

    let backCount = 1;
    let index = this.history.length - 2; // 直前の画面のインデックス

    // 直前の画面が作成画面の場合、さらに前の画面を探す
    while (index >= 0) {
      const url = this.history[index];
      if (this.CREATE_PAGES.some((createPage) => url.startsWith(createPage))) {
        // 作成画面なので、さらに前の画面を見る
        backCount++;
        index--;
      } else {
        // 作成画面でない画面が見つかった
        break;
      }
    }

    return backCount;
  }

  /**
   * 作成画面をスキップして戻るURLを取得（デバッグ用）
   */
  getBackUrl(): string | null {
    if (this.history.length < 2) {
      return null;
    }

    // 直前の画面が作成画面の場合、さらに前の画面を返す
    const previousUrl = this.history[this.history.length - 2];
    if (this.CREATE_PAGES.some((createPage) => previousUrl.startsWith(createPage))) {
      // さらに前の画面を探す
      for (let i = this.history.length - 3; i >= 0; i--) {
        const url = this.history[i];
        if (!this.CREATE_PAGES.some((createPage) => url.startsWith(createPage))) {
          return url;
        }
      }
      // 作成画面以外が見つからない場合は、デフォルトの画面に戻る
      return '/kanban';
    }

    // 直前の画面が作成画面でない場合は、直前の画面を返す
    return previousUrl;
  }

  /**
   * 履歴をクリア（ログアウト時など）
   */
  clearHistory(): void {
    this.history = [];
  }
}

