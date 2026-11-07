"use client";

import { BarChart3, Eye, Headphones, Library, Link2, Pencil, Plus, Save, Send, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { FilePicker } from "@/components/uploader/file-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { searchLibraryAction } from "@/features/materials/actions";
import { MATERIAL_TYPE_LABELS, SKILL_LABELS, TRANSCRIPT_MODE_LABELS } from "@/lib/labels";
import type { ActionResult } from "@/server/action";
import {
  attachFileAction,
  attachLinkAction,
  attachMaterialAction,
  audioStatsAction,
  deleteAudioLessonAction,
  deleteLessonAction,
  detachMaterialAction,
  publishLessonAction,
  setLessonClassesAction,
  unpublishLessonAction,
  updateLessonAction,
  upsertAudioLessonAction,
} from "../actions";

export type EditorLesson = {
  id: string;
  title: string;
  description: string;
  skill: string;
  tags: string[];
  content: unknown;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  classIds: string[];
  visibleFrom: string; // datetime-local value (Vietnam time) or ""
  attachments: { materialId: string; title: string; type: keyof typeof MATERIAL_TYPE_LABELS; detail: string }[];
  audio: {
    id: string;
    title: string;
    audioFileId: string;
    audioName: string;
    coverFileId: string | null;
    instructions: string;
    transcript: string;
    transcriptMode: keyof typeof TRANSCRIPT_MODE_LABELS;
    completeThreshold: number;
  }[];
};

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, onOk?: (d: T) => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error.message);
      if (r.message) toast.success(r.message);
      onOk?.(r.data);
      router.refresh();
    });
  return { pending, run };
}

