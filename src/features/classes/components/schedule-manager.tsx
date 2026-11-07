"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { WEEKDAY_LABELS } from "../schemas";
import { deleteScheduleAction, upsertScheduleAction } from "../actions";
import { useRunAction } from "./use-action";

type Item = { id: string; weekday: number; start: string; end: string; location: string | null };

export function ScheduleManager({ classId, items }: { classId: string; items: Item[] }) {
  const { pending, run } = useRunAction();
  const [editing, setEditing] = useState<Item | null>(null);
  const empty = { id: "", weekday: 2, start: "17:30", end: "19:00", location: "" } as Item;
  const form = editing ?? empty;

  function save(fd: FormData) {
    fd.set("classId", classId);
    if (editing?.id) fd.set("scheduleId", editing.id);
    run(() => upsertScheduleAction(fd), () => setEditing(null));
  }

  return (
    <div className="grid gap-4">
      {items.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <span className="text-ink">
                <strong className="font-medium">{WEEKDAY_LABELS[s.weekday]}</strong> · {s.start}–{s.end}
                {s.location && <span className="text-ink-muted"> · {s.location}</span>}
              </span>
              <span className="flex">
                <Button size="sm" variant="ghost" onClick={() => setEditing(s)} aria-label="Sửa lịch">
                  <Pencil />
                </Button>
                <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => run(() => deleteScheduleAction({ classId, scheduleId: s.id }))} aria-label="Xóa lịch">
                  <Trash2 />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form key={form.id || "new"} action={save} className="grid gap-2 rounded-md bg-sky-50 p-3 sm:grid-cols-[1fr_110px_110px_1fr_auto] sm:items-end">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-ink">Thứ</span>
          <NativeSelect name="weekday" defaultValue={form.weekday}>
            {Object.entries(WEEKDAY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-ink">Bắt đầu</span>
          <Input name="startTime" type="time" defaultValue={form.start} required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-ink">Kết thúc</span>
          <Input name="endTime" type="time" defaultValue={form.end} required />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-ink">Phòng (nếu khác)</span>
          <Input name="location" defaultValue={form.location ?? ""} />
        </label>
        <span className="flex gap-1">
          {editing && (
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Hủy
            </Button>
          )}
          <Button type="submit" variant="secondary" loading={pending}>
            {editing ? "Lưu" : (
              <>
                <Plus /> Thêm
              </>
            )}
          </Button>
        </span>
      </form>
      <p className="text-sm text-ink-muted">Hệ thống tự tạo các buổi học trong 8 tuần tới theo lịch này. Đổi lịch chỉ ảnh hưởng các buổi chưa diễn ra.</p>
    </div>
  );
}
