import { CheckCircle2, Clock, Inbox, Pencil, Repeat, Star, Timer, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DueBadge } from "@/components/design-system/due-badge";
import { StatCard } from "@/components/design-system/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AssignmentStatusActions, DuplicateAssignmentButton } from "@/features/assignments/components/assignment-actions";
import { StartAttemptButton, StudentRowActions } from "@/features/assignments/components/student-row-actions";
import { getAssignmentResults, getStudentAssignment } from "@/features/assignments/queries";
import { formatDateTime } from "@/lib/datetime";
import { formatScore } from "@/lib/format";
import { ASSIGNMENT_KIND_LABELS, ASSIGNMENT_STATUS_LABELS, SUBMISSION_STATUS_LABELS, SUBMISSION_STATUS_TONES } from "@/lib/labels";
import { requireUser, type CurrentUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Bài tập" };

export default async function AssignmentPage({ params }: PageProps<"/app/assignments/[assignmentId]">) {
  const user = await requireUser();
  const { assignmentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(assignmentId)) notFound();
  return user.role === "STUDENT" ? <StudentIntro user={user} assignmentId={assignmentId} /> : <StaffResults user={user} assignmentId={assignmentId} />;
}

async function StaffResults({ user, assignmentId }: { user: CurrentUser; assignmentId: string }) {
  const data = await getAssignmentResults(user, assignmentId);
  if (!data) notFound();
  const { assignment: a, rows, stats, canEdit } = data;
  const now = new Date();
  return (
    <div className="grid gap-5">
      <div>
        <Link href="/app/assignments" className="text-sm text-blue-600 hover:underline">
          ← Bài tập
        </Link>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-1">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="blue">{ASSIGNMENT_KIND_LABELS[a.kind]}</Badge>
              <Badge tone={a.status === "PUBLISHED" ? "success" : a.status === "DRAFT" ? "gold" : "neutral"}>{ASSIGNMENT_STATUS_LABELS[a.status]}</Badge>
              <span className="text-ink-muted">
                {a._count.questions} câu · thang {formatScore(a.maxScore)}
              </span>
            </p>
            <h1 className="text-2xl leading-8 font-semibold text-ink">{a.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <>
                <Link href={`/app/assignments/${a.id}/edit`} className={buttonVariants({ variant: "primary" })}>
                  <Pencil /> Soạn & giao bài
                </Link>
              </>
            ) : (
              <DuplicateAssignmentButton assignmentId={a.id} />
            )}
          </div>
        </div>
        {canEdit && (
          <div className="mt-3">
            <AssignmentStatusActions assignmentId={a.id} status={a.status} answerReveal={a.answerReveal} answersReleased={!!a.answersReleasedAt} hasSubmissions={rows.some((r) => r.submissionStatus)} />
          </div>
        )}
      </div>

      {a.status === "DRAFT" && <Alert tone="info">Bản nháp — học viên chưa thấy bài này.</Alert>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Users} label="Được giao" value={String(stats.assigned)} />
        <StatCard icon={CheckCircle2} tone="success" label="Đã nộp" value={`${stats.handedIn}/${stats.assigned}`} />
        <StatCard icon={Inbox} tone="orange" label="Chờ chấm" value={String(stats.toGrade)} href={stats.toGrade ? "/app/grading" : undefined} />
        <StatCard icon={Star} tone="gold" label="Điểm TB" value={stats.average === null ? "—" : formatScore(stats.average)} />
      </div>

      <Card>
        <CardContent className="p-0 sm:p-0">
          {rows.length === 0 ? (
            <p className="p-5 text-sm text-ink-muted">Chưa có học viên nào nhận bài (chưa giao, hoặc chưa đến giờ giao).</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Học viên</TableHead>
                  <TableHead>Lớp</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Nộp lúc</TableHead>
                  <TableHead className="text-right">Điểm</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Thao tác</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const missing = (!r.submissionStatus || r.submissionStatus === "IN_PROGRESS") && r.dueAt && r.dueAt < now;
                  return (
                    <TableRow key={`${r.studentId}`}>
                      <TableCell className="font-medium">
                        {r.submissionId && r.submissionStatus !== "IN_PROGRESS" && r.submissionStatus !== "EXCUSED" ? (
                          <Link href={`/app/submissions/${r.submissionId}`} className="text-blue-700 hover:underline">
                            {r.studentName}
                          </Link>
                        ) : (
                          r.studentName
                        )}
                        {r.dueAt && r.targetDueAt && +r.dueAt !== +r.targetDueAt && <span className="block text-xs text-ink-muted">Gia hạn đến {formatDateTime(r.dueAt)}</span>}
                      </TableCell>
                      <TableCell>{r.classCode}</TableCell>
                      <TableCell>
                        {r.submissionStatus ? (
                          <Badge tone={SUBMISSION_STATUS_TONES[r.submissionStatus]}>{SUBMISSION_STATUS_LABELS[r.submissionStatus]}</Badge>
                        ) : (
                          <Badge tone={missing ? "danger" : "neutral"}>{missing ? "Chưa nộp (quá hạn)" : "Chưa làm"}</Badge>
                        )}
                        {r.attempts > 1 && <span className="ml-1 text-xs text-ink-muted">lần {r.attempts}</span>}
                      </TableCell>
                      <TableCell className="text-sm text-ink-muted">{r.submittedAt && r.submissionStatus !== "EXCUSED" ? formatDateTime(r.submittedAt) : "—"}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {r.submissionStatus === "SUBMITTED" && r.submissionId ? (
                          <Link href={`/app/submissions/${r.submissionId}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                            Chấm
                          </Link>
                        ) : (
                          formatScore(r.finalScore)
                        )}
                      </TableCell>
                      <TableCell>
                        <StudentRowActions
                          assignmentId={a.id}
                          studentId={r.studentId}
                          studentName={r.studentName}
                          classId={r.classId}
                          dueAt={r.dueAt}
                          canExcuse={!r.submissionStatus || r.submissionStatus === "NEEDS_REVISION"}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function StudentIntro({ user, assignmentId }: { user: CurrentUser; assignmentId: string }) {
  const data = await getStudentAssignment(user, assignmentId);
  if (!data) notFound();
  const { assignment: a, row, attempts, blocker, inProgress } = data;
  const label = inProgress ? "Làm tiếp" : row.submissionStatus === "NEEDS_REVISION" ? "Làm lại bài" : attempts.length ? "Làm lại" : "Bắt đầu làm bài";

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <Link href="/app/assignments" className="text-sm text-blue-600 hover:underline">
        ← Bài tập
      </Link>
      <header className="grid gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="blue">{ASSIGNMENT_KIND_LABELS[a.kind]}</Badge>
          <span className="text-ink-muted">{row.classCode}</span>
        </p>
        <h1 className="text-2xl leading-8 font-semibold text-ink">{a.title}</h1>
        {a.audioLesson && <p className="text-ink-muted">Bài nghe: {a.audioLesson.title}</p>}
      </header>
      <Card>
        <CardContent className="grid gap-3 pt-5 text-[15px]">
          {a.description && <p className="whitespace-pre-line text-ink">{a.description}</p>}
          <ul className="grid gap-2 text-ink">
            <li className="flex items-center gap-2">
              <Clock className="size-4 text-ink-muted" /> Hạn nộp: {row.dueAt ? formatDateTime(row.dueAt) : "không có"} <DueBadge dueAt={row.dueAt} />
            </li>
            <li className="flex items-center gap-2">
              <Timer className="size-4 text-ink-muted" /> {a.timeLimitMin ? `Thời gian làm bài: ${a.timeLimitMin} phút (tính từ lúc bắt đầu)` : "Không giới hạn thời gian"}
            </li>
            <li className="flex items-center gap-2">
              <Repeat className="size-4 text-ink-muted" /> {a._count.questions} câu · {a.maxAttempts ? `làm tối đa ${a.maxAttempts} lần` : "làm không giới hạn số lần"}
              {attempts.length > 0 && ` · đã làm ${attempts.filter((s) => s.status !== "EXCUSED").length}`}
            </li>
          </ul>
          {row.dueAt && row.dueAt < new Date() && !blocker && <Alert tone="warning">Đã quá hạn — bài nộp bây giờ sẽ được đánh dấu “Nộp muộn”.</Alert>}
          {a.timeLimitMin && !inProgress && !blocker && <Alert tone="info">Khi bấm bắt đầu, đồng hồ sẽ chạy. Hết giờ bài được nộp tự động.</Alert>}
          {blocker ? <Alert tone="info">{blocker.reason}</Alert> : <StartAttemptButton assignmentId={a.id} label={label} resumeId={inProgress} />}
        </CardContent>
      </Card>
      {attempts.filter((s) => s.status !== "IN_PROGRESS").length > 0 && (
        <section aria-labelledby="history" className="grid gap-2">
          <h2 id="history" className="text-lg font-semibold text-ink">
            Kết quả của bạn
          </h2>
          <ul className="grid gap-2">
            {attempts
              .filter((s) => s.status !== "IN_PROGRESS")
              .map((s) => (
                <li key={s.id}>
                  <Link href={`/app/submissions/${s.id}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 hover:shadow-card">
                    <span className="grid flex-1 gap-0.5">
                      <span className="font-medium text-ink">Lần {s.attemptNo}</span>
                      <span className="text-sm text-ink-muted">
                        {s.submittedAt && formatDateTime(s.submittedAt)}
                        {s.isLate && " · nộp muộn"}
                      </span>
                    </span>
                    {s.status === "GRADED" && s.finalScore !== null ? (
                      <span className="text-lg font-semibold tabular-nums">
                        {formatScore(s.finalScore)}
                        <span className="text-sm font-normal text-ink-muted">/{formatScore(a.maxScore)}</span>
                      </span>
                    ) : (
                      <Badge tone={SUBMISSION_STATUS_TONES[s.status]}>{SUBMISSION_STATUS_LABELS[s.status]}</Badge>
                    )}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
