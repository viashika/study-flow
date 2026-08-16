import type { CompletionRecord, DayState, ScheduleBlock, Task } from "./types";

const DAY_KEY = (d: string) => `studyflow:day:${d}`;
const DEFAULT_SCHEDULE_KEY = "studyflow:default-schedule";
const COMPLETIONS_KEY = "studyflow:completions";

export const todayISO = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const safe = <T,>(fn: () => T, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try { return fn(); } catch { return fallback; }
};

export function loadDay(date: string): DayState {
  return safe(() => {
    const raw = localStorage.getItem(DAY_KEY(date));
    if (raw) return JSON.parse(raw) as DayState;
    return {
      date,
      tasks: [],
      schedule: loadDefaultSchedule(),
      plan: [],
      overflow: [],
      confirmed: false,
    };
  }, {
    date,
    tasks: [],
    schedule: [],
    plan: [],
    overflow: [],
    confirmed: false,
  });
}

export function saveDay(day: DayState): void {
  safe(() => localStorage.setItem(DAY_KEY(day.date), JSON.stringify(day)), undefined);
}

export function loadDefaultSchedule(): ScheduleBlock[] {
  return safe(() => {
    const raw = localStorage.getItem(DEFAULT_SCHEDULE_KEY);
    if (raw) return JSON.parse(raw) as ScheduleBlock[];
    return SEED_SCHEDULE;
  }, SEED_SCHEDULE);
}

export function saveDefaultSchedule(blocks: ScheduleBlock[]): void {
  safe(() => localStorage.setItem(DEFAULT_SCHEDULE_KEY, JSON.stringify(blocks)), undefined);
}

export function loadCompletions(): CompletionRecord[] {
  return safe(() => {
    const raw = localStorage.getItem(COMPLETIONS_KEY);
    return raw ? (JSON.parse(raw) as CompletionRecord[]) : [];
  }, []);
}

export function saveCompletions(records: CompletionRecord[]): void {
  safe(() => localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(records)), undefined);
}

export function upsertCompletion(rec: CompletionRecord): CompletionRecord[] {
  const all = loadCompletions();
  const idx = all.findIndex((r) => r.id === rec.id);
  if (idx >= 0) all[idx] = rec;
  else all.push(rec);
  saveCompletions(all);
  return all;
}

export function pruneCompletionsForDay(date: string, keepIds: Set<string>): CompletionRecord[] {
  const all = loadCompletions().filter((r) => r.date !== date || keepIds.has(r.id));
  saveCompletions(all);
  return all;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const newTask = (partial: Partial<Task>): Task => ({
  id: uid(),
  title: partial.title ?? "Untitled task",
  durationMin: partial.durationMin ?? 60,
  priority: partial.priority ?? "medium",
  subject: partial.subject,
  deadline: partial.deadline,
  createdAt: new Date().toISOString(),
});

export const newBlock = (partial: Partial<ScheduleBlock>): ScheduleBlock => ({
  id: uid(),
  title: partial.title ?? "Busy",
  start: partial.start ?? "09:00",
  end: partial.end ?? "10:00",
  kind: partial.kind ?? "other",
});

const SEED_SCHEDULE: ScheduleBlock[] = [
  { id: "seed-sleep-am", title: "Sleep", start: "00:00", end: "07:00", kind: "sleep" },
  { id: "seed-breakfast", title: "Breakfast", start: "07:30", end: "08:00", kind: "meal" },
  { id: "seed-lunch", title: "Lunch", start: "12:30", end: "13:15", kind: "meal" },
  { id: "seed-dinner", title: "Dinner", start: "19:00", end: "19:45", kind: "meal" },
  { id: "seed-sleep-pm", title: "Sleep", start: "23:30", end: "23:59", kind: "sleep" },
];
