"use client";

import { Link2, Unlink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ParentRelationship } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { RELATIONSHIP_LABELS } from "@/lib/constants";
import { linkParentStudentAction, searchLinkCandidatesAction, unlinkParentStudentAction } from "../actions";

type Linked = { userId: string; fullName: string; username: string; relationship: ParentRelationship; extra?: string | null };
type Candidate = { id: string; fullName: string; username: string; phone: string | null };

/** Manage parent ↔ student links from either side. */
export function ParentLinks({ selfUserId, side, linked }: { selfUserId: string; side: "PARENT" | "STUDENT"; linked: Linked[] }) {
  const searchRole = side === "PARENT" ? "STUDENT" : "PARENT";
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [relationship, setRelationship] = useState<ParentRelationship>("MOTHER");
  const [pending, startTransition] = useTransition();

  const searching = q.trim().length >= 2;
  const visibleResults = searching ? results : [];

  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(async () => {
      const r = await searchLinkCandidatesAction({ role: searchRole, q });
      if (r.ok) setResults(r.data.filter((c) => !linked.some((l) => l.userId === c.id)));
    }, 250);
    return () => clearTimeout(t);
  }, [q, searching, searchRole, linked]);

  const pair = (otherId: string) =>
    side === "PARENT" ? { parentUserId: selfUserId, studentUserId: otherId } : { parentUserId: otherId, studentUserId: selfUserId };

  function link(otherId: string) {
    startTransition(async () => {
      const r = await linkParentStudentAction({ ...pair(otherId), relationship });
      if (!r.ok) return void toast.error(r.error.message);
      toast.success(r.message);
      setQ("");
    });
  }

  function unlink(otherId: string) {
    startTransition(async () => {
      const r = await unlinkParentStudentAction(pair(otherId));
      if (!r.ok) return void toast.error(r.error.message);
      toast.success(r.message);
    });
  }

  return (
    <div className="grid gap-4">
      {linked.length === 0 ? (
        <p className="text-sm text-ink-muted">{side === "PARENT" ? "Chưa liên kết học viên nào." : "Chưa liên kết phụ huynh nào."}</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {linked.map((l) => (
            <li key={l.userId} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="grid min-w-0">
                <Link href={`/app/admin/users/${l.userId}`} className="truncate font-medium text-ink hover:text-blue-700">
                  {l.fullName}
                </Link>
                <span className="text-sm text-ink-muted">
                  {RELATIONSHIP_LABELS[l.relationship]} · {l.username}
                  {l.extra && ` · ${l.extra}`}
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => unlink(l.userId)} disabled={pending} aria-label={`Bỏ liên kết ${l.fullName}`}>
                <Unlink /> Bỏ
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 rounded-md bg-sky-50 p-3">
        <p className="text-sm font-medium text-ink">{side === "PARENT" ? "Thêm con" : "Thêm phụ huynh"}</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={side === "PARENT" ? "Tìm học viên theo tên, tên đăng nhập…" : "Tìm phụ huynh theo tên, SĐT…"} aria-label="Tìm để liên kết" />
          <NativeSelect value={relationship} onChange={(e) => setRelationship(e.target.value as ParentRelationship)} aria-label="Quan hệ">
            {Object.entries(RELATIONSHIP_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </div>
        {visibleResults.length > 0 && (
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {visibleResults.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="grid min-w-0">
                  <span className="truncate text-ink">{c.fullName}</span>
                  <span className="text-xs text-ink-muted">
                    {c.username}
                    {c.phone && ` · ${c.phone}`}
                  </span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => link(c.id)} disabled={pending}>
                  <Link2 /> Liên kết
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
