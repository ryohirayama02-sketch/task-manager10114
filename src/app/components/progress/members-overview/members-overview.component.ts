import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MemberService, Member } from '../../../services/member.service';

@Component({
  selector: 'app-members-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './members-overview.component.html',
  styleUrls: ['./members-overview.component.css'],
})
export class MembersOverviewComponent implements OnInit {
  members: Member[] = []; // ✅ ここが重要！古い匿名型ではなく Member 型にする

  constructor(private memberService: MemberService) {}

  ngOnInit() {
    this.memberService.getMembers().subscribe((data) => {
      console.log('Firestoreからメンバー取得:', data);
      this.members = data;
    });
  }
}
