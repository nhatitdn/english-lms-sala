"use client";

import { UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { assignTeacherAction, removeTeacherAction } from "../actions";
import { useRunAction } from "./use-action";

type Assigned = { userId: string; name: string; role: "MAIN" | "ASSISTANT" };
type Option = { userId: string; name: string };

export function TeacherManager({ classId, assigned, options }: { classId: string; assigned: Assigned[]; options: Option[] }) {
  const { pending, run } = useRunAction();
  const free = options.filter((o) => !assigned.some((a) => a.userId === o.userId));
  const [teacher, setTeacher] = useState("");
  const [role, setRole] = useState<"MAIN" | "ASSISTANT">("MAIN");

  return (
    <div className="grid gap-3">
      {assigned.length === 0 ? (
        <p className="text-sm text-ink-muted">Chưa phân công giáo viên.</p>
      ) : (
        <ul className="divide-y divide-line">
          {assigned.map((a) => (
            <li key={a.userId} className="flex items-center justify-between gap-2 py-2">
              <span className="flex items-center gap-2 text-ink">
                {a.name} <Badge tone={a.role === "MAIN" ? "orange" : "neutral"}>{a.role === "MAIN" ? "Chính" : "Trợ giảng"}</Badge>
              </span>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => removeTeacherAction({ classId, teacherUserId: a.userId }))} aria-label={`Bỏ phân công ${a.name}`}>
                <UserMinus />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {free.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-[1fr_130px_auto]">
          <NativeSelect value={teacher} onChange={(e) => setTeacher(e.target.value)} aria-label="Chọn giáo viên">
            <option value="">Chọn giáo viên…</option>
            {free.map((o) => (
              <option key={o.userId} value={o.userId}>
                {o.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={role} onChange={(e) => setRole(e.target.value as "MAIN" | "ASSISTANT")} aria-label="Vai trò">
            <option value="MAIN">Chính</option>
            <option value="ASSISTANT">Trợ giảng</option>
          </NativeSelect>
          <Button variant="secondary" disabled={!teacher} loading={pending} onClick={() => run(() => assignTeacherAction({ classId, teacherUserId: teacher, role }), () => setTeacher(""))}>
            <UserPlus /> Phân công
          </Button>
        </div>
      )}
    </div>
  );
}
