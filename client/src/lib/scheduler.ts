import type { PlannedBlock, ScheduleBlock, Task } from "./types";

/** minutes since 00:00 */
export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const toHHMM = (min: number): string => {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

/** Merge and sort busy intervals, coalescing overlaps. */
export function mergeBusy(blocks: ScheduleBlock[]): Array<[number, number]> {
  const spans = blocks
    .map((b) => [toMin(b.start), toMin(b.end)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const [s, e] of spans) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

/** Free intervals within [dayStart, dayEnd]. */
export function freeSlots(
  busy: Array<[number, number]>,
  dayStart = 6 * 60,
  dayEnd = 23 * 60,
): Array<[number, number]> {
  const slots: Array<[number, number]> = [];
  let cursor = dayStart;
  for (const [s, e] of busy) {
    if (e <= dayStart || s >= dayEnd) continue;
    const cs = Math.max(s, dayStart);
    const ce = Math.min(e, dayEnd);
    if (cs > cursor) slots.push([cursor, cs]);
    cursor = Math.max(cursor, ce);
  }
  if (cursor < dayEnd) slots.push([cursor, dayEnd]);
  return slots.filter(([s, e]) => e - s >= 5);
}

const priorityWeight = { high: 0, medium: 1, low: 2 } as const;

interface ScheduleInput {
  tasks: Task[];
  schedule: ScheduleBlock[];
  date: string; // YYYY-MM-DD
  dayStart?: number;
  dayEnd?: number;
}

export interface ScheduleResult {
  plan: PlannedBlock[];
  overflow: string[];
}

/**
 * Pure scheduling engine. Sorts tasks by (deadline, priority), then packs
 * them into free slots — splitting a task across adjacent slots when needed.
 * Overflow ids are returned for tasks that didn't fully fit.
 */
export function schedule({
  tasks,
  schedule,
  date,
  dayStart = 6 * 60,
  dayEnd = 23 * 60,
}: ScheduleInput): ScheduleResult {
  const busy = mergeBusy(schedule);
  const slots = freeSlots(busy, dayStart, dayEnd);

  const dayTs = new Date(date + "T23:59:59").getTime();
  const ordered = [...tasks].sort((a, b) => {
    const da = a.deadline ? new Date(a.deadline).getTime() : dayTs + 1;
    const db = b.deadline ? new Date(b.deadline).getTime() : dayTs + 1;
    if (da !== db) return da - db;
    return priorityWeight[a.priority] - priorityWeight[b.priority];
  });

  // Working copy of slots as mutable free minutes
  const freeQueue = slots.map(([s, e]) => ({ start: s, end: e }));
  const plan: PlannedBlock[] = [];
  const overflow: string[] = [];
  let counter = 0;

  for (const task of ordered) {
    let remaining = Math.max(5, task.durationMin);
    const placed: Array<{ start: number; end: number }> = [];

    for (const slot of freeQueue) {
      if (remaining <= 0) break;
      const capacity = slot.end - slot.start;
      if (capacity < 5) continue;
      const take = Math.min(capacity, remaining);
      placed.push({ start: slot.start, end: slot.start + take });
      slot.start += take;
      remaining -= take;
    }

    if (remaining > 0) {
      overflow.push(task.id);
    }

    for (const p of placed) {
      plan.push({
        id: `${task.id}-${counter++}`,
        taskId: task.id,
        title: task.title,
        subject: task.subject,
        priority: task.priority,
        start: toHHMM(p.start),
        end: toHHMM(p.end),
        durationMin: p.end - p.start,
      });
    }
  }

  plan.sort((a, b) => toMin(a.start) - toMin(b.start));
  return { plan, overflow };
}
