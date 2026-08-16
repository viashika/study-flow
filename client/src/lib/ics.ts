import type { PlannedBlock } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

const toICSDate = (date: string, hhmm: string): string => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(date + "T00:00:00");
  d.setHours(h, m, 0, 0);
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    "00"
  );
};

const escape = (s: string) => s.replace(/[\\;,\n]/g, (c) => (c === "\n" ? "\\n" : "\\" + c));

export function buildICS(date: string, plan: PlannedBlock[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudyFlow//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const p of plan) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${p.id}@studyflow`,
      `DTSTAMP:${toICSDate(date, p.start)}`,
      `DTSTART:${toICSDate(date, p.start)}`,
      `DTEND:${toICSDate(date, p.end)}`,
      `SUMMARY:${escape(p.title)}`,
      `DESCRIPTION:${escape(`StudyFlow · ${p.priority} priority${p.subject ? " · " + p.subject : ""}`)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(date: string, plan: PlannedBlock[]): void {
  const blob = new Blob([buildICS(date, plan)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `studyflow-${date}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
