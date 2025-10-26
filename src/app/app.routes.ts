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
import { LoginComponent } from './components/auth/login/login.component';
import { ProjectFormComponent } from './components/project-form/project-form.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: 'kanban', pathMatch: 'full' },
  { path: 'kanban', component: KanbanComponent, canActivate: [AuthGuard] },
  { path: 'gantt', component: GanttComponent, canActivate: [AuthGuard] },
  { path: 'calendar', component: CalendarComponent, canActivate: [AuthGuard] },
  {
    path: 'progress/projects',
    component: ProjectsOverviewComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'progress/projects/:projectId',
    component: ProjectProgressComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'progress/members',
    component: MemberProgressComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'progress/members/:memberName',
    component: MemberDetailComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'project/:projectId',
    component: ProjectDetailComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'project/:projectId/task/:taskId',
    component: TaskDetailComponent,
    canActivate: [AuthGuard],
  },
  { path: 'quick', component: QuickTasksComponent, canActivate: [AuthGuard] },
  { path: 'search', component: TaskSearchComponent, canActivate: [AuthGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard] },
  { path: 'logs', component: LogsComponent, canActivate: [AuthGuard] },
  {
    path: 'project-form',
    component: ProjectFormComponent,
    canActivate: [AuthGuard],
  },
];
