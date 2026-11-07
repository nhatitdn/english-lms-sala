import { BookOpen, Headphones, Paperclip } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/design-system/states";
import { Badge } from "@/components/ui/badge";
import { NewLessonDialog } from "@/features/lessons/components/new-lesson-dialog";
import { lessonsForClass, manageableClasses } from "@/features/lessons/queries";
import { getClassHeader } from "@/features/classes/queries";
import { formatDate } from "@/lib/datetime";
import { LESSON_STATUS_LABELS, SKILL_LABELS } from "@/lib/labels";
import { requireUser } from "@/server/auth/current-user";

export default async function ClassLessonsPage({ params }: PageProps<"/app/classes/[classId]/lessons">) {
  const user = await requireUser();
  const { classId } = await params;
  const header = await getClassHeader(user, classId);
  if (!header || user.role === "PARENT") notFound();
  const lessons = await lessonsForClass(user, classId);
  const manager = header.access.canManage;
  const classes = manager ? await manageableClasses(user) : [];
  const now = new Date();

  return (
    <div className="grid gap-4">
      {manager && (
        <div className="flex justify-end">
          <NewLessonDialog classes={classes} defaultClassId={classId} />
        </div>
      )}
      {lessons.length === 0 ? (
        <EmptyState icon={BookOpen} title="Chưa có bài giảng" description={manager ? "Tạo bài giảng mới hoặc gán bài có sẵn cho lớp này." : "Giáo viên sẽ đăng bài giảng ở đây."} />
      ) : (
        <ul className="grid gap-2">
          {lessons.map((l) => {
            const visibleFrom = l.classes[0]?.visibleFrom;
            const scheduled = visibleFrom && visibleFrom > now;
            return (
              <li key={l.id}>
                <Link href={`/app/lessons/${l.id}`} className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-4 shadow-card hover:shadow-raised">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue">{SKILL_LABELS[l.skill]}</Badge>
                    {manager && l.status !== "PUBLISHED" && <Badge tone="gold">{LESSON_STATUS_LABELS[l.status]}</Badge>}
                    {manager && scheduled && <Badge tone="orange">Hiện từ {formatDate(visibleFrom, "HH:mm dd/MM")}</Badge>}
                  </span>
                  <span className="font-semibold text-ink">{l.title}</span>
                  {l.description && <span className="text-sm text-ink-muted">{l.description}</span>}
                  <span className="flex items-center gap-3 text-sm text-ink-muted">
                    {l.publishedAt && <span>{formatDate(l.publishedAt)}</span>}
                    {l._count.audioLessons > 0 && (
                      <span className="flex items-center gap-1">
                        <Headphones className="size-4" /> {l._count.audioLessons} bài nghe
                      </span>
                    )}
                    {l._count.attachments > 0 && (
                      <span className="flex items-center gap-1">
                        <Paperclip className="size-4" /> {l._count.attachments} tài liệu
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