export function LessonEditor({ lesson, classes }: { lesson: EditorLesson; classes: { id: string; code: string; name: string }[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid content-start gap-4 lg:col-span-2">
        <ContentCard lesson={lesson} />
        <AudioCard lesson={lesson} />
        <AttachmentsCard lesson={lesson} />
      </div>
      <div className="grid content-start gap-4 lg:sticky lg:top-20 lg:self-start">
        <PublishCard lesson={lesson} classes={classes} />
      </div>
    </div>
  );
}

// ───────────────────────── Content ─────────────────────────

function ContentCard({ lesson }: { lesson: EditorLesson }) {
  const [content, setContent] = useState<unknown>(lesson.content);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function save(fd: FormData) {
    fd.set("id", lesson.id);
    const payload = { ...Object.fromEntries(fd.entries()), content };
    start(async () => {
      const r = await updateLessonAction(payload);
      if (!r.ok) {
        setErrors(r.error.fieldErrors ?? {});
        return void toast.error(r.error.message);
      }
      setErrors({});
      setDirty(false);
      toast.success(r.message);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nội dung bài giảng</CardTitle>
        {dirty && <Badge tone="orange">Chưa lưu</Badge>}
      </CardHeader>
      <CardContent>
        <form action={save} onChange={() => setDirty(true)} className="grid gap-4">
          <Field id="title" label="Tiêu đề" required error={errors.title}>
            <Input name="title" defaultValue={lesson.title} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="skill" label="Phân loại">
              <NativeSelect name="skill" defaultValue={lesson.skill}>
                {Object.entries(SKILL_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="tags" label="Chủ đề" hint="Cách nhau bằng dấu phẩy, VD: family, unit 3">
              <Input name="tags" defaultValue={lesson.tags.join(", ")} />
            </Field>
          </div>
          <Field id="description" label="Mô tả ngắn" error={errors.description}>
            <Input name="description" defaultValue={lesson.description} placeholder="Học sinh sẽ học được gì trong bài này?" />
          </Field>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-ink">Nội dung</span>
            <RichTextEditor
              initial={lesson.content}
              onChange={(json) => {
                setContent(json);
                setDirty(true);
              }}
              placeholder="Soạn nội dung bài giảng: từ vựng, ngữ pháp, ví dụ… Có thể chèn ảnh."
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant={dirty ? "primary" : "outline"} loading={pending}>
              <Save /> Lưu nội dung
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Publish & classes ─────────────────────────

function PublishCard({ lesson, classes }: { lesson: EditorLesson; classes: { id: string; code: string; name: string }[] }) {
  const { pending, run } = useRun();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const published = lesson.status === "PUBLISHED";

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Lớp & xuất bản</CardTitle>
          <CardDescription>Học viên chỉ thấy bài đã xuất bản, ở lớp được chọn.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center justify-between gap-2">
          <Badge tone={published ? "success" : "gold"}>{published ? "Đã xuất bản" : "Bản nháp"}</Badge>
          <Link href={`/app/lessons/${lesson.id}`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <Eye className="size-4" /> Xem như học viên
          </Link>
        </div>
        <form
          className="grid gap-3"
          action={(fd) => {
            fd.set("lessonId", lesson.id);
            const local = fd.get("visibleFromLocal");
            fd.delete("visibleFromLocal");
            if (typeof local === "string" && local) fd.set("visibleFrom", `${local}:00+07:00`);
            run(() => setLessonClassesAction(fd));
          }}
        >
          {classes.length === 0 ? (
            <p className="text-sm text-ink-muted">Bạn chưa quản lý lớp nào.</p>
          ) : (
            <fieldset className="grid gap-1">
              <legend className="mb-1 text-sm font-medium text-ink">Lớp được xem</legend>
              {classes.map((c) => (
                <label key={c.id} className="flex min-h-9 items-center gap-2 text-sm text-ink">
                  <Checkbox name="classIds" value={c.id} defaultChecked={lesson.classIds.includes(c.id)} />
                  {c.code} · {c.name}
                </label>
              ))}
            </fieldset>
          )}
          <Field id="visibleFromLocal" label="Hiện với học viên từ" hint="Để trống: hiện ngay khi xuất bản.">
            <Input name="visibleFromLocal" type="datetime-local" defaultValue={lesson.visibleFrom} />
          </Field>
          <Button type="submit" variant="outline" loading={pending}>
            Lưu lớp được xem
          </Button>
        </form>
        {published ? (
          <Button variant="outline" disabled={pending} onClick={() => run(() => unpublishLessonAction({ lessonId: lesson.id }))}>
            <Undo2 /> Chuyển về bản nháp
          </Button>
        ) : (
          <Button variant="primary" disabled={pending} onClick={() => run(() => publishLessonAction({ lessonId: lesson.id }))}>
            <Send /> Xuất bản
          </Button>
        )}
        {!published && lesson.classIds.length === 0 && <Alert tone="info">Chưa chọn lớp: sau khi xuất bản, chỉ giáo viên thấy bài này.</Alert>}
        <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 /> Xóa bài giảng
        </Button>
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xóa bài giảng?</DialogTitle>
              <DialogDescription>Bài giảng bị ẩn khỏi mọi lớp. Tài liệu trong thư viện vẫn được giữ lại.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Hủy</Button>
              </DialogClose>
              <Button variant="destructive" loading={pending} onClick={() => run(() => deleteLessonAction({ lessonId: lesson.id }), () => router.push("/app/lessons"))}>
                Xóa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Attachments ─────────────────────────

function AttachmentsCard({ lesson }: { lesson: EditorLesson }) {
  const { pending, run } = useRun();
  const [linkOpen, setLinkOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Tài liệu đính kèm</CardTitle>
          <CardDescription>PDF, Word, PowerPoint, MP3, video, ảnh, link YouTube. File tải lên được lưu vào thư viện để dùng lại.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {lesson.attachments.length > 0 && (
          <ul className="divide-y divide-line rounded-md border border-line">
            {lesson.attachments.map((a) => (
              <li key={a.materialId} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="grid min-w-0">
                  <span className="truncate text-ink">{a.title}</span>
                  <span className="truncate text-xs text-ink-muted">
                    {MATERIAL_TYPE_LABELS[a.type]} · {a.detail}
                  </span>
                </span>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => detachMaterialAction({ lessonId: lesson.id, materialId: a.materialId }))} aria-label={`Gỡ ${a.title}`}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <FilePicker purpose="material" multiple onUploaded={async (f) => run(() => attachFileAction({ lessonId: lesson.id, fileId: f.id }))} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setLinkOpen(true)}>
            <Link2 /> Thêm link YouTube / website
          </Button>
          <Button variant="outline" onClick={() => setLibOpen(true)}>
            <Library /> Chọn từ thư viện
          </Button>
        </div>
        <LinkDialog open={linkOpen} onOpenChange={setLinkOpen} lessonId={lesson.id} />
        <LibraryDialog open={libOpen} onOpenChange={setLibOpen} lessonId={lesson.id} attachedIds={lesson.attachments.map((a) => a.materialId)} />
      </CardContent>
    </Card>
  );
}

function LinkDialog({ open, onOpenChange, lessonId }: { open: boolean; onOpenChange: (o: boolean) => void; lessonId: string }) {
  const { pending, run } = useRun();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm link</DialogTitle>
          <DialogDescription>Link YouTube sẽ được nhúng để học viên xem ngay trong bài.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          action={(fd) => {
            fd.set("lessonId", lessonId);
            run(() => attachLinkAction(fd), () => onOpenChange(false));
          }}
        >
          <Field id="url" label="Đường link" required>
            <Input name="url" type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" />
          </Field>
          <Field id="linkTitle" label="Tiêu đề" required>
            <Input name="title" placeholder="Video: Family members song" />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="primary" loading={pending}>
              Thêm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LibraryDialog({ open, onOpenChange, lessonId, attachedIds }: { open: boolean; onOpenChange: (o: boolean) => void; lessonId: string; attachedIds: string[] }) {
  const { pending, run } = useRun();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<{ id: string; title: string; type: keyof typeof MATERIAL_TYPE_LABELS; fileName: string }[]>([]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const r = await searchLibraryAction({ q: q || undefined, page: 1 });
      if (r.ok) setItems(r.data);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Chọn từ thư viện</DialogTitle>
        </DialogHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm (không cần gõ dấu)…" aria-label="Tìm trong thư viện" />
        <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-md border border-line">
          {items.length === 0 && <li className="p-3 text-sm text-ink-muted">Không có tài liệu phù hợp.</li>}
          {items.map((m) => {
            const attached = attachedIds.includes(m.id);
            return (
              <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="grid min-w-0">
                  <span className="truncate text-ink">{m.title}</span>
                  <span className="truncate text-xs text-ink-muted">
                    {MATERIAL_TYPE_LABELS[m.type]} · {m.fileName}
                  </span>
                </span>
                <Button size="sm" variant="secondary" disabled={attached || pending} onClick={() => run(() => attachMaterialAction({ lessonId, materialId: m.id }))}>
                  {attached ? "Đã đính kèm" : "Đính kèm"}
                </Button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Listening items ─────────────────────────

function AudioCard({ lesson }: { lesson: EditorLesson }) {
  const { pending, run } = useRun();
  const [editing, setEditing] = useState<EditorLesson["audio"][number] | "new" | null>(null);
  const [statsFor, setStatsFor] = useState<{ id: string; title: string } | null>(null);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="size-5 text-orange-700" /> Bài nghe (Listening)
          </CardTitle>
          <CardDescription>File MP3 + hướng dẫn + transcript. Học viên nghe trực tiếp, chỉnh tốc độ; hệ thống ghi nhận ai đã nghe xong.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {lesson.audio.length > 0 && (
          <ul className="divide-y divide-line rounded-md border border-line">
            {lesson.audio.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="grid min-w-0">
                  <span className="truncate font-medium text-ink">{a.title}</span>
                  <span className="truncate text-xs text-ink-muted">
                    {a.audioName} · transcript: {TRANSCRIPT_MODE_LABELS[a.transcriptMode].toLowerCase()}
                  </span>
                </span>
                <span className="flex shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setStatsFor({ id: a.id, title: a.title })} aria-label={`Thống kê ${a.title}`}>
                    <BarChart3 />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(a)} aria-label={`Sửa ${a.title}`}>
                    <Pencil />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => run(() => deleteAudioLessonAction({ lessonId: lesson.id, audioLessonId: a.id }))} aria-label={`Xóa ${a.title}`}>
                    <Trash2 />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" onClick={() => setEditing("new")} className="justify-self-start">
          <Plus /> Thêm bài nghe
        </Button>
        {editing && <AudioDialog lessonId={lesson.id} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
        {statsFor && <AudioStatsDialog item={statsFor} onClose={() => setStatsFor(null)} />}
      </CardContent>
    </Card>
  );
}

function AudioDialog({ lessonId, item, onClose }: { lessonId: string; item: EditorLesson["audio"][number] | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [audio, setAudio] = useState<{ id: string; name: string } | null>(item ? { id: item.audioFileId, name: item.audioName } : null);
  const [cover, setCover] = useState<string | null>(item?.coverFileId ?? null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Sửa bài nghe" : "Thêm bài nghe"}</DialogTitle>
          <DialogDescription>Câu hỏi và chấm điểm cho bài nghe có ở giai đoạn 3 (bài tập Listening Quiz).</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          action={(fd) => {
            fd.set("lessonId", lessonId);
            if (item) fd.set("audioLessonId", item.id);
            fd.set("audioFileId", audio?.id ?? "");
            fd.set("coverFileId", cover ?? "");
            start(async () => {
              const r = await upsertAudioLessonAction(fd);
              if (!r.ok) {
                setErrors(r.error.fieldErrors ?? {});
                toast.error(r.error.message);
                return;
              }
              toast.success(r.message);
              router.refresh();
              onClose();
            });
          }}
        >
          <Field id="audioTitle" label="Tên bài nghe" required error={errors.title}>
            <Input name="title" defaultValue={item?.title} placeholder="At the zoo — Listening 5" />
          </Field>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-ink">
              File âm thanh <span className="text-danger">*</span>
            </span>
            {audio ? (
              <div className="flex items-center justify-between gap-2 rounded-md bg-sky-50 px-3 py-2 text-sm">
                <span className="truncate text-ink">{audio.name}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAudio(null)}>
                  Đổi file
                </Button>
              </div>
            ) : (
              <FilePicker purpose="audio" label="Chọn file MP3 / M4A" onUploaded={(f) => setAudio({ id: f.id, name: f.originalName })} />
            )}
            {errors.audioFileId && <p className="text-sm text-danger">{errors.audioFileId[0]}</p>}
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-ink">Hình minh họa (không bắt buộc)</span>
            {cover ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/${cover}`} alt="" className="h-16 w-28 rounded-md object-cover" />
                <Button type="button" size="sm" variant="ghost" onClick={() => setCover(null)}>
                  Bỏ ảnh
                </Button>
              </div>
            ) : (
              <FilePicker purpose="audio-cover" label="Chọn ảnh" onUploaded={(f) => setCover(f.id)} />
            )}
          </div>
          <Field id="instructions" label="Hướng dẫn">
            <Textarea name="instructions" defaultValue={item?.instructions} rows={3} placeholder="Nghe đoạn hội thoại 2 lần, ghi lại tên các con vật bạn nghe được." />
          </Field>
          <Field id="transcript" label="Transcript" hint="Mỗi dòng một câu.">
            <Textarea name="transcript" defaultValue={item?.transcript} rows={6} className="font-mono text-sm" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="transcriptMode" label="Học viên thấy transcript">
              <NativeSelect name="transcriptMode" defaultValue={item?.transcriptMode ?? "AFTER_COMPLETE"}>
                {Object.entries(TRANSCRIPT_MODE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="completeThreshold" label="Tính là đã nghe xong khi nghe được (%)">
              <Input name="completeThreshold" type="number" min={10} max={100} defaultValue={item?.completeThreshold ?? 90} />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Hủy
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending} disabled={!audio}>
              Lưu bài nghe
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AudioStatsDialog({ item, onClose }: { item: { id: string; title: string }; onClose: () => void }) {
  const [rows, setRows] = useState<{ studentId: string; name: string; progress: { completedAt: Date | null; playCount: number; listenedSec: number } | null }[] | null>(null);
  useEffect(() => {
    void audioStatsAction({ audioLessonId: item.id }).then((r) => setRows(r.ok ? r.data : []));
  }, [item.id]);
  const done = rows?.filter((r) => r.progress?.completedAt).length ?? 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.title}</DialogTitle>
          <DialogDescription>{rows ? `${done}/${rows.length} học viên đã nghe xong` : "Đang tải…"}</DialogDescription>
        </DialogHeader>
        {rows && rows.length === 0 && <p className="text-sm text-ink-muted">Bài giảng chưa được gán cho lớp nào bạn quản lý.</p>}
        {rows && rows.length > 0 && (
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {rows.map((r) => (
              <li key={r.studentId} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="text-ink">{r.name}</span>
                {r.progress?.completedAt ? (
                  <Badge tone="success">Đã nghe xong</Badge>
                ) : r.progress ? (
                  <Badge tone="orange">Đang nghe · {Math.round(r.progress.listenedSec / 60)} phút</Badge>
                ) : (
                  <Badge>Chưa nghe</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Đóng</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
