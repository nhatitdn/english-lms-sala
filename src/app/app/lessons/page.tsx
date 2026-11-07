import { BookOpen, Headphones, Paperclip, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/design-system/states";
import { PageHeader } from "@/components/design-system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NewLessonDialog } from "@/features/lessons/components/new-lesson-dialog";
import { listLessonsForStaff, manageableClasses } from "@/features/lessons/queries";
import { lessonListSchema } from "@/features/lessons/schemas";
import { formatDate } from "@/lib/datetime";
import { LESSON_STATUS_LABELS, SKILL_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Bài giảng" };

export default async function LessonsPage({ searchParams }: PageProps<"/app/lessons">) {
  const user = await requireRole("ADMIN", "TEACHER");
  const query = lessonListSchema.parse(await searchParams);
  const [lessons, classes] = await Promise.all([listLessonsForStaff(user, query), manageableClasses(user)]);

  return (
    <>
      <PageHeader title="Bài giảng" description="Soạn một lần, dùng cho nhiều lớp." actions={<NewLessonDialog classes={classes} />} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <nav className="flex gap-2" aria-label="Phạm vi">
          {(["mine", "all"] as const).map((s) => (
            <Link
              key={s}
              href={`/app/lessons?scope=${s}${query.q ? `&q=${encodeURIComponent(query.q)}` : ""}`}
              className={cn("inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium", query.scope === s ? "border-blue-600 bg-sky-100 text-blue-700" : "border-line bg-surface text-ink")}
            >
              {s === "mine" ? "Của tôi" : "Tất cả bài đã xuất bản"}
            </Link>
          ))}
        </nav>
        <form className="flex flex-1 gap-2" role="search">
          <input type="hidden" name="scope" value={query.scope} />
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input name="q" defaultValue={query.q} placeholder="Tìm theo tiêu đề hoặc chủ đề" className="pl-9" aria-label="Tìm bài giảng" />
          </div>
          <Button type="submit">Tìm</Button>
        </form>
      </div>
      {lessons.length === 0 ? (
        <EmptyState icon={BookOpen} title="Chưa có bài giảng" description="Tạo bài giảng đầu tiên, rồi chọn lớp được xem." />
      ) : (
        <ul className="grid gap-2">
          {lessons.map((l) => (
            <li key={l.id}>
              <Link href={`/app/lessons/${l.id}`} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 shadow-card hover:shadow-raised sm:flex-row sm:items-center">
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="truncate font-semibold text-ink">{l.title}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                    <Badge tone="blue">{SKILL_LABELS[l.skill]}</Badge>
                    <Badge tone={l.status === "PUBLISHED" ? "success" : "gold"}>{LESSON_STATUS_LABELS[l.status]}</Badge>
                    {l.classes.length > 0 ? l.classes.map((c) => c.class.code).join(", ") : "Chưa gán lớp"}
                    {l.author.id !== user.id && ` · ${l.author.fullName}`}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3 text-sm text-ink-muted">
                  <span className="flex items-center gap-1" title="Tài liệu đính kèm">
                    <Paperclip className="size-4" /> {l._count.attachments}
                  </span>
                  <span className="flex items-center gap-1" title="Bài nghe">
                    <Headphones className="size-4" /> {l._count.audioLessons}
                  </span>
                  <span>{formatDate(l.updatedAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
