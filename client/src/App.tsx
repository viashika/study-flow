import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { toast } from "sonner";
import {
  BarChart3,
  CalendarClock,
  CheckSquare,
  Download,
  ListTodo,
  Sparkles,
  Trash2,
  Plus,
  AlertTriangle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Checkbox } from "./components/ui/checkbox";
import { Badge } from "./components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Separator } from "./components/ui/separator";
import { ThemeToggle } from "./theme-toggle";

import type {
  CompletionRecord,
  DayState,
  PlannedBlock,
  Priority,
  ScheduleBlock,
  Task,
} from "./lib/types";
import { schedule, toMin } from "./lib/scheduler";
import {
  loadCompletions,
  loadDay,
  newBlock,
  newTask,
  pruneCompletionsForDay,
  saveDay,
  saveDefaultSchedule,
  todayISO,
  upsertCompletion,
} from "./lib/storage";
import { downloadICS } from "./lib/ics";


const App = () => {
  const [date, setDate] = useState<string>(todayISO());
  const [day, setDay] = useState<DayState>(() => ({
    date,
    tasks: [],
    schedule: [],
    plan: [],
    overflow: [],
    confirmed: false,
  }));
  const [hydrated, setHydrated] = useState(false);
  const [completions, setCompletions] = useState<CompletionRecord[]>([]);
  const [tab, setTab] = useState("tasks");

  // Hydrate from localStorage on mount / date change
  useEffect(() => {
    setDay(loadDay(date));
    setCompletions(loadCompletions());
    setHydrated(true);
  }, [date]);

  useEffect(() => {
    if (hydrated) saveDay(day);
  }, [day, hydrated]);

  const updateDay = (patch: Partial<DayState>) => setDay((d) => ({ ...d, ...patch }));

  const generate = () => {
    const { plan, overflow } = schedule({
      date: day.date,
      tasks: day.tasks,
      schedule: day.schedule,
    });
    updateDay({ plan, overflow, confirmed: false });
    setTab("plan");
    if (overflow.length) {
      toast.warning(`${overflow.length} task${overflow.length > 1 ? "s" : ""} didn't fit`, {
        description: "Free up time or trim durations.",
      });
    } else {
      toast.success("Plan drafted", { description: `${plan.length} block${plan.length === 1 ? "" : "s"} scheduled.` });
    }
  };

  const confirmPlan = () => {
    updateDay({ confirmed: true });
    // Seed completion records for today's plan
    const existing = new Map(loadCompletions().filter((c) => c.date === day.date).map((c) => [c.id, c]));
    const keep = new Set<string>();
    for (const p of day.plan) {
      const id = `${day.date}:${p.id}`;
      keep.add(id);
      if (!existing.has(id)) {
        upsertCompletion({
          id,
          taskId: p.taskId,
          plannedBlockId: p.id,
          date: day.date,
          title: p.title,
          subject: p.subject,
          scheduledMin: p.durationMin,
          completed: false,
        });
      }
    }
    setCompletions(pruneCompletionsForDay(day.date, keep));
    toast.success("Plan confirmed", { description: "Head to the checklist to track progress." });
    setTab("checklist");
  };

  const toggleCompletion = (rec: CompletionRecord, completed: boolean) => {
    const updated: CompletionRecord = {
      ...rec,
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
    };
    setCompletions(upsertCompletion(updated));
  };

  const todayCompletions = useMemo(
    () => completions.filter((c) => c.date === day.date).sort((a, b) => a.title.localeCompare(b.title)),
    [completions, day.date],
  );

  return (
    <div className="min-h-screen bg-white text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center justify-between p-4">
        <h1 className="text-xl font-semibold">StudyFlow</h1>
        <ThemeToggle />
      </header>
      <Header date={date} onDateChange={setDate} confirmed={day.confirmed} />

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-8">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 rounded-full bg-muted/60 p-1">
            <TabsTrigger value="tasks" className="rounded-full gap-2">
              <ListTodo className="h-4 w-4" /> Tasks
            </TabsTrigger>
            <TabsTrigger value="schedule" className="rounded-full gap-2">
              <CalendarClock className="h-4 w-4" /> Schedule
            </TabsTrigger>
            <TabsTrigger value="plan" className="rounded-full gap-2">
              <Sparkles className="h-4 w-4" /> Plan
            </TabsTrigger>
            <TabsTrigger value="checklist" className="rounded-full gap-2">
              <CheckSquare className="h-4 w-4" /> Checklist
            </TabsTrigger>
            <TabsTrigger value="summary" className="rounded-full gap-2">
              <BarChart3 className="h-4 w-4" /> Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <TasksPanel
              tasks={day.tasks}
              onChange={(tasks) => updateDay({ tasks, confirmed: false })}
              onGenerate={generate}
            />
          </TabsContent>

          <TabsContent value="schedule">
            <SchedulePanel
              blocks={day.schedule}
              onChange={(schedule) => updateDay({ schedule, confirmed: false })}
              onSaveDefault={() => {
                saveDefaultSchedule(day.schedule);
                toast.success("Saved as your default schedule");
              }}
            />
          </TabsContent>

          <TabsContent value="plan">
            <PlanPanel
              day={day}
              onUpdatePlan={(plan) => updateDay({ plan, confirmed: false })}
              onGenerate={generate}
              onConfirm={confirmPlan}
              onExport={() => downloadICS(day.date, day.plan)}
            />
          </TabsContent>

          <TabsContent value="checklist">
            <ChecklistPanel
              plan={day.plan}
              confirmed={day.confirmed}
              records={todayCompletions}
              onToggle={toggleCompletion}
              onGoToPlan={() => setTab("plan")}
            />
          </TabsContent>

          <TabsContent value="summary">
            <SummaryPanel completions={completions} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ------------------------------ Header ------------------------------ */

function Header({
  date,
  onDateChange,
  confirmed,
}: { date: string; onDateChange: (v: string) => void; confirmed: boolean }) {
  const pretty = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }, [date]);

  return (
    <header className="border-b border-border/60 bg-card/40 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            StudyFlow
          </div>
          <h1 className="mt-1 text-4xl leading-tight text-foreground md:text-5xl">
            {pretty}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Draft a focused plan from what you need to do and when you're free.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {confirmed && (
            <Badge variant="secondary" className="gap-1.5 border-primary/30 bg-primary/10 text-primary">
              <CheckSquare className="h-3 w-3" /> Plan confirmed
            </Badge>
          )}
          <div className="flex items-center gap-2">
            <Label htmlFor="date" className="text-xs text-muted-foreground">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-[170px]"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------ Tasks ------------------------------ */

