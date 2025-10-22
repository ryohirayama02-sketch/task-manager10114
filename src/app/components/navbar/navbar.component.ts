import { Component } from '@angular/core';
import { RouterLink } from '@angular/router'; // ← ★ これを追加！
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink], // ← ★ RouterLinkを追加！
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent {}
