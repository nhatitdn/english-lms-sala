"use client";

import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addStudentsAction, searchStudentsToAddAction } from "../actions";
import { useRunAction } from "./use-action";

type Candidate = { id: string; studentCode: string; user: { fullName: string; username: string }; memberships: { class: { code: string } }[] };

export function AddStudents({ classId }: { classId: string }) {
  const { pending, run } = useRunAction();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const searching = q.trim().length >= 2;

  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(async () => {
      const r = await searchStudentsToAddAction({ classId, q });
      if (r.ok) setResults(r.data);
    }, 250);
    return () => clearTimeout(t);
  }, [q, classId, searching]);

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm học viên theo tên, tên đăng nhập, mã HV…" className="pl-9" aria-label="Tìm học viên để thêm" />
      </div>
      {searching && (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {results.length === 0 && <li className="px-3 py-3 text-sm text-ink-muted">Không tìm thấy học viên phù hợp (hoặc đã ở trong lớp).</li>}
          {results.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="grid min-w-0">
                <span className="truncate text-ink">{c.user.fullName}</span>
                <span className="text-xs text-ink-muted">
                  {c.studentCode} · {c.user.username}
                  {c.memberships.length > 0 && ` · đang học ${c.memberships.map((m) => m.class.code).join(", ")}`}
                </span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => addStudentsAction({ classId, studentIds: [c.id] }), () => setResults((r) => r.filter((x) => x.id !== c.id)))}
              >
                <Plus /> Thêm
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
