import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ProjectSelectionService {
  private readonly STORAGE_KEY = 'selectedProjectIds';
  private selectedProjectIds$ = new BehaviorSubject<string[]>(
    this.loadFromStorage()
  );

  constructor() {}

  /**
   * 選択されたプロジェクトIDの Observable を取得
   */
  getSelectedProjectIds(): Observable<string[]> {
    return this.selectedProjectIds$.asObservable();
  }

  /**
   * 現在の選択されたプロジェクトIDを同期的に取得
   */
  getSelectedProjectIdsSync(): string[] {
    return this.selectedProjectIds$.getValue();
  }

  /**
   * ストレージに選択状態が保存されているかどうかを確認
   */
  hasStoredSelection(): boolean {
    try {
      return localStorage.getItem(this.STORAGE_KEY) !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * 選択されたプロジェクトIDを設定
   */
  setSelectedProjectIds(projectIds: string[]): void {
    this.selectedProjectIds$.next(projectIds);
    this.saveToStorage(projectIds);
  }

  /**
   * プロジェクトの選択をトグル
   */
  toggleProjectSelection(projectId: string): void {
    const current = this.selectedProjectIds$.getValue();
    const index = current.indexOf(projectId);
    let updated: string[];

    if (index > -1) {
      updated = current.filter((id) => id !== projectId);
    } else {
      updated = [...current, projectId];
    }

    this.setSelectedProjectIds(updated);
  }

  /**
   * 選択をクリア
   */
  clearSelection(): void {
    this.setSelectedProjectIds([]);
  }

  /**
   * ローカルストレージから復元
   */
  private loadFromStorage(): string[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('プロジェクト選択状態の復元に失敗:', error);
      return [];
    }
  }

  /**
   * ローカルストレージに保存
   */
  private saveToStorage(projectIds: string[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projectIds));
    } catch (error) {
      console.error('プロジェクト選択状態の保存に失敗:', error);
    }
  }
}
