"use client";

import { CalendarClock, MoreVertical, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { localInputToIso, toLocalInput } from "@/lib/datetime";
import { excuseStudentAction, grantExtensionAction, startAttemptAction } from "../actions";

export function StudentRowActions({
  assignmentId,
  studentId,
  studentName,
  classId,
  dueAt,
  canExcuse,
}: {
  assignmentId: string;
  studentId: string;
  studentName: string;
  classId: string;
  dueAt: Date | null;
  canExcuse: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [defaultDue] = useState(() => toLocalInput(dueAt && dueAt > new Date() ? dueAt : new Date(Date.now() + 2 * 86_400_000)));
  const [pending, start] = useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Thao tác với ${studentName}`}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setOpen(true)}>
            <CalendarClock /> Gia hạn riêng
          </DropdownMenuItem>
          {canExcuse && (
            <DropdownMenuItem
              onSelect={() =>
                confirm(`Miễn bài này cho ${studentName}?`) &&
                start(async () => {
                  const r = await excuseStudentAction({ assignmentId, studentId, classId });
                  if (!r.ok) return void toast.error(r.error.message);
                  toast.success(r.message);
                  router.refresh();
                })
              }
            >
              <UserX /> Miễn nộp
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gia hạn cho {studentName}</DialogTitle>
            <DialogDescription>Chỉ học viên này có hạn mới. Các bạn khác giữ hạn cũ.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            action={(fd) =>
              start(async () => {
                const newDueAt = localInputToIso(fd.get("newDueAtLocal"));
                if (!newDueAt) return void setError("Chọn hạn mới.");
                const r = await grantExtensionAction({ assignmentId, studentId, newDueAt, reason: fd.get("reason") || undefined });
                if (!r.ok) return void setError(r.error.fieldErrors?.newDueAt?.[0] ?? r.error.message);
                toast.success(r.message);
                setOpen(false);
                router.refresh();
              })
            }
          >
            <Field id="newDueAtLocal" label="Hạn nộp mới" required error={error}>
              <Input name="newDueAtLocal" type="datetime-local" defaultValue={defaultDue} />
            </Field>
            <Field id="reason" label="Lý do (không bắt buộc)">
              <Input name="reason" placeholder="VD: ốm, nghỉ có phép" />
            </Field>
            <DialogFooter>
              <Button type="submit" variant="primary" loading={pending}>
                Gia hạn
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function StartAttemptButton({ assignmentId, label, resumeId }: { assignmentId: string; label: string; resumeId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="primary"
      size="lg"
      loading={pending}
      className="w-full sm:w-auto"
      onClick={() =>
        start(async () => {
          if (resumeId) return router.push(`/app/do/${resumeId}`);
          const r = await startAttemptAction({ assignmentId });
          if (!r.ok) return void toast.error(r.error.message);
          router.push(`/app/do/${r.data.submissionId}`);
        })
      }
    >
      {label}
    </Button>
  );
}
