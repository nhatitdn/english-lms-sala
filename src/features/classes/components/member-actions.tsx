"use client";

import { ArrowRightLeft, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { removeStudentAction, transferStudentAction } from "../actions";
import { useRunAction } from "./use-action";
import { Ellipsis } from "lucide-react";

export function MemberActions({
  classId,
  studentId,
  name,
  targets,
}: {
  classId: string;
  studentId: string;
  name: string;
  targets: { id: string; code: string; name: string }[];
}) {
  const { pending, run } = useRunAction();
  const [mode, setMode] = useState<"remove" | "transfer" | null>(null);
  const [toClassId, setTo] = useState("");
  const [note, setNote] = useState("");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="grid size-10 place-items-center rounded-md text-ink-muted hover:bg-sky-50" aria-label={`Thao tác với ${name}`}>
          <Ellipsis className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setMode("transfer")} disabled={targets.length === 0}>
            <ArrowRightLeft /> Chuyển lớp
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMode("remove")} className="text-danger [&_svg]:text-danger">
            <LogOut /> Cho rời lớp
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "transfer" ? `Chuyển ${name} sang lớp khác` : `${name} rời lớp?`}</DialogTitle>
            <DialogDescription>Bài nộp, điểm và điểm danh ở lớp này vẫn được giữ trong lịch sử học tập.</DialogDescription>
          </DialogHeader>
          {mode === "transfer" && (
            <Field id="toClassId" label="Lớp chuyển đến" required>
              <NativeSelect value={toClassId} onChange={(e) => setTo(e.target.value)}>
                <option value="">Chọn lớp…</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} · {t.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field id="note" label="Ghi chú (không bắt buộc)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "transfer" ? "VD: lên trình độ" : "VD: nghỉ học từ tháng 12"} />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Hủy</Button>
            </DialogClose>
            {mode === "transfer" ? (
              <Button
                variant="primary"
                disabled={!toClassId}
                loading={pending}
                onClick={() => run(() => transferStudentAction({ fromClassId: classId, toClassId, studentId, note }), () => setMode(null))}
              >
                Chuyển lớp
              </Button>
            ) : (
              <Button variant="destructive" loading={pending} onClick={() => run(() => removeStudentAction({ classId, studentId, note }), () => setMode(null))}>
                Cho rời lớp
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
