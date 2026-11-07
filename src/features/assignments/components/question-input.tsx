"use client";

import { ArrowDown, ArrowUp, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FilePicker } from "@/components/uploader/file-picker";
import { cn } from "@/lib/utils";
import { countWords, type StudentQuestion } from "../questions";
import { Recorder } from "./recorder";

type Answer = Record<string, unknown> | null | undefined;
export type FileInfo = { id: string; name: string; kind: string };

const choiceCls = (checked: boolean) =>
  cn(
    "flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-[16px] transition-colors",
    checked ? "border-blue-600 bg-sky-100/70 font-medium text-ink" : "border-line bg-surface hover:bg-sky-50",
  );

/** Prompt + media of a question (shared by the attempt and the result screens). */
export function QuestionPrompt({ q, index }: { q: StudentQuestion; index: number }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold text-ink-muted">
        Câu {index} · {q.points} điểm
      </p>
      {q.prompt && <p className="text-[17px] leading-7 whitespace-pre-line text-ink">{q.prompt}</p>}
      {q.mediaFileId &&
        (q.mediaKind === "AUDIO" ? (
          <audio controls preload="metadata" src={`/api/files/${q.mediaFileId}`} className="w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/${q.mediaFileId}`} alt={`Hình minh họa câu ${index}`} className="max-h-72 w-auto justify-self-start rounded-md border border-line object-contain" />
        ))}
    </div>
  );
}

