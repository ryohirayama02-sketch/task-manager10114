import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  Renderer2,
  SimpleChanges,
} from '@angular/core';

@Directive({
  selector: '[appTruncateOverflow]',
  standalone: true,
})
export class TruncateOverflowDirective
  implements AfterViewInit, OnChanges
{
  @Input('appTruncateOverflow') text: string | null | undefined;
  @Input() truncateEllipsis = '...';

  private viewInitialized = false;
  private truncateScheduled = false;

  constructor(private el: ElementRef<HTMLElement>, private renderer: Renderer2) {}

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.scheduleTruncation();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewInitialized) {
      return;
    }
    if (changes['text']) {
      this.scheduleTruncation();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleTruncation();
  }

  private scheduleTruncation(): void {
    if (!this.viewInitialized) {
      return;
    }
    if (this.truncateScheduled) {
      return;
    }
    this.truncateScheduled = true;

    const callback = () => {
      this.truncateScheduled = false;
      this.applyTruncation();
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(callback);
    } else {
      setTimeout(callback, 0);
    }
  }

  private applyTruncation(): void {
    const fullText = this.text ?? '';
    const ellipsisText = this.truncateEllipsis ?? '...';

    this.setText(fullText);
    this.toggleTitleAttribute(false, fullText);

    if (!fullText) {
      return;
    }

    if (!this.isOverflowing()) {
      return;
    }

    let bestFit = '';
    let low = 0;
    let high = fullText.length;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate =
        fullText.slice(0, mid).replace(/\s+$/, '') + ellipsisText;

      this.setText(candidate);

      if (this.isOverflowing()) {
        high = mid - 1;
      } else {
        bestFit = candidate;
        low = mid + 1;
      }
    }

    const finalText = bestFit || ellipsisText;
    this.setText(finalText);
    this.toggleTitleAttribute(finalText !== fullText, fullText);
  }

  private setText(value: string): void {
    this.renderer.setProperty(this.el.nativeElement, 'textContent', value);
  }

  private toggleTitleAttribute(enable: boolean, value: string): void {
    if (enable) {
      this.renderer.setAttribute(this.el.nativeElement, 'title', value);
    } else {
      this.renderer.removeAttribute(this.el.nativeElement, 'title');
    }
  }

  private isOverflowing(): boolean {
    const element = this.el.nativeElement;
    return element.scrollWidth - element.clientWidth > 1;
  }
}
