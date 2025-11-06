import { Routes } from '@angular/router';
import { KanbanComponent } from './components/kanban/kanban.component';
import { GanttComponent } from './components/gantt/gantt.component';
import { CalendarComponent } from './components/calendar/calendar.component';
import { ProjectsOverviewComponent } from './components/progress/projects-overview/projects-overview.component';
import { ProjectProgressComponent } from './components/progress/project-progress/project-progress.component';
import { MembersOverviewComponent } from './components/progress/members-overview/members-overview.component';
import { MemberProgressComponent } from './components/progress/member-progress/member-progress.component';
import { MemberDetailComponent } from './components/progress/member-detail/member-detail.component';
import { ProjectDetailComponent } from './components/project-detail/project-detail.component';
import { TaskDetailComponent } from './components/task-detail/task-detail.component';
import { QuickTasksComponent } from './components/quick-tasks/quick-tasks.component';
import { TaskSearchComponent } from './components/task-search/task-search.component';
import { SettingsComponent } from './components/settings/settings.component';
import { LogsComponent } from './components/logs/logs.component';
import { MemberManagementComponent } from './components/member-management/member-management.component';
import { MemberFormPageComponent } from './components/member-management/member-form-page/member-form-page.component';

// ✅ ここを修正（auth → login）
import { LoginComponent } from './components/login/login.component';
import { RoomLoginComponent } from './components/room-login/room-login.component';

import { ProjectFormComponent } from './components/project-form/project-form.component';
import { OfflineTestComponent } from './components/offline-test/offline-test.component';
import { TaskCreatePageComponent } from './components/task-create/task-create.component';
import { AuthGuard } from './guards/auth.guard';
import { RoomGuard } from './guards/room.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'room-login', component: RoomLoginComponent, canActivate: [AuthGuard] },
  { path: '', redirectTo: 'kanban', pathMatch: 'full' },
  { path: 'kanban', component: KanbanComponent, canActivate: [AuthGuard, RoomGuard] },
  { path: 'gantt', component: GanttComponent, canActivate: [AuthGuard, RoomGuard] },
  { path: 'calendar', component: CalendarComponent, canActivate: [AuthGuard, RoomGuard] },
  {
    path: 'projects',
    component: ProjectsOverviewComponent,
    canActivate: [AuthGuard, RoomGuard],
  },
  {
    path: 'progress/projects',
    component: ProjectsOverviewComponent,
    canActivate: [AuthGuard, RoomGuard],
  },
  {
    path: 'progress/projects/:projectId',
    component: ProjectProgressComponent,
    canActivate: [AuthGuard, RoomGuard],
  },
  {
    path: 'progress/members',
    component: MemberProgressComponent,
    canActivate: [AuthGuard, RoomGuard],
  },
  {
    path: 'progress/members/:memberName',
    component: MemberDetailComponent,
    canActivate: [AuthGuard, RoomGuard],
  },
  {
    path: 'project/:projectId',
    component: ProjectDetailComponent,
    canActivate: [AuthGuard, RoomGuard],
  },
  {
    path: 'project/:projectId/task/:taskId',
    component: TaskDetailComponent,
    canActivate: [AuthGuard, RoomGuard],
  },
  {
    path: 'task-create',
    component: TaskCreatePageComponent,
    canActivate: [AuthGuard, RoomGuard],
  },
  { path: 'quick', component: QuickTasksComponent, canActivate: [AuthGuard, RoomGuard] },
  { path: 'search', component: TaskSearchComponent, canActivate: [AuthGuard, RoomGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard, RoomGuard] },
  { path: 'logs', component: LogsComponent, canActivate: [AuthGuard, RoomGuard] },
  {
    path: 'members/add',
    component: MemberFormPageComponent,
    canActivate: [AuthGuard, RoomGuard],
  },
  {
    path: 'members',
    component: MemberManagementComponent,
    canActivate: [AuthGuard, RoomGuard],
  },
  {
    path: 'project-form',
    component: ProjectFormComponent,
    canActivate: [AuthGuard, RoomGuard],
  },
  {
    path: 'offline-test',
    component: OfflineTestComponent,
    canActivate: [AuthGuard, RoomGuard],
  },
];