export function QuestionInput({
  q,
  value,
  onChange,
  files,
  onFiles,
}: {
  q: StudentQuestion;
  value: Answer;
  /** a value, or an updater (uploads finish one after another and must not overwrite each other) */
  onChange: (v: Answer | ((prev: Answer) => Answer)) => void;
  files: FileInfo[];
  onFiles: (add: FileInfo) => void;
}) {
  const name = `q-${q.id}`;
  switch (q.type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
      return (
        <div role="radiogroup" className="grid gap-2">
          {q.options!.map((o, i) => {
            const checked = value?.optionId === o.id;
            return (
              <label key={o.id} className={choiceCls(checked)}>
                <input type="radio" name={name} checked={checked} onChange={() => onChange({ optionId: o.id })} className="size-5 shrink-0 accent-[var(--blue-600)]" />
                {q.type === "MULTIPLE_CHOICE" && <span className="font-semibold text-ink-muted">{String.fromCharCode(65 + i)}.</span>}
                <span>{o.text}</span>
              </label>
            );
          })}
        </div>
      );
    case "MULTIPLE_SELECT": {
      const picked = new Set((value?.optionIds as string[] | undefined) ?? []);
      return (
        <div className="grid gap-2">
          <p className="text-sm text-ink-muted">Chọn tất cả đáp án đúng.</p>
          {q.options!.map((o, i) => (
            <label key={o.id} className={choiceCls(picked.has(o.id))}>
              <input
                type="checkbox"
                checked={picked.has(o.id)}
                onChange={(e) => {
                  const next = new Set(picked);
                  if (e.target.checked) next.add(o.id);
                  else next.delete(o.id);
                  onChange({ optionIds: [...next] });
                }}
                className="size-5 shrink-0 accent-[var(--blue-600)]"
              />
              <span className="font-semibold text-ink-muted">{String.fromCharCode(65 + i)}.</span>
              <span>{o.text}</span>
            </label>
          ))}
        </div>
      );
    }
    case "FILL_BLANK": {
      const blanks = (value?.blanks as Record<string, string> | undefined) ?? {};
      return (
        <p className="text-[17px] leading-[2.6rem] text-ink">
          {q.segments!.map((s, i) =>
            typeof s === "string" ? (
              <span key={i} className="whitespace-pre-line">
                {s}
              </span>
            ) : (
              <input
                key={i}
                value={blanks[String(s.blank)] ?? ""}
                onChange={(e) => onChange({ blanks: { ...blanks, [String(s.blank)]: e.target.value } })}
                aria-label={`Chỗ trống ${s.blank + 1}`}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="mx-1 inline-block h-10 w-36 rounded-md border border-line bg-surface px-2 align-middle text-[16px] focus-visible:outline-2 focus-visible:outline-ring"
              />
            ),
          )}
        </p>
      );
    }
    case "MATCHING": {
      const pairs = (value?.pairs as Record<string, string> | undefined) ?? {};
      return (
        <div className="grid gap-2">
          {q.left!.map((l) => (
            <div key={l.id} className="grid gap-1.5 rounded-md border border-line p-3 sm:grid-cols-[1fr_1fr] sm:items-center">
              <span className="font-medium text-ink">{l.text}</span>
              <NativeSelect
                value={pairs[l.id] ?? ""}
                onChange={(e) => {
                  const next = { ...pairs };
                  if (e.target.value) next[l.id] = e.target.value;
                  else delete next[l.id];
                  onChange({ pairs: next });
                }}
                aria-label={`Nối “${l.text}” với`}
              >
                <option value="">— Chọn —</option>
                {q.right!.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.text}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ))}
        </div>
      );
    }
    case "ORDERING": {
      const byId = new Map(q.items!.map((it) => [it.id, it]));
      const saved = (value?.order as string[] | undefined)?.filter((id) => byId.has(id));
      const order = saved && saved.length === q.items!.length ? saved : q.items!.map((it) => it.id);
      const move = (i: number, j: number) => {
        const next = [...order];
        [next[i], next[j]] = [next[j]!, next[i]!];
        onChange({ order: next });
      };
      return (
        <div className="grid gap-2">
          <p className="text-sm text-ink-muted">Dùng mũi tên để sắp xếp theo đúng thứ tự.</p>
          <ol className="grid gap-2">
            {order.map((id, i) => (
              <li key={id} className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5">
                <span className="w-6 text-sm text-ink-muted tabular-nums">{i + 1}.</span>
                <span className="flex-1 text-[16px] text-ink">{byId.get(id)!.text}</span>
                <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Đưa “${byId.get(id)!.text}” lên`}>
                  <ArrowUp />
                </Button>
                <Button type="button" variant="ghost" size="icon" disabled={i === order.length - 1} onClick={() => move(i, i + 1)} aria-label={`Đưa “${byId.get(id)!.text}” xuống`}>
                  <ArrowDown />
                </Button>
              </li>
            ))}
          </ol>
          {!saved && (
            <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => onChange({ order })}>
              Giữ nguyên thứ tự này
            </Button>
          )}
        </div>
      );
    }
    case "SHORT_ANSWER":
      return <Input value={(value?.text as string) ?? ""} onChange={(e) => onChange({ text: e.target.value })} aria-label="Câu trả lời" autoCapitalize="off" maxLength={2000} />;
    case "WRITING": {
      const text = (value?.text as string) ?? "";
      const words = countWords(text);
      const tooFew = q.minWords && words < q.minWords;
      const tooMany = q.maxWords && words > q.maxWords;
      return (
        <div className="grid gap-1.5">
          <Textarea value={text} onChange={(e) => onChange({ text: e.target.value })} rows={8} aria-label="Bài viết" maxLength={20000} className="text-[16px]" />
          <p className={cn("text-sm tabular-nums", tooFew || tooMany ? "text-warning" : "text-ink-muted")}>
            {words} từ
            {q.minWords || q.maxWords ? ` (yêu cầu ${q.minWords ?? 0}–${q.maxWords ?? "…"} từ)` : ""}
          </p>
        </div>
      );
    }
    case "SPEAKING":
      return <Recorder label={`Ghi âm cho câu hỏi`} fileId={(value?.fileId as string) ?? null} maxDurationSec={q.maxDurationSec ?? 120} onChange={(id) => onChange(id ? { fileId: id } : null)} />;
    case "FILE_UPLOAD": {
      const ids = (value?.fileIds as string[] | undefined) ?? [];
      const max = q.maxFiles ?? 3;
      const onlyImages = q.allow?.length === 1 && q.allow[0] === "IMAGE";
      return (
        <div className="grid gap-2">
          {ids.length > 0 && (
            <ul className="grid gap-2">
              {ids.map((id) => {
                const f = files.find((x) => x.id === id);
                return (
                  <li key={id} className="flex items-center gap-3 rounded-md border border-line p-2">
                    {f?.kind === "IMAGE" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/files/${id}`} alt={f.name} className="size-14 rounded-sm object-cover" />
                    ) : (
                      <FileText className="size-6 text-blue-600" aria-hidden />
                    )}
                    <span className="flex-1 truncate text-sm">{f?.name ?? "File"}</span>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Bỏ ${f?.name ?? "file"}`} onClick={() => onChange(ids.length > 1 ? { fileIds: ids.filter((x) => x !== id) } : null)}>
                      <X />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {ids.length < max && (
            <FilePicker
              purpose={onlyImages ? "submission-image" : "submission-file"}
              multiple={max - ids.length > 1}
              label={onlyImages ? "Chụp hoặc chọn ảnh" : "Chọn ảnh hoặc file"}
              onUploaded={(f) => {
                onFiles({ id: f.id, name: f.originalName, kind: f.kind });
                onChange((prev) => ({ fileIds: [...((prev?.fileIds as string[] | undefined) ?? []).filter((x) => x !== f.id), f.id].slice(0, max) }));
              }}
            />
          )}
          <p className="text-sm text-ink-muted">
            {ids.length}/{max} file
          </p>
        </div>
      );
    }
  }
}
