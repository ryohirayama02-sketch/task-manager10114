import { Pipe, PipeTransform, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { LanguageService } from '../services/language.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private languageService: LanguageService,
    private cdr: ChangeDetectorRef
  ) {
    // 言語変更を監視して変更検出をトリガー
    this.languageService.language$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cdr.markForCheck();
      });
  }

  transform(key: string | null | undefined): string {
    if (!key) {
      return '';
    }
    return this.languageService.translate(key);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
