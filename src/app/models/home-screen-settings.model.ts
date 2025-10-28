export interface HomeScreenSettings {
  id?: string;
  userId: string;
  homeScreen: 'kanban' | 'gantt' | 'calendar';
  createdAt?: Date | string | any;
  updatedAt?: Date | string | any;
}

export type HomeScreenType = 'kanban' | 'gantt' | 'calendar';

export const HOME_SCREEN_OPTIONS = [
  { value: 'kanban', label: 'カンバン画面', icon: 'view_kanban' },
  { value: 'gantt', label: 'ガント画面', icon: 'timeline' },
  { value: 'calendar', label: 'カレンダー画面', icon: 'calendar_month' },
] as const;
