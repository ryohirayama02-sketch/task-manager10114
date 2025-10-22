import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MemberService } from '../../../services/member.service';

@Component({
  selector: 'app-member-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './member-progress.component.html',
  styleUrls: ['./member-progress.component.css'],
})
export class MemberProgressComponent implements OnInit {
  member: any; // メンバー情報
  tasks: any[] = []; // タスク一覧

  constructor(
    private route: ActivatedRoute,
    private memberService: MemberService
  ) {}

  ngOnInit() {
    // URLの末尾にある /progress/members/:memberId の部分を取得
    const memberId = this.route.snapshot.paramMap.get('memberId');
    console.log('メンバーID:', memberId);

    if (memberId) {
      // Firestore からメンバー情報を取得
      this.memberService.getMemberById(memberId).subscribe((data) => {
        console.log('選択されたメンバー:', data);
        this.member = data;
      });

      // Firestore からサブコレクション tasks を取得
      this.memberService.getTasksByMemberId(memberId).subscribe((taskList) => {
        console.log('Firestoreからタスク取得:', taskList);
        this.tasks = taskList;
      });
    }
  }
}
