import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-progress-circle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="progress-circle-container">
      <svg class="progress-circle" [attr.width]="safeSize" [attr.height]="safeSize">
        <!-- 背景円 -->
        <circle
          cx="50%"
          cy="50%"
          [attr.r]="radius"
          fill="none"
          stroke="#e0e0e0"
          [attr.stroke-width]="safeStrokeWidth"
        />
        <!-- 進捗円 -->
        <circle
          cx="50%"
          cy="50%"
          [attr.r]="radius"
          fill="none"
          [attr.stroke]="getProgressColor()"
          [attr.stroke-width]="safeStrokeWidth"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="getStrokeDashoffset()"
          stroke-linecap="round"
          [attr.transform]="'rotate(0 ' + safeSize / 2 + ' ' + safeSize / 2 + ')'"
        />
      </svg>
      <div class="progress-text">
        <span class="percentage">{{ safePercentage }}%</span>
        <span class="tasks">{{ safeCompletedTasks }}/{{ safeTotalTasks }}</span>
      </div>
    </div>
  `,
  styles: [
    `
      .progress-circle-container {
        position: relative;
        display: inline-block;
      }

      .progress-circle {
        transform: rotate(-90deg);
      }

      .progress-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        font-size: 12px;
      }

      .percentage {
        display: block;
        font-weight: bold;
        font-size: 14px;
        color: #333;
      }

      .tasks {
        display: block;
        font-size: 10px;
        color: #666;
      }
    `,
  ],
})
export class ProgressCircleComponent {
  @Input() percentage: number = 0;
  @Input() completedTasks: number = 0;
  @Input() totalTasks: number = 0;
  @Input() size: number = 80;
  @Input() strokeWidth: number = 6;

  // ✅ 修正: 無効な値を安全な値に変換するgetter
  get safePercentage(): number {
    const p = typeof this.percentage === 'number' && !isNaN(this.percentage) ? this.percentage : 0;
    return Math.max(0, Math.min(100, p)); // 0-100の範囲に制限
  }

  get safeCompletedTasks(): number {
    const ct = typeof this.completedTasks === 'number' && !isNaN(this.completedTasks) ? this.completedTasks : 0;
    return Math.max(0, ct); // 0以上の値に制限
  }

  get safeTotalTasks(): number {
    const tt = typeof this.totalTasks === 'number' && !isNaN(this.totalTasks) ? this.totalTasks : 0;
    return Math.max(0, tt); // 0以上の値に制限
  }

  get safeSize(): number {
    const s = typeof this.size === 'number' && !isNaN(this.size) && this.size > 0 ? this.size : 80;
    return s;
  }

  get safeStrokeWidth(): number {
    const sw = typeof this.strokeWidth === 'number' && !isNaN(this.strokeWidth) && this.strokeWidth > 0 ? this.strokeWidth : 6;
    return sw;
  }

  get radius(): number {
    return (this.safeSize - this.safeStrokeWidth) / 2;
  }

  get circumference(): number {
    return 2 * Math.PI * this.radius;
  }

  getStrokeDashoffset(): number {
    const progress = this.safePercentage / 100;
    return this.circumference * (1 - progress);
  }

  getProgressColor(): string {
    const p = this.safePercentage;
    if (p >= 80) return '#4caf50'; // 緑
    if (p >= 60) return '#8bc34a'; // 薄緑
    if (p >= 40) return '#ffc107'; // 黄色
    if (p >= 20) return '#ff9800'; // オレンジ
    return '#f44336'; // 赤
  }
}
