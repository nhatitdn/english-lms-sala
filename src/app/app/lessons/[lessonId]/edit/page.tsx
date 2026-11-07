import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonEditor } from "@/features/lessons/components/lesson-editor";
import { getLessonDetail, manageableClasses } from "@/features/lessons/queries";
import { formatDate } from "@/lib/datetime";
import { formatBytes } from "@/lib/format";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Soạn bài giảng" };

/** Rich-text paragraphs back to plain lines for the textarea fields. */
function docToLines(doc: unknown): string {
  const d = doc as { content?: { content?: { text?: string }[] }[] } | null;
  if (!d?.content) return "";
  return d.content.map((p) => (p.content ?? []).map((t) => t.text ?? "").join("")).join("\n");
}

export default async function EditLessonPage({ params }: PageProps<"/app/lessons/[lessonId]/edit">) {
  const user = await requireRole("ADMIN", "TEACHER");
  const { lessonId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) notFound();
  const data = await getLessonDetail(user, lessonId);
  if (!data?.canEdit) notFound();
  const { lesson } = data;
  const classes = await manageableClasses(user);
  const firstVisible = lesson.classes.find((c) => c.visibleFrom)?.visibleFrom ?? null;

  return (
    <>
      <Link href={`/app/lessons/${lesson.id}`} className="text-sm text-blue-600 hover:underline">
        ← Xem bài giảng
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-semibold text-ink">Soạn bài giảng</h1>
      <p className="mb-5 text-sm text-ink-muted">Cập nhật {formatDate(lesson.updatedAt, "HH:mm dd/MM/yyyy")}</p>
      <LessonEditor
        classes={classes}
        lesson={{
          id: lesson.id,
          title: lesson.title,
          description: lesson.description ?? "",
          skill: lesson.skill,
          tags: lesson.tags,
          content: lesson.content,
          status: lesson.status,
          classIds: lesson.classes.map((c) => c.classId),
          visibleFrom: firstVisible ? formatDate(firstVisible, "yyyy-MM-dd'T'HH:mm") : "",
          attachments: lesson.attachments.map((a) => ({
            materialId: a.material.id,
            title: a.material.title,
            type: a.material.type,
            detail: a.material.file ? `${a.material.file.originalName} · ${formatBytes(Number(a.material.file.sizeBytes))}` : (a.material.url ?? ""),
          })),
          audio: lesson.audioLessons.map((a) => ({
            id: a.id,
            title: a.title,
            audioFileId: a.audioFileId,
            audioName: a.audioFile.originalName,
            coverFileId: a.coverFileId,
            instructions: docToLines(a.instructions),
            transcript: docToLines(a.transcript),
            transcriptMode: a.transcriptMode,
            completeThreshold: a.completeThreshold,
          })),
        }}
      />
    </>
  );
}
