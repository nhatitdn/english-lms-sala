"use client";

import { Copy, Eye, Lock, Plus, Send, Trash2, Undo2, Unlock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import type { AssignmentStatus } from "@/generated/prisma/enums";
import { ASSIGNMENT_KIND_LABELS } from "@/lib/labels";
import {
  createAssignmentAction,
  createListeningQuizAction,
  deleteAssignmentAction,
  duplicateAssignmentAction,
  releaseAnswersAction,
  setAssignmentStatusAction,
} from "../actions";

type Result = { ok: true; message?: string; data: unknown } | { ok: false; error: { message: string } };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>, after?: (data: unknown) => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error.message);
      if (r.message) toast.success(r.message);
      if (after) after(r.data);
      else router.refresh();
    });
  return { pending, run, router };
}

export function NewAssignmentDialog({ classes, defaultClassId }: { classes?: { id: string; code: string; name: string }[]; defaultClassId?: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="primary">
          <Plus /> Tạo bài tập
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bài tập mới</DialogTitle>
          <DialogDescription>Bài tập được tạo ở dạng nháp. Thêm câu hỏi, chọn lớp/nhóm/học viên và hạn nộp rồi bấm “Đăng”.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          action={(fd) =>
            start(async () => {
              const r = await createAssignmentAction(fd);
              if (!r.ok) return void setErrors(r.error.fieldErrors ?? { title: [r.error.message] });
              router.push(`/app/assignments/${r.data.id}/edit`);
            })
          }
        >
          {defaultClassId && <input type="hidden" name="classId" value={defaultClassId} />}
          <Field id="title" label="Tên bài tập" required error={errors.title}>
            <Input name="title" placeholder="Unit 3 Quiz — My family" autoFocus />
          </Field>
          <Field id="kind" label="Loại bài">
            <NativeSelect name="kind" defaultValue="QUIZ">
              {Object.entries(ASSIGNMENT_KIND_LABELS)
                .filter(([k]) => k !== "LISTENING")
                .map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          {classes && classes.length === 0 && <p className="text-sm text-ink-muted">Bạn chưa phụ trách lớp nào — vẫn có thể soạn trước và giao sau.</p>}
          <p className="text-sm text-ink-muted">Bài luyện nghe có câu hỏi: tạo từ mục “Luyện nghe” trong bài giảng.</p>
          <DialogFooter>
            <Button type="submit" variant="primary" loading={pending}>
              Tạo và soạn câu hỏi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AssignmentStatusActions({ assignmentId, status, answerReveal, answersReleased, hasSubmissions }: { assignmentId: string; status: AssignmentStatus; answerReveal: string; answersReleased: boolean; hasSubmissions: boolean }) {
  const { pending, run, router } = useRun();
  const setStatus = (action: "publish" | "unpublish" | "close" | "reopen") => run(() => setAssignmentStatusAction({ assignmentId, action }));
  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && (
        <Button variant="primary" loading={pending} onClick={() => setStatus("publish")}>
          <Send /> Đăng bài tập
        </Button>
      )}
      {status === "PUBLISHED" && (
        <>
          <Button variant="outline" disabled={pending} onClick={() => confirm("Khóa bài tập? Học viên sẽ không bắt đầu làm được nữa.") && setStatus("close")}>
            <Lock /> Khóa
          </Button>
          {!hasSubmissions && (
            <Button variant="ghost" disabled={pending} onClick={() => setStatus("unpublish")}>
              <Undo2 /> Về nháp
            </Button>
          )}
        </>
      )}
      {status === "CLOSED" && (
        <Button variant="outline" disabled={pending} onClick={() => setStatus("reopen")}>
          <Unlock /> Mở lại
        </Button>
      )}
      {answerReveal === "MANUAL" && status !== "DRAFT" && !answersReleased && (
        <Button variant="outline" disabled={pending} onClick={() => run(() => releaseAnswersAction({ assignmentId }))}>
          <Eye /> Cho xem đáp án
        </Button>
      )}
      <Button variant="ghost" disabled={pending} onClick={() => run(() => duplicateAssignmentAction({ assignmentId }), (d) => router.push(`/app/assignments/${(d as { id: string }).id}/edit`))}>
        <Copy /> Nhân bản
      </Button>
      <Button
        variant="ghost"
        className="text-danger"
        disabled={pending}
        onClick={() =>
          confirm("Xóa bài tập này? Bài đã nộp và điểm vẫn được lưu trong hệ thống.") && run(() => deleteAssignmentAction({ assignmentId }), () => router.push("/app/assignments"))
        }
      >
        <Trash2 /> Xóa
      </Button>
    </div>
  );
}

export function DuplicateAssignmentButton({ assignmentId }: { assignmentId: string }) {
  const { pending, run, router } = useRun();
  return (
    <Button variant="outline" loading={pending} onClick={() => run(() => duplicateAssignmentAction({ assignmentId }), (d) => router.push(`/app/assignments/${(d as { id: string }).id}/edit`))}>
      <Copy /> Nhân bản
    </Button>
  );
}

/** In the lesson editor: create (or open) the question set for a listening item. */
export function ListeningQuizButton({ lessonId, audioLessonId, assignmentId }: { lessonId: string; audioLessonId: string; assignmentId: string | null }) {
  const { pending, run, router } = useRun();
  if (assignmentId)
    return (
      <Button variant="outline" size="sm" onClick={() => router.push(`/app/assignments/${assignmentId}/edit`)}>
        Câu hỏi nghe
      </Button>
    );
  return (
    <Button variant="outline" size="sm" loading={pending} onClick={() => run(() => createListeningQuizAction({ lessonId, audioLessonId }), (d) => router.push(`/app/assignments/${(d as { id: string }).id}/edit`))}>
      <Plus /> Tạo câu hỏi nghe
    </Button>
  );
}
