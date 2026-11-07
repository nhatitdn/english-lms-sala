"use client";

import { ArrowDown, ArrowUp, Check, Image as ImageIcon, Music, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/design-system/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { QuestionType } from "@/generated/prisma/enums";
import { deleteQuestionAction, moveQuestionAction } from "../actions";
import { parseFillTemplate, QUESTION_TYPE_LABELS, type QuestionDraft } from "../questions";
import { emptyDraft, QuestionEditorDialog } from "./question-editor";

type Item = { draft: QuestionDraft; mediaKind: string | null };

export function QuestionList({ assignmentId, items, locked }: { assignmentId: string; items: Item[]; locked: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ draft: QuestionDraft; mediaKind: string | null; key: number } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: { message: string } }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error?.message ?? "Có lỗi xảy ra.");
      if (r.message) toast.success(r.message);
      router.refresh();
    });

  return (
    <section aria-labelledby="questions-heading" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="questions-heading" className="text-lg font-semibold text-ink">
          Câu hỏi ({items.length})
        </h2>
        {!locked && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="primary">
                <Plus /> Thêm câu hỏi
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                <DropdownMenuItem key={t} onSelect={() => setEditing({ draft: emptyDraft(t), mediaKind: null, key: Date.now() })}>
                  {QUESTION_TYPE_LABELS[t]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState title="Chưa có câu hỏi" description="Bấm “Thêm câu hỏi” và chọn dạng: trắc nghiệm, điền từ, nối cặp, sắp xếp, viết, ghi âm…" />
      ) : (
        <ol className="grid gap-2">
          {items.map(({ draft: q, mediaKind }, i) => (
            <li key={q.id} className="rounded-lg border border-line bg-surface p-4 shadow-card" data-testid="question-card">
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sky-100 text-sm font-semibold text-blue-700">{i + 1}</span>
                <div className="grid min-w-0 flex-1 gap-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone="blue">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                    <span className="text-ink-muted">{q.points} điểm</span>
                    {q.mediaFileId && (mediaKind === "AUDIO" ? <Music className="size-4 text-ink-muted" aria-label="Có audio" /> : <ImageIcon className="size-4 text-ink-muted" aria-label="Có ảnh" />)}
                  </div>
                  {q.prompt && <p className="whitespace-pre-line text-ink">{q.prompt}</p>}
                  <Summary q={q} />
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <Button variant="ghost" size="icon" aria-label={`Lên câu ${i + 1}`} disabled={pending || i === 0} onClick={() => run(() => moveQuestionAction({ assignmentId, questionId: q.id!, direction: "up" }))}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Xuống câu ${i + 1}`} disabled={pending || i === items.length - 1} onClick={() => run(() => moveQuestionAction({ assignmentId, questionId: q.id!, direction: "down" }))}>
                    <ArrowDown />
                  </Button>
                  {!locked && (
                    <>
                      <Button variant="ghost" size="icon" aria-label={`Sửa câu ${i + 1}`} onClick={() => setEditing({ draft: q, mediaKind, key: Date.now() })}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Xóa câu ${i + 1}`}
                        disabled={pending}
                        onClick={() => confirm(`Xóa câu ${i + 1}?`) && run(() => deleteQuestionAction({ assignmentId, questionId: q.id! }))}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {editing && (
        <QuestionEditorDialog key={editing.key} assignmentId={assignmentId} initial={editing.draft} mediaKind={editing.mediaKind} open onOpenChange={(o) => !o && setEditing(null)} />
      )}
    </section>
  );
}

function Summary({ q }: { q: QuestionDraft }) {
  const muted = "text-sm text-ink-muted";
  switch (q.type) {
    case "MULTIPLE_CHOICE":
    case "MULTIPLE_SELECT":
      return (
        <ul className="grid gap-0.5 text-sm">
          {q.options.map((o, i) => (
            <li key={i} className={o.correct ? "font-medium text-success" : "text-ink-muted"}>
              {o.correct ? <Check className="mr-1 inline size-4" aria-label="Đúng" /> : <span className="mr-1 inline-block w-4" />}
              {String.fromCharCode(65 + i)}. {o.text}
            </li>
          ))}
        </ul>
      );
    case "TRUE_FALSE":
      return <p className={muted}>Đáp án: {q.correct ? "Đúng (True)" : "Sai (False)"}</p>;
    case "FILL_BLANK":
      return (
        <p className="text-sm text-ink">
          {parseFillTemplate(q.text).segments.map((s, i) =>
            typeof s === "string" ? (
              <span key={i}>{s}</span>
            ) : (
              <span key={i} className="mx-0.5 rounded-sm bg-success/10 px-1 font-medium text-success">
                {parseFillTemplate(q.text).blanks[s.blank]!.accepted.join(" / ")}
              </span>
            ),
          )}
        </p>
      );
    case "MATCHING":
      return <p className={muted}>{q.pairs.map((p) => `${p.left} → ${p.right}`).join(" · ")}</p>;
    case "ORDERING":
      return <p className={muted}>{q.items.join(" / ")}</p>;
    case "SHORT_ANSWER":
      return <p className={muted}>{q.acceptedAnswers.length ? `Tự chấm nếu khớp: ${q.acceptedAnswers.join(" / ")}` : "Giáo viên chấm tay"}</p>;
    case "WRITING":
      return <p className={muted}>Giáo viên chấm tay{q.minWords || q.maxWords ? ` · ${q.minWords ?? 0}–${q.maxWords ?? "∞"} từ` : ""}</p>;
    case "SPEAKING":
      return <p className={muted}>Ghi âm tối đa {q.maxDurationSec} giây · giáo viên chấm tay</p>;
    case "FILE_UPLOAD":
      return <p className={muted}>Tối đa {q.maxFiles} file · giáo viên chấm tay</p>;
  }
}
