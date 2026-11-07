import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { AudioPlayer } from "@/features/audio/components/audio-player";
import { AssignmentSettingsForm } from "@/features/assignments/components/assignment-settings";
import { AssignmentStatusActions } from "@/features/assignments/components/assignment-actions";
import { QuestionList } from "@/features/assignments/components/question-list";
import { TargetsPanel } from "@/features/assignments/components/targets-panel";
import { getAssignmentBuilder } from "@/features/assignments/queries";
import { ASSIGNMENT_KIND_LABELS, ASSIGNMENT_STATUS_LABELS } from "@/lib/labels";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Soạn bài tập" };

export default async function AssignmentBuilderPage({ params }: PageProps<"/app/assignments/[assignmentId]/edit">) {
  const user = await requireRole("ADMIN", "TEACHER");
  const { assignmentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(assignmentId)) notFound();
  const data = await getAssignmentBuilder(user, assignmentId);
  if (!data) notFound();
  const { assignment: a, questions, targets, classes, locked, totalPoints } = data;

  return (
    <div className="grid gap-5">
      <div>
        <Link href={`/app/assignments/${a.id}`} className="text-sm text-blue-600 hover:underline">
          ← Kết quả bài tập
        </Link>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-1">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="blue">{ASSIGNMENT_KIND_LABELS[a.kind]}</Badge>
              <Badge tone={a.status === "PUBLISHED" ? "success" : a.status === "DRAFT" ? "gold" : "neutral"}>{ASSIGNMENT_STATUS_LABELS[a.status]}</Badge>
              <span className="text-ink-muted">
                {questions.length} câu · {totalPoints} điểm → thang {a.maxScore}
              </span>
            </p>
            <h1 className="text-2xl leading-8 font-semibold text-ink">{a.title}</h1>
          </div>
          <AssignmentStatusActions assignmentId={a.id} status={a.status} answerReveal={a.answerReveal} answersReleased={!!a.answersReleasedAt} hasSubmissions={locked} />
        </div>
      </div>

      {locked && <Alert tone="warning">Đã có học viên làm bài nên câu hỏi bị khóa (chỉ đổi được thứ tự). Muốn sửa câu hỏi: bấm “Nhân bản” để tạo bản mới.</Alert>}
      {a.status === "DRAFT" && <Alert tone="info">Bản nháp — học viên chưa thấy. Thêm câu hỏi, chọn lớp và hạn nộp, rồi bấm “Đăng bài tập”.</Alert>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid content-start gap-5">
          {a.audioLesson && (
            <Card>
              <CardHeader>
                <CardTitle>Bài nghe</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <AudioPlayer
                  audioLessonId={a.audioLesson.id}
                  src={`/api/files/${a.audioLesson.audioFileId}`}
                  coverSrc={a.audioLesson.coverFileId ? `/api/files/${a.audioLesson.coverFileId}` : null}
                  title={a.audioLesson.title}
                  transcriptMode="HIDDEN"
                  trackProgress={false}
                />
                <Link href={`/app/lessons/${a.audioLesson.lessonId}/edit`} className={buttonVariants({ variant: "link", className: "justify-self-start" })}>
                  Sửa bài nghe trong bài giảng
                </Link>
              </CardContent>
            </Card>
          )}
          <QuestionList assignmentId={a.id} items={questions} locked={locked} />
        </div>
        <div className="grid content-start gap-5">
          <Card>
            <CardContent className="pt-5">
              <TargetsPanel assignmentId={a.id} targets={targets} classes={classes} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cài đặt</CardTitle>
            </CardHeader>
            <CardContent>
              <AssignmentSettingsForm
                value={{
                  id: a.id,
                  title: a.title,
                  description: a.description,
                  kind: a.kind,
                  maxScore: a.maxScore,
                  timeLimitMin: a.timeLimitMin,
                  maxAttempts: a.maxAttempts,
                  allowLate: a.allowLate,
                  answerReveal: a.answerReveal,
                  shuffleQuestions: a.shuffleQuestions,
                  shuffleOptions: a.shuffleOptions,
                }}
                totalPoints={totalPoints}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
