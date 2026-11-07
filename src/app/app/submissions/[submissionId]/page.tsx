import { CheckCircle2, MessageSquare, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { AnswerDisplay } from "@/features/assignments/components/answer-display";
import { GradingForm } from "@/features/assignments/components/grading-form";
import { QuestionPrompt } from "@/features/assignments/components/question-input";
import { getSubmissionDetail, gradingQueue } from "@/features/assignments/queries";
import { formatDateTime } from "@/lib/datetime";
import { formatScore } from "@/lib/format";
import { SUBMISSION_STATUS_LABELS, SUBMISSION_STATUS_TONES } from "@/lib/labels";
import { requireUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Bài làm" };

type Detail = Exclude<Awaited<ReturnType<typeof getSubmissionDetail>>, null | { inProgress: true }>;
type ItemT = Detail["items"][number];

function Feedback({ list }: { list: { id: string; content: string; author: { fullName: string }; createdAt: Date }[] }) {
  if (!list.length) return null;
  return (
    <ul className="grid gap-2">
      {list.map((f) => (
        <li key={f.id} className="flex gap-2 rounded-md bg-petal/60 p-3 text-[15px]">
          <MessageSquare className="mt-0.5 size-4 shrink-0 text-gold-700" aria-hidden />
          <span className="grid gap-0.5">
            <span className="whitespace-pre-line text-ink">{f.content}</span>
            <span className="text-xs text-ink-muted">
              {f.author.fullName} · {formatDateTime(f.createdAt)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function QuestionBody({ item, showPoints }: { item: ItemT; showPoints: boolean }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <QuestionPrompt q={item.question} index={item.index} />
        {item.isCorrect !== null &&
          (item.isCorrect ? (
            <Badge tone="success" className="shrink-0">
              <CheckCircle2 className="size-3.5" /> Đúng
            </Badge>
          ) : (
            <Badge tone="danger" className="shrink-0">
              <XCircle className="size-3.5" /> {item.points ? "Đúng một phần" : "Sai"}
            </Badge>
          ))}
      </div>
      <div className="grid gap-1">
        <p className="text-sm font-medium text-ink-muted">Bài làm</p>
        <AnswerDisplay item={item} />
      </div>
      {item.correctAnswer && (
        <p className="rounded-md bg-success/5 p-2 text-[15px] text-ink">
          <span className="font-medium text-success">Đáp án: </span>
          {item.correctAnswer}
        </p>
      )}
      {item.explanation && <p className="text-[15px] text-ink-muted">💡 {item.explanation}</p>}
      {showPoints && item.points !== null && (
        <p className="text-sm text-ink-muted tabular-nums">
          Điểm: {formatScore(item.points)}/{formatScore(item.question.points)}
        </p>
      )}
      <Feedback list={item.feedback} />
    </div>
  );
}

export default async function SubmissionPage({ params }: PageProps<"/app/submissions/[submissionId]">) {
  const user = await requireUser();
  const { submissionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) notFound();
  const d = await getSubmissionDetail(user, submissionId);
  if (!d) notFound();
  if (d.inProgress) redirect(d.viewer === "student" ? `/app/do/${d.submissionId}` : `/app/assignments/${d.assignmentId}`);
  const s = d.submission;
  const staff = d.viewer === "staff";

  const header = (
    <div className="grid gap-2">
      <Link href={staff ? `/app/assignments/${d.assignment.id}` : d.viewer === "student" ? `/app/assignments/${d.assignment.id}` : "/app"} className="text-sm text-blue-600 hover:underline">
        ← {d.assignment.title}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl leading-8 font-semibold text-ink">{staff ? s.studentName : d.assignment.title}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <Badge tone={SUBMISSION_STATUS_TONES[s.status]}>{SUBMISSION_STATUS_LABELS[s.status]}</Badge>
            {s.isLate && <Badge tone="danger">Nộp muộn</Badge>}
            <span>
              {s.classCode} · lần {s.attemptNo}
              {s.submittedAt && ` · nộp ${formatDateTime(s.submittedAt)}`}
              {d.dueAt && ` · hạn ${formatDateTime(d.dueAt)}`}
            </span>
          </p>
        </div>
        {s.finalScore !== null && (
          <p className="text-3xl font-bold text-ink tabular-nums" aria-label={`Điểm ${formatScore(s.finalScore)} trên ${formatScore(d.assignment.maxScore)}`}>
            {formatScore(s.finalScore)}
            <span className="text-lg font-medium text-ink-muted">/{formatScore(d.assignment.maxScore)}</span>
          </p>
        )}
      </div>
    </div>
  );

  if (staff) {
    const queue = await gradingQueue(user);
    const next = queue.find((q) => q.id !== s.id);
    return (
      <div className="mx-auto grid max-w-3xl gap-5">
        {header}
        {s.status === "EXCUSED" ? (
          <Alert tone="info">Học viên được miễn bài này.</Alert>
        ) : (
          <>
            {d.attempts.length > 1 && (
              <nav aria-label="Các lần nộp" className="flex flex-wrap gap-2 text-sm">
                {d.attempts.map((a) => (
                  <Link key={a.id} href={`/app/submissions/${a.id}`} className={buttonVariants({ variant: a.id === s.id ? "secondary" : "ghost", size: "sm" })}>
                    Lần {a.attemptNo}: {SUBMISSION_STATUS_LABELS[a.status]}
                    {a.finalScore !== null && ` · ${formatScore(a.finalScore)}`}
                  </Link>
                ))}
              </nav>
            )}
            {d.overallFeedback.length > 0 && (
              <section className="grid gap-2" aria-label="Nhận xét đã gửi">
                <h2 className="font-semibold text-ink">Nhận xét đã gửi</h2>
                <Feedback list={d.overallFeedback} />
              </section>
            )}
            <GradingForm
              submissionId={s.id}
              maxScore={d.assignment.maxScore}
              totalPoints={d.totalPoints}
              nextHref={next ? `/app/submissions/${next.id}` : null}
              items={d.items.map((item) => ({
                questionId: item.question.id,
                index: item.index,
                max: item.question.points,
                autoPoints: item.autoPoints,
                manualPoints: item.manualPoints,
                needsManual: item.needsManual,
                isCorrect: item.isCorrect,
                body: <QuestionBody item={item} showPoints={false} />,
              }))}
            />
            {d.grades.length > 0 && (
              <section className="grid gap-2" aria-labelledby="grade-history">
                <h2 id="grade-history" className="font-semibold text-ink">
                  Lịch sử chấm
                </h2>
                <ul className="grid gap-1 text-sm text-ink-muted">
                  {d.grades.map((g) => (
                    <li key={g.id}>
                      {formatDateTime(g.createdAt)} · {formatScore(g.score)}/{formatScore(g.maxScore)} · {g.source === "AUTO" ? "tự động" : (g.grader?.fullName ?? "giáo viên")}
                      {g.reason && ` · ${g.reason}`}
                      {g.isCurrent && " (hiện tại)"}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      {header}
      {s.status === "SUBMITTED" && <Alert tone="info">Đã nộp — đang chờ giáo viên chấm. Điểm sẽ hiện ở đây khi có.</Alert>}
      {s.status === "NEEDS_REVISION" && (
        <Alert tone="warning" title="Giáo viên yêu cầu làm lại">
          Đọc nhận xét bên dưới rồi{" "}
          <Link href={`/app/assignments/${d.assignment.id}`} className="font-medium underline">
            làm lại bài
          </Link>
          .
        </Alert>
      )}
      {d.overallFeedback.length > 0 && (
        <Card>
          <CardContent className="grid gap-2 pt-5">
            <h2 className="font-semibold text-ink">Nhận xét của giáo viên</h2>
            <Feedback list={d.overallFeedback} />
          </CardContent>
        </Card>
      )}
      {!d.reveal && s.status !== "EXCUSED" && <p className="text-sm text-ink-muted">Đáp án đúng sẽ hiện khi giáo viên cho phép.</p>}
      {s.status !== "EXCUSED" && (
        <ol className="grid gap-3">
          {d.items.map((item) => (
            <li key={item.question.id} className="rounded-lg border border-line bg-surface p-4 shadow-card">
              <QuestionBody item={item} showPoints={s.finalScore !== null} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
