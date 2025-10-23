import { Routes } from '@angular/router';
import { KanbanComponent } from './components/kanban/kanban.component';
import { GanttComponent } from './components/gantt/gantt.component';
import { CalendarComponent } from './components/calendar/calendar.component';
import { ProjectsOverviewComponent } from './components/progress/projects-overview/projects-overview.component';
import { ProjectProgressComponent } from './components/progress/project-progress/project-progress.component';
import { MembersOverviewComponent } from './components/progress/members-overview/members-overview.component';
import { MemberProgressComponent } from './components/progress/member-progress/member-progress.component';
import { ProjectDetailComponent } from './components/project-detail/project-detail.component';
import { TaskDetailComponent } from './components/task-detail/task-detail.component';
import { QuickTasksComponent } from './components/quick-tasks/quick-tasks.component';
import { TaskSearchComponent } from './components/task-search/task-search.component';
import { SettingsComponent } from './components/settings/settings.component';
import { LogsComponent } from './components/logs/logs.component';
import { LoginComponent } from './components/login/login.component';
import { ProjectFormComponent } from './components/project-form/project-form.component';

export const routes: Routes = [
  { path: '', redirectTo: 'kanban', pathMatch: 'full' },
  { path: 'kanban', component: KanbanComponent },
  { path: 'gantt', component: GanttComponent },
  { path: 'calendar', component: CalendarComponent },
  { path: 'progress/projects', component: ProjectsOverviewComponent },
  { path: 'progress/projects/:projectId', component: ProjectProgressComponent },
  { path: 'progress/members', component: MembersOverviewComponent },
  { path: 'progress/members/:memberId', component: MemberProgressComponent },
  { path: 'project/:projectId', component: ProjectDetailComponent },
  { path: 'task/:taskId', component: TaskDetailComponent },
  { path: 'quick', component: QuickTasksComponent },
  { path: 'search', component: TaskSearchComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'logs', component: LogsComponent },
  { path: 'login', component: LoginComponent },
  { path: 'project-form', component: ProjectFormComponent },
];
