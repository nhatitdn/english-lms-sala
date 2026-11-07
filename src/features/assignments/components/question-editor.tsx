"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { FilePicker } from "@/components/uploader/file-picker";
import type { QuestionType } from "@/generated/prisma/enums";
import { saveQuestionAction } from "../actions";
import { parseFillTemplate, QUESTION_TYPE_LABELS, type QuestionDraft } from "../questions";

type Choice = { text: string; correct: boolean };

/** A blank draft for each type with sensible starting content. */
export function emptyDraft(type: QuestionType): QuestionDraft {
  const base = { prompt: "", points: 1, mediaFileId: null };
  switch (type) {
    case "MULTIPLE_CHOICE":
      return { ...base, type, options: [{ text: "", correct: true }, { text: "", correct: false }, { text: "", correct: false }] };
    case "MULTIPLE_SELECT":
      return { ...base, type, scoring: "PARTIAL", options: [{ text: "", correct: true }, { text: "", correct: true }, { text: "", correct: false }] };
    case "TRUE_FALSE":
      return { ...base, type, correct: true };
    case "FILL_BLANK":
      return { ...base, type, text: "", caseSensitive: false };
    case "MATCHING":
      return { ...base, type, pairs: [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }] };
    case "ORDERING":
      return { ...base, type, items: ["", "", ""] };
    case "SHORT_ANSWER":
      return { ...base, type, acceptedAnswers: [] };
    case "WRITING":
      return { ...base, type, points: 5 };
    case "SPEAKING":
      return { ...base, type, points: 5, maxDurationSec: 120 };
    case "FILE_UPLOAD":
      return { ...base, type, points: 5, maxFiles: 3, allow: ["IMAGE", "DOCUMENT"] };
  }
}

const PROMPT_HINT: Partial<Record<QuestionType, string>> = {
  MULTIPLE_CHOICE: "VD: Choose the correct answer: She ___ to school every day.",
  FILL_BLANK: "Hướng dẫn (không bắt buộc), VD: Fill in the blanks with the correct form of the verb.",
  MATCHING: "VD: Match the words with their meanings.",
  ORDERING: "VD: Put the words in the correct order to make a sentence.",
  WRITING: "VD: Write 60–80 words about your family.",
  SPEAKING: "VD: Introduce yourself in 1 minute (name, age, hobbies).",
  FILE_UPLOAD: "VD: Take a photo of your workbook page 24 and upload it.",
};

