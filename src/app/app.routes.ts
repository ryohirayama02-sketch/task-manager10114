import { Routes } from '@angular/router';
import { KanbanComponent } from './components/kanban/kanban.component';

export const routes: Routes = [
  { path: '', redirectTo: 'kanban', pathMatch: 'full' },
  { path: 'kanban', component: KanbanComponent },
];
