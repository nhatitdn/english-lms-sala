import { Headphones, Paperclip, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichTextRenderer } from "@/components/editor/rich-text-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { AudioPlayer } from "@/features/audio/components/audio-player";
import { AttachmentList } from "@/features/lessons/components/attachment-list";
import { DuplicateLessonButton } from "@/features/lessons/components/lesson-header-actions";
import { getLessonDetail } from "@/features/lessons/queries";
import { formatDate } from "@/lib/datetime";
import { LESSON_STATUS_LABELS, SKILL_LABELS } from "@/lib/labels";
import { requireUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Bài giảng" };

export default async function LessonPage({ params }: PageProps<"/app/lessons/[lessonId]">) {
  const user = await requireUser();
  const { lessonId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) notFound();
  const data = await getLessonDetail(user, lessonId);
  if (!data) notFound();
  const { lesson, canEdit } = data;
  const staff = user.role === "ADMIN" || user.role === "TEACHER";

  return (
    <article className="mx-auto grid max-w-3xl gap-5">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">{SKILL_LABELS[lesson.skill]}</Badge>
          {staff && <Badge tone={lesson.status === "PUBLISHED" ? "success" : "gold"}>{LESSON_STATUS_LABELS[lesson.status]}</Badge>}
          {lesson.tags.map((t) => (
            <Badge key={t}>#{t}</Badge>
          ))}
        </div>
        <h1 className="text-2xl leading-8 font-semibold text-ink sm:text-3xl sm:leading-10">{lesson.title}</h1>
        {lesson.description && <p className="text-ink-muted">{lesson.description}</p>}
        <p className="text-sm text-ink-muted">
          {lesson.author.fullName}
          {lesson.publishedAt && ` · ${formatDate(lesson.publishedAt)}`}
          {staff && lesson.classes.length > 0 && ` · ${lesson.classes.map((c) => c.class.code).join(", ")}`}
        </p>
        {staff && (
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Link href={`/app/lessons/${lesson.id}/edit`} className={buttonVariants({ variant: "primary" })}>
                <Pencil /> Sửa bài giảng
              </Link>
            )}
            <DuplicateLessonButton lessonId={lesson.id} />
          </div>
        )}
        {staff && lesson.status !== "PUBLISHED" && <Alert tone="info">Bài giảng đang là bản nháp — học viên chưa thấy.</Alert>}
      </header>

      {!!lesson.content && <RichTextRenderer doc={lesson.content} />}

      {lesson.audioLessons.length > 0 && (
        <section className="grid gap-3" aria-labelledby="listening">
          <h2 id="listening" className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Headphones className="size-5 text-orange-700" /> Luyện nghe
          </h2>
          {lesson.audioLessons.map((a) => {
            const progress = "progress" in a ? (a.progress as { positionSec: number; completedAt: Date | null }[])[0] : undefined;
            return (
              <div key={a.id} className="grid gap-2">
                {!!a.instructions && (
                  <div className="rounded-md bg-sky-50 p-3">
                    <RichTextRenderer doc={a.instructions} className="text-[16px]" />
                  </div>
                )}
                <AudioPlayer
                  audioLessonId={a.id}
                  src={`/api/files/${a.audioFileId}`}
                  coverSrc={a.coverFileId ? `/api/files/${a.coverFileId}` : null}
                  title={a.title}
                  initialPosition={progress?.positionSec ?? 0}
                  initiallyCompleted={!!progress?.completedAt}
                  transcript={a.transcript}
                  transcriptMode={a.transcriptMode}
                  trackProgress={user.role === "STUDENT"}
                />
              </div>
            );
          })}
        </section>
      )}

      {lesson.attachments.length > 0 && (
        <section className="grid gap-3" aria-labelledby="attachments">
          <h2 id="attachments" className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Paperclip className="size-5 text-blue-600" /> Tài liệu đính kèm
          </h2>
          <AttachmentList items={lesson.attachments.map((a) => a.material)} />
        </section>
      )}
    </article>
  );
}
