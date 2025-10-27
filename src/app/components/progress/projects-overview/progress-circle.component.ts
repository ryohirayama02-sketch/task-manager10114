import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-progress-circle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="progress-circle-container">
      <svg class="progress-circle" [attr.width]="size" [attr.height]="size">
        <!-- 背景円 -->
        <circle
          cx="50%"
          cy="50%"
          [attr.r]="radius"
          fill="none"
          stroke="#e0e0e0"
          [attr.stroke-width]="strokeWidth"
        />
        <!-- 進捗円 -->
        <circle
          cx="50%"
          cy="50%"
          [attr.r]="radius"
          fill="none"
          [attr.stroke]="getProgressColor()"
          [attr.stroke-width]="strokeWidth"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="getStrokeDashoffset()"
          stroke-linecap="round"
          [attr.transform]="'rotate(0 ' + size / 2 + ' ' + size / 2 + ')'"
        />
      </svg>
      <div class="progress-text">
        <span class="percentage">{{ percentage }}%</span>
        <span class="tasks">{{ completedTasks }}/{{ totalTasks }}</span>
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

  get radius(): number {
    return (this.size - this.strokeWidth) / 2;
  }

  get circumference(): number {
    return 2 * Math.PI * this.radius;
  }

  getStrokeDashoffset(): number {
    const progress = this.percentage / 100;
    return this.circumference * (1 - progress);
  }

  getProgressColor(): string {
    if (this.percentage >= 80) return '#4caf50'; // 緑
    if (this.percentage >= 60) return '#8bc34a'; // 薄緑
    if (this.percentage >= 40) return '#ffc107'; // 黄色
    if (this.percentage >= 20) return '#ff9800'; // オレンジ
    return '#f44336'; // 赤
  }
}
