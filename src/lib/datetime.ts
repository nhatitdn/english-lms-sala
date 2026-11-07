import { TZDate } from "@date-fns/tz";
import { format, formatDistanceToNowStrict } from "date-fns";
import { vi } from "date-fns/locale";

export const APP_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Convert any instant to a Date that reads in Vietnam local time. */
export function toLocal(date: Date | string | number): TZDate {
  return new TZDate(new Date(date), APP_TIMEZONE);
}

export function formatDate(date: Date | string | number, pattern = "dd/MM/yyyy"): string {
  return format(toLocal(date), pattern, { locale: vi });
}

export function formatDateTime(date: Date | string | number): string {
  return format(toLocal(date), "HH:mm dd/MM/yyyy", { locale: vi });
}

export function formatTime(date: Date | string | number): string {
  return format(toLocal(date), "HH:mm", { locale: vi });
}

/** "Thứ Bảy, 07/11/2026" */
export function formatLongDate(date: Date | string | number): string {
  const text = format(toLocal(date), "EEEE, dd/MM/yyyy", { locale: vi });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "còn 20 giờ" / "quá hạn 1 ngày" */
export function relativeDue(due: Date | string | number, now: Date = new Date()): { text: string; overdue: boolean; hoursLeft: number } {
  const d = new Date(due);
  const msLeft = d.getTime() - now.getTime();
  const overdue = msLeft < 0;
  const distance = formatDistanceToNowStrict(d, { locale: vi });
  return { text: overdue ? `quá hạn ${distance}` : `còn ${distance}`, overdue, hoursLeft: msLeft / 3_600_000 };
}

/** Start and end (exclusive) of "today" in Vietnam time, as UTC instants. */
export function localDayRange(now: Date = new Date()): { start: Date; end: Date } {
  const local = toLocal(now);
  const start = new TZDate(local.getFullYear(), local.getMonth(), local.getDate(), APP_TIMEZONE);
  const end = new TZDate(local.getFullYear(), local.getMonth(), local.getDate() + 1, APP_TIMEZONE);
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}
