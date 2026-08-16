export type Priority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  durationMin: number;
  priority: Priority;
  subject?: string;
  deadline?: string; // ISO datetime
  createdAt: string;
}

export interface ScheduleBlock {
  id: string;
  title: string;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  kind: "class" | "work" | "meal" | "sleep" | "other";
}

export interface PlannedBlock {
  id: string;
  taskId: string;
  title: string;
  subject?: string;
  priority: Priority;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  durationMin: number;
}

export interface CompletionRecord {
  id: string;
  taskId: string;
  plannedBlockId: string;
  date: string;      // YYYY-MM-DD
  title: string;
  subject?: string;
  scheduledMin: number;
  completed: boolean;
  completedAt?: string;
}

export interface DayState {
  date: string; // YYYY-MM-DD
  tasks: Task[];
  schedule: ScheduleBlock[];
  plan: PlannedBlock[];
  overflow: string[]; // task ids that didn't fit
  confirmed: boolean;
}
