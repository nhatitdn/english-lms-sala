/** Schedule times are stored as TIME (Vietnam local time of day) and read back as 1970-01-01T..Z dates. */
export function timeToHHMM(t: Date): string {
  return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
}

const SHORT_DAYS: Record<number, string> = { 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7", 7: "CN" };

/** [{weekday:2,17:30-19:00},{weekday:4,17:30-19:00}] → "T3, T5 · 17:30–19:00" */
export function formatSchedule(items: { weekday: number; startTime: Date; endTime: Date }[]): string {
  if (!items.length) return "Chưa có lịch";
  const byTime = new Map<string, number[]>();
  for (const s of items) {
    const key = `${timeToHHMM(s.startTime)}–${timeToHHMM(s.endTime)}`;
    byTime.set(key, [...(byTime.get(key) ?? []), s.weekday]);
  }
  return [...byTime.entries()].map(([time, days]) => `${days.sort().map((d) => SHORT_DAYS[d]).join(", ")} · ${time}`).join(" | ");
}