export function QuestionEditorDialog({
  assignmentId,
  initial,
  mediaKind,
  open,
  onOpenChange,
}: {
  assignmentId: string;
  initial: QuestionDraft;
  mediaKind?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [d, setD] = useState<QuestionDraft>(initial);
  const [media, setMedia] = useState<{ id: string; kind: string } | null>(initial.mediaFileId ? { id: initial.mediaFileId, kind: mediaKind ?? "IMAGE" } : null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const set = (patch: Partial<QuestionDraft>) => setD((prev) => ({ ...prev, ...patch }) as QuestionDraft);

  function save() {
    start(async () => {
      const question = { ...d, mediaFileId: media?.id ?? null } as QuestionDraft;
      if (question.type === "SHORT_ANSWER") question.acceptedAnswers = question.acceptedAnswers.map((s) => s.trim()).filter(Boolean);
      const r = await saveQuestionAction({ assignmentId, question });
      if (!r.ok) {
        const msgs = Object.values(r.error.fieldErrors ?? {}).flat();
        return void setErrors(msgs.length ? msgs : [r.error.message]);
      }
      toast.success(r.message);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{d.id ? "Sửa câu hỏi" : "Câu hỏi mới"}</DialogTitle>
          <DialogDescription>{QUESTION_TYPE_LABELS[d.type]}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field id="q-prompt" label={d.type === "FILL_BLANK" ? "Hướng dẫn" : "Câu hỏi / yêu cầu"} hint={PROMPT_HINT[d.type]}>
            <Textarea value={d.prompt} onChange={(e) => set({ prompt: e.target.value })} rows={2} />
          </Field>

          <TypeFields d={d} set={set} />

          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <Field id="q-points" label="Điểm">
              <Input type="number" min={0} max={100} step={0.25} inputMode="decimal" value={d.points} onChange={(e) => set({ points: Number(e.target.value) })} />
            </Field>
            <div className="grid gap-1.5">
              <Label>Ảnh hoặc audio cho câu hỏi (không bắt buộc)</Label>
              {media ? (
                <div className="flex items-center gap-3 rounded-md border border-line p-2">
                  {media.kind === "AUDIO" ? (
                    <audio controls preload="none" src={`/api/files/${media.id}`} className="h-10 flex-1" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/files/${media.id}`} alt="Ảnh câu hỏi" className="h-16 w-auto rounded-sm object-contain" />
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setMedia(null)}>
                    <X /> Bỏ
                  </Button>
                </div>
              ) : (
                <FilePicker purpose="question-media" label="Chọn ảnh hoặc file nghe" onUploaded={(f) => setMedia({ id: f.id, kind: f.kind })} />
              )}
            </div>
          </div>

          {["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE", "FILL_BLANK", "MATCHING", "ORDERING", "SHORT_ANSWER"].includes(d.type) && (
            <Field id="q-expl" label="Giải thích đáp án (hiện cho học viên khi được xem đáp án)">
              <Textarea value={d.explanation ?? ""} onChange={(e) => set({ explanation: e.target.value })} rows={2} />
            </Field>
          )}

          {errors.length > 0 && (
            <Alert tone="danger" title="Chưa lưu được">
              <ul className="list-disc pl-5">
                {[...new Set(errors)].map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button type="button" variant="primary" loading={pending} onClick={save}>
            Lưu câu hỏi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypeFields({ d, set }: { d: QuestionDraft; set: (p: Partial<QuestionDraft>) => void }) {
  switch (d.type) {
    case "MULTIPLE_CHOICE":
    case "MULTIPLE_SELECT": {
      const single = d.type === "MULTIPLE_CHOICE";
      const options = d.options as Choice[];
      const update = (i: number, patch: Partial<Choice>) =>
        set({ options: options.map((o, j) => (j === i ? { ...o, ...patch } : single && patch.correct ? { ...o, correct: false } : o)) } as Partial<QuestionDraft>);
      return (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">Các lựa chọn — đánh dấu {single ? "đáp án đúng" : "tất cả đáp án đúng"}</legend>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={single ? "radio" : "checkbox"}
                name="correct"
                checked={o.correct}
                onChange={(e) => update(i, { correct: e.target.checked })}
                className="size-5 accent-[var(--orange-700)]"
                aria-label={`Lựa chọn ${i + 1} là đáp án đúng`}
              />
              <Input value={o.text} onChange={(e) => update(i, { text: e.target.value })} placeholder={`Lựa chọn ${String.fromCharCode(65 + i)}`} aria-label={`Lựa chọn ${i + 1}`} />
              <Button type="button" variant="ghost" size="icon" disabled={options.length <= 2} onClick={() => set({ options: options.filter((_, j) => j !== i) } as Partial<QuestionDraft>)} aria-label="Xóa lựa chọn">
                <Trash2 />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="ghost" size="sm" disabled={options.length >= 8} onClick={() => set({ options: [...options, { text: "", correct: false }] } as Partial<QuestionDraft>)}>
              <Plus /> Thêm lựa chọn
            </Button>
            {d.type === "MULTIPLE_SELECT" && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={d.scoring === "PARTIAL"} onChange={(e) => set({ scoring: e.target.checked ? "PARTIAL" : "ALL_OR_NOTHING" } as Partial<QuestionDraft>)} />
                Tính điểm từng phần (chọn sai bị trừ)
              </label>
            )}
          </div>
        </fieldset>
      );
    }
    case "TRUE_FALSE":
      return (
        <fieldset className="flex gap-4">
          <legend className="mb-1 text-sm font-medium text-ink">Đáp án đúng</legend>
          {[true, false].map((v) => (
            <label key={String(v)} className="flex items-center gap-2">
              <input type="radio" name="tf" checked={d.correct === v} onChange={() => set({ correct: v } as Partial<QuestionDraft>)} className="size-5 accent-[var(--orange-700)]" />
              {v ? "Đúng (True)" : "Sai (False)"}
            </label>
          ))}
        </fieldset>
      );
    case "FILL_BLANK": {
      const blanks = parseFillTemplate(d.text).blanks;
      return (
        <div className="grid gap-2">
          <Field id="q-fill" label="Câu có chỗ trống" hint="Đặt đáp án trong [[ ]]. Nhiều đáp án chấp nhận thì ngăn cách bằng |. VD: She [[goes]] to school. I [[don't|do not]] like milk.">
            <Textarea value={d.text} onChange={(e) => set({ text: e.target.value } as Partial<QuestionDraft>)} rows={3} />
          </Field>
          <p className="text-sm text-ink-muted">
            {blanks.length ? `${blanks.length} chỗ trống: ${blanks.map((b, i) => `(${i + 1}) ${b.accepted.join(" / ")}`).join("  ")}` : "Chưa có chỗ trống nào."}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={d.caseSensitive} onChange={(e) => set({ caseSensitive: e.target.checked } as Partial<QuestionDraft>)} />
            Phân biệt chữ hoa / chữ thường
          </label>
        </div>
      );
    }
    case "MATCHING":
      return (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">Các cặp đúng (học viên sẽ thấy cột phải bị xáo trộn)</legend>
          {d.pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={p.left} onChange={(e) => set({ pairs: d.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)) } as Partial<QuestionDraft>)} placeholder="Vế trái" aria-label={`Cặp ${i + 1} vế trái`} />
              <span aria-hidden>→</span>
              <Input value={p.right} onChange={(e) => set({ pairs: d.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)) } as Partial<QuestionDraft>)} placeholder="Vế phải" aria-label={`Cặp ${i + 1} vế phải`} />
              <Button type="button" variant="ghost" size="icon" disabled={d.pairs.length <= 2} onClick={() => set({ pairs: d.pairs.filter((_, j) => j !== i) } as Partial<QuestionDraft>)} aria-label="Xóa cặp">
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" className="justify-self-start" disabled={d.pairs.length >= 12} onClick={() => set({ pairs: [...d.pairs, { left: "", right: "" }] } as Partial<QuestionDraft>)}>
            <Plus /> Thêm cặp
          </Button>
        </fieldset>
      );
    case "ORDERING":
      return (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">Các phần theo đúng thứ tự (học viên sẽ thấy bị xáo trộn)</legend>
          {d.items.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-right text-sm text-ink-muted tabular-nums">{i + 1}.</span>
              <Input value={t} onChange={(e) => set({ items: d.items.map((x, j) => (j === i ? e.target.value : x)) } as Partial<QuestionDraft>)} aria-label={`Phần ${i + 1}`} />
              <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => set({ items: swap(d.items, i, i - 1) } as Partial<QuestionDraft>)} aria-label="Lên">
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon" disabled={i === d.items.length - 1} onClick={() => set({ items: swap(d.items, i, i + 1) } as Partial<QuestionDraft>)} aria-label="Xuống">
                <ArrowDown />
              </Button>
              <Button type="button" variant="ghost" size="icon" disabled={d.items.length <= 2} onClick={() => set({ items: d.items.filter((_, j) => j !== i) } as Partial<QuestionDraft>)} aria-label="Xóa">
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" className="justify-self-start" disabled={d.items.length >= 15} onClick={() => set({ items: [...d.items, ""] } as Partial<QuestionDraft>)}>
            <Plus /> Thêm phần
          </Button>
        </fieldset>
      );
    case "SHORT_ANSWER":
      return (
        <Field id="q-accepted" label="Đáp án chấp nhận (mỗi dòng một đáp án)" hint="Khớp một đáp án → tự chấm đúng. Không khớp → chờ giáo viên chấm. Để trống nếu muốn chấm tay toàn bộ.">
          <Textarea
            value={d.acceptedAnswers.join("\n")}
            onChange={(e) => set({ acceptedAnswers: e.target.value.split("\n").map((s) => s.trimStart()).filter((s, i, arr) => s !== "" || i === arr.length - 1).slice(0, 10) } as Partial<QuestionDraft>)}
            rows={3}
          />
        </Field>
      );
    case "WRITING":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field id="q-min" label="Số từ tối thiểu">
            <Input type="number" min={0} inputMode="numeric" value={d.minWords ?? ""} onChange={(e) => set({ minWords: e.target.value === "" ? undefined : Number(e.target.value) } as Partial<QuestionDraft>)} />
          </Field>
          <Field id="q-max" label="Số từ tối đa">
            <Input type="number" min={0} inputMode="numeric" value={d.maxWords ?? ""} onChange={(e) => set({ maxWords: e.target.value === "" ? undefined : Number(e.target.value) } as Partial<QuestionDraft>)} />
          </Field>
        </div>
      );
    case "SPEAKING":
      return (
        <Field id="q-dur" label="Thời lượng ghi âm tối đa (giây)">
          <Input type="number" min={10} max={600} inputMode="numeric" value={d.maxDurationSec} onChange={(e) => set({ maxDurationSec: Number(e.target.value) } as Partial<QuestionDraft>)} />
        </Field>
      );
    case "FILE_UPLOAD":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="q-files" label="Số file tối đa">
            <Input type="number" min={1} max={10} inputMode="numeric" value={d.maxFiles} onChange={(e) => set({ maxFiles: Number(e.target.value) } as Partial<QuestionDraft>)} />
          </Field>
          <Field id="q-allow" label="Loại file">
            <NativeSelect
              value={d.allow.join(",")}
              onChange={(e) => set({ allow: e.target.value.split(",") as ("IMAGE" | "DOCUMENT")[] } as Partial<QuestionDraft>)}
            >
              <option value="IMAGE,DOCUMENT">Ảnh và tài liệu</option>
              <option value="IMAGE">Chỉ ảnh (chụp vở bài tập)</option>
              <option value="DOCUMENT">Chỉ tài liệu (PDF, Word…)</option>
            </NativeSelect>
          </Field>
        </div>
      );
  }
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const out = [...arr];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}