function TasksPanel({
  tasks, onChange, onGenerate,
}: { tasks: Task[]; onChange: (t: Task[]) => void; onGenerate: () => void }) {
  const [title, setTitle] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [priority, setPriority] = useState<Priority>("medium");
  const [subject, setSubject] = useState("");
  const [deadline, setDeadline] = useState("");

  const totalMin = tasks.reduce((s, t) => s + t.durationMin, 0);

  const add = () => {
    if (!title.trim()) {
      toast.error("Task needs a title");
      return;
    }
    onChange([
      ...tasks,
      newTask({
        title: title.trim(),
        durationMin,
        priority,
        subject: subject.trim() || undefined,
        deadline: deadline || undefined,
      }),
    ]);
    setTitle("");
    setSubject("");
    setDeadline("");
    setDurationMin(60);
    setPriority("medium");
  };

  const remove = (id: string) => onChange(tasks.filter((t) => t.id !== id));

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <Card className="surface">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display text-2xl">Today's tasks</CardTitle>
            <p className="text-sm text-muted-foreground">
              {tasks.length} task{tasks.length === 1 ? "" : "s"} · {formatDuration(totalMin)} of focused work
            </p>
          </div>
          <Button onClick={onGenerate} disabled={tasks.length === 0} className="gap-2">
            <Sparkles className="h-4 w-4" /> Generate plan
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.length === 0 && (
            <EmptyState
              icon={<ListTodo className="h-8 w-8" />}
              title="No tasks yet"
              hint="Add what you need to get through today on the right."
            />
          )}
          {tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3"
            >
              <PriorityDot priority={t.priority} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="truncate font-medium text-foreground">{t.title}</span>
                  {t.subject && <span className="text-xs text-muted-foreground">· {t.subject}</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDuration(t.durationMin)}
                  {t.deadline && ` · due ${new Date(t.deadline).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(t.id)} aria-label="Remove task">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="surface h-fit">
        <CardHeader>
          <CardTitle className="font-display text-xl">Add a task</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Title</Label>
            <Input
              id="t-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Finish problem set 4"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-dur">Duration (min)</Label>
              <Input
                id="t-dur"
                type="number"
                min={5}
                max={600}
                step={5}
                value={durationMin}
                onChange={(e) => setDurationMin(Math.max(5, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-subj">Subject (optional)</Label>
            <Input
              id="t-subj"
              value={subject}
              maxLength={40}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Calculus, Design, …"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-deadline">Deadline (optional)</Label>
            <Input
              id="t-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <Button onClick={add} className="w-full gap-2">
            <Plus className="h-4 w-4" /> Add task
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------------------- Schedule ---------------------------- */

function SchedulePanel({
  blocks, onChange, onSaveDefault,
}: { blocks: ScheduleBlock[]; onChange: (b: ScheduleBlock[]) => void; onSaveDefault: () => void }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [kind, setKind] = useState<ScheduleBlock["kind"]>("class");

  const sorted = [...blocks].sort((a, b) => toMin(a.start) - toMin(b.start));

  const add = () => {
    if (!title.trim()) { toast.error("Give the block a name"); return; }
    if (toMin(end) <= toMin(start)) { toast.error("End must be after start"); return; }
    onChange([...blocks, newBlock({ title: title.trim(), start, end, kind })]);
    setTitle("");
  };
  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id));

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <Card className="surface">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display text-2xl">Fixed schedule</CardTitle>
            <p className="text-sm text-muted-foreground">Classes, work blocks, meals, sleep — anything already spoken for.</p>
          </div>
          <Button variant="outline" onClick={onSaveDefault}>Save as default</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.length === 0 && (
            <EmptyState
              icon={<CalendarClock className="h-8 w-8" />}
              title="No blocks yet"
              hint="Add your fixed commitments so StudyFlow knows when you're free."
            />
          )}
          {sorted.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3"
            >
              <KindPill kind={b.kind} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">{b.title}</div>
                <div className="text-xs text-muted-foreground">{b.start} – {b.end} · {formatDuration(toMin(b.end) - toMin(b.start))}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(b.id)} aria-label="Remove block">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="surface h-fit">
        <CardHeader><CardTitle className="font-display text-xl">Add a block</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-title">Title</Label>
            <Input id="b-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Physics lecture" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ScheduleBlock["kind"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="class">Class</SelectItem>
                <SelectItem value="work">Work</SelectItem>
                <SelectItem value="meal">Meal</SelectItem>
                <SelectItem value="sleep">Sleep</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add} className="w-full gap-2"><Plus className="h-4 w-4" /> Add block</Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------ Plan ------------------------------ */

function PlanPanel({
  day, onUpdatePlan, onGenerate, onConfirm, onExport,
}: {
  day: DayState;
  onUpdatePlan: (p: PlannedBlock[]) => void;
  onGenerate: () => void;
  onConfirm: () => void;
  onExport: () => void;
}) {
  const totalPlanned = day.plan.reduce((s, p) => s + p.durationMin, 0);

  const editTime = (id: string, field: "start" | "end", value: string) => {
    const next = day.plan.map((p) => {
      if (p.id !== id) return p;
      const start = field === "start" ? value : p.start;
      const end = field === "end" ? value : p.end;
      const dur = Math.max(5, toMin(end) - toMin(start));
      return { ...p, start, end, durationMin: dur };
    });
    onUpdatePlan(next.sort((a, b) => toMin(a.start) - toMin(b.start)));
  };

  const removeBlock = (id: string) => onUpdatePlan(day.plan.filter((p) => p.id !== id));

  return (
    <Card className="surface">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="font-display text-2xl">Generated plan</CardTitle>
          <p className="text-sm text-muted-foreground">
            {day.plan.length} block{day.plan.length === 1 ? "" : "s"} · {formatDuration(totalPlanned)} of focused time
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onGenerate} className="gap-2">
            <Sparkles className="h-4 w-4" /> Regenerate
          </Button>
          <Button variant="outline" onClick={onExport} disabled={day.plan.length === 0} className="gap-2">
            <Download className="h-4 w-4" /> Export .ics
          </Button>
          <Button onClick={onConfirm} disabled={day.plan.length === 0}>Confirm plan</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {day.overflow.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{day.overflow.length}</strong> task{day.overflow.length > 1 ? "s" : ""} didn't fit in your free time. Trim durations or clear a schedule block.
            </span>
          </div>
        )}

        {day.plan.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-8 w-8" />}
            title="No plan yet"
            hint="Add tasks and schedule blocks, then generate."
          />
        ) : (
          <ul className="space-y-2">
            {day.plan.map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3"
              >
                <PriorityDot priority={p.priority} />
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDuration(p.durationMin)}{p.subject ? ` · ${p.subject}` : ""}
                  </div>
                </div>
                <Input
                  type="time"
                  value={p.start}
                  onChange={(e) => editTime(p.id, "start", e.target.value)}
                  className="w-[110px]"
                />
                <Input
                  type="time"
                  value={p.end}
                  onChange={(e) => editTime(p.id, "end", e.target.value)}
                  className="w-[110px]"
                />
                <Button variant="ghost" size="icon" onClick={() => removeBlock(p.id)} aria-label="Remove block">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Checklist ---------------------------- */

function ChecklistPanel({
  plan, confirmed, records, onToggle, onGoToPlan,
}: {
  plan: PlannedBlock[];
  confirmed: boolean;
  records: CompletionRecord[];
  onToggle: (r: CompletionRecord, completed: boolean) => void;
  onGoToPlan: () => void;
}) {
  const byBlockId = useMemo(() => new Map(records.map((r) => [r.plannedBlockId, r])), [records]);
  const sorted = [...plan].sort((a, b) => toMin(a.start) - toMin(b.start));
  const done = records.filter((r) => r.completed).length;

  if (!confirmed || plan.length === 0) {
    return (
      <Card className="surface">
        <CardContent className="py-16">
          <EmptyState
            icon={<CheckSquare className="h-8 w-8" />}
            title="Confirm a plan to start checking off tasks"
            hint="Generate and confirm your day's plan first."
            action={<Button onClick={onGoToPlan}>Go to plan</Button>}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Today's checklist</CardTitle>
        <p className="text-sm text-muted-foreground">
          {done} of {plan.length} complete · {Math.round((done / plan.length) * 100)}%
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((p) => {
          const rec = byBlockId.get(p.id);
          if (!rec) return null;
          return (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition-colors hover:bg-background/70"
            >
              <Checkbox
                checked={rec.completed}
                onCheckedChange={(v) => onToggle(rec, v === true)}
              />
              <div className="min-w-0 flex-1">
                <div className={`truncate font-medium ${rec.completed ? "text-muted-foreground line-through" : ""}`}>
                  {p.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.start} – {p.end} · {formatDuration(p.durationMin)}{p.subject ? ` · ${p.subject}` : ""}
                </div>
              </div>
              <PriorityDot priority={p.priority} />
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Summary ---------------------------- */

type Range = "day" | "week" | "month" | "custom";

function SummaryPanel({ completions }: { completions: CompletionRecord[] }) {
  const [range, setRange] = useState<Range>("week");
  const [from, setFrom] = useState(() => shiftDays(todayISO(), -6));
  const [to, setTo] = useState(() => todayISO());

  const { start, end } = useMemo(() => {
    if (range === "day") return { start: todayISO(), end: todayISO() };
    if (range === "week") return { start: shiftDays(todayISO(), -6), end: todayISO() };
    if (range === "month") return { start: shiftDays(todayISO(), -29), end: todayISO() };
    return { start: from, end: to };
  }, [range, from, to]);

  const inRange = useMemo(
    () => completions.filter((c) => c.date >= start && c.date <= end),
    [completions, start, end],
  );

  const planned = inRange.length;
  const done = inRange.filter((c) => c.completed).length;
  const rate = planned > 0 ? Math.round((done / planned) * 100) : 0;
  const overdue = inRange.filter((c) => !c.completed && c.date < todayISO()).length;
  const streak = computeStreak(completions);

  const byDay = useMemo(() => {
    const map = new Map<string, { date: string; planned: number; done: number }>();
    for (const c of inRange) {
      const row = map.get(c.date) ?? { date: c.date, planned: 0, done: 0 };
      row.planned += 1;
      if (c.completed) row.done += 1;
      map.set(c.date, row);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [inRange]);

  const bySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of inRange) {
      if (!c.completed) continue;
      const key = c.subject || "Unspecified";
      map.set(key, (map.get(key) ?? 0) + c.scheduledMin);
    }
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [inRange]);

  const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <div className="space-y-6">
      <Card className="surface">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="font-display text-2xl">Progress</CardTitle>
            <p className="text-sm text-muted-foreground">
              {new Date(start + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} — {new Date(end + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Range</Label>
              <Select value={range} onValueChange={(v) => setRange(v as Range)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Today</SelectItem>
                  <SelectItem value="week">Last 7 days</SelectItem>
                  <SelectItem value="month">Last 30 days</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {range === "custom" && (
              <>
                <div className="space-y-1.5">
                  <Label>From</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
                </div>
                <div className="space-y-1.5">
                  <Label>To</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
                </div>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Completed" value={done.toString()} />
            <Stat label="Planned" value={planned.toString()} />
            <Stat label="Completion rate" value={`${rate}%`} accent />
            <Stat label="Streak" value={`${streak}d`} />
          </div>
          {overdue > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {overdue} missed / overdue task{overdue > 1 ? "s" : ""} in range
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="surface">
          <CardHeader>
            <CardTitle className="font-display text-xl">Planned vs. completed</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {byDay.length === 0 ? (
              <EmptyState icon={<BarChart3 className="h-8 w-8" />} title="No data in range" hint="Confirm a plan and check tasks off to see progress." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="planned" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="done" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="surface">
          <CardHeader>
            <CardTitle className="font-display text-xl">Time by subject</CardTitle>
            <p className="text-sm text-muted-foreground">Completed minutes</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            {bySubject.length === 0 ? (
              <EmptyState icon={<BarChart3 className="h-8 w-8" />} title="No completed time yet" hint="Check tasks off to see how you spent focus time." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bySubject}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    stroke="var(--card)"
                    strokeWidth={2}
                  >
                    {bySubject.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatDuration(v)}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {bySubject.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {bySubject.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: chartColors[i % chartColors.length] }} />
                    {s.name} · {formatDuration(s.value)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="surface">
        <CardHeader>
          <CardTitle className="font-display text-xl">Recent tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {inRange.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet in this range.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {[...inRange].reverse().slice(0, 12).map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <div className={`truncate font-medium ${c.completed ? "text-muted-foreground line-through" : ""}`}>{c.title}</div>
                    <div className="text-xs text-muted-foreground">{c.date}{c.subject ? ` · ${c.subject}` : ""} · {formatDuration(c.scheduledMin)}</div>
                  </div>
                  {c.completed ? (
                    <Badge variant="secondary" className="border-primary/30 bg-primary/10 text-primary">Done</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Open</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------ Bits ------------------------------ */

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-3xl ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function PriorityDot({ priority }: { priority: Priority }) {
  const map: Record<Priority, string> = {
    high: "bg-primary",
    medium: "bg-highlight",
    low: "bg-muted-foreground/50",
  };
  return <span aria-label={`${priority} priority`} className={`h-2.5 w-2.5 shrink-0 rounded-full ${map[priority]}`} />;
}

function KindPill({ kind }: { kind: ScheduleBlock["kind"] }) {
  const label = { class: "Class", work: "Work", meal: "Meal", sleep: "Sleep", other: "Other" }[kind];
  return (
    <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
  );
}

function EmptyState({
  icon, title, hint, action,
}: { icon: React.ReactNode; title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-background/30 px-6 py-10 text-center">
      <div className="text-muted-foreground/70">{icon}</div>
      <div className="font-display text-lg text-foreground">{title}</div>
      <div className="max-w-xs text-sm text-muted-foreground">{hint}</div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------------------------- Utilities ---------------------------- */

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function shiftDays(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return todayISO(d);
}

function computeStreak(records: CompletionRecord[]): number {
  const byDate = new Map<string, { planned: number; done: number }>();
  for (const r of records) {
    const row = byDate.get(r.date) ?? { planned: 0, done: 0 };
    row.planned += 1;
    if (r.completed) row.done += 1;
    byDate.set(r.date, row);
  }
  let streak = 0;
  let cursor = todayISO();
  for (let i = 0; i < 365; i++) {
    const row = byDate.get(cursor);
    if (row && row.planned > 0 && row.done === row.planned) {
      streak += 1;
    } else if (row && row.planned > 0) {
      break;
    } else if (i > 0) {
      // no data for a past day → streak ends (skip today if no data yet)
      break;
    }
    cursor = shiftDays(cursor, -1);
  }
  return streak;
}

export default App
