import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MemberService, Member } from '../../../services/member.service';
import { LanguageService } from '../../../services/language.service';

@Component({
  selector: 'app-members-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './members-overview.component.html',
  styleUrls: ['./members-overview.component.css'],
})
export class MembersOverviewComponent implements OnInit {
  members: Member[] = [];

  constructor(
    private memberService: MemberService,
    public languageService: LanguageService
  ) {}

  ngOnInit() {
    this.memberService.getMembers().subscribe((data) => {
      console.log('Firestoreからメンバー取得:', data);

      // ✅ 「サイタマ,平山」を「サイタマ」「平山」に分割して登録
      const expandedMembers: Member[] = [];

      data.forEach((member) => {
        if (member.name.includes(',')) {
          const splitNames = member.name
            .split(',')
            .map((n) => n.trim())
            .filter((n) => n.length > 0);
          splitNames.forEach((name) => {
            expandedMembers.push({ ...member, name });
          });
        } else {
          expandedMembers.push(member);
        }
      });

      this.members = expandedMembers;
      console.log('整形後メンバー一覧:', this.members);
    });
  }
}
