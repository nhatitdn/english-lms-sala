import { ClipboardList, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DueBadge } from "@/components/design-system/due-badge";
import { PageHeader } from "@/components/design-system/page-header";
import { EmptyState } from "@/components/design-system/states";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { NewAssignmentDialog } from "@/features/assignments/components/assignment-actions";
import { listAssignmentsForStaff, listAssignmentsForStudent } from "@/features/assignments/queries";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { formatScore } from "@/lib/format";
import { ASSIGNMENT_KIND_LABELS, ASSIGNMENT_STATUS_LABELS, SUBMISSION_STATUS_LABELS, SUBMISSION_STATUS_TONES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Bài tập" };

const FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "DRAFT", label: "Nháp" },
  { key: "PUBLISHED", label: "Đang giao" },
  { key: "CLOSED", label: "Đã khóa" },
] as const;

export default async function AssignmentsPage({ searchParams }: PageProps<"/app/assignments">) {
  const user = await requireUser();
  if (user.role === "STUDENT") return <StudentAssignments />;

  const sp = await searchParams;
  const status = FILTERS.find((f) => f.key && f.key === sp.status)?.key || undefined;
  const list = await listAssignmentsForStaff(user, { status });
  const toGrade = list.reduce((s, a) => s + a.toGrade, 0);

  return (
    <>
      <PageHeader
        title="Bài tập"
        description="Soạn bài, giao cho lớp / nhóm / từng học viên, theo dõi và chấm bài."
        actions={
          <>
            <Link href="/app/grading" className={buttonVariants({ variant: "outline" })}>
              <Inbox /> Chờ chấm{toGrade > 0 && <Badge tone="orange">{toGrade}</Badge>}
            </Link>
            <NewAssignmentDialog />
          </>
        }
      />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Lọc theo trạng thái">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/app/assignments?status=${f.key}` : "/app/assignments"}
            className={cn("inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium", (status ?? "") === f.key ? "border-blue-600 bg-sky-100 text-blue-700" : "border-line bg-surface text-ink")}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {list.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Chưa có bài tập" description="Bấm “Tạo bài tập” để soạn quiz, bài viết, bài nói hoặc bài nộp ảnh/file." />
      ) : (
        <ul className="grid gap-2">
          {list.map((a) => (
            <li key={a.id}>
              <Link href={`/app/assignments/${a.id}`} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 shadow-card hover:shadow-raised sm:flex-row sm:items-center">
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="truncate font-semibold text-ink">{a.title}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                    <Badge tone="blue">{ASSIGNMENT_KIND_LABELS[a.kind]}</Badge>
                    <Badge tone={a.status === "PUBLISHED" ? "success" : a.status === "DRAFT" ? "gold" : "neutral"}>{ASSIGNMENT_STATUS_LABELS[a.status]}</Badge>
                    {a.classes.length ? a.classes.join(", ") : "Chưa giao"}
                    {` · ${a.questionCount} câu`}
                    {!a.mine && ` · ${a.author}`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-2 text-sm text-ink-muted">
                  {a.toGrade > 0 && <Badge tone="orange">{a.toGrade} chờ chấm</Badge>}
                  {a.nextDue ? <span>Hạn {formatDateTime(a.nextDue)}</span> : <span>Sửa {formatDate(a.updatedAt)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function StudentAssignments() {
  const user = await requireUser();
  const { todo, done } = await listAssignmentsForStudent(user);
  return (
    <>
      <PageHeader title="Bài tập" description="Bài cần làm và kết quả của bạn." />
      <section aria-labelledby="todo" className="mb-6 grid gap-2">
        <h2 id="todo" className="text-lg font-semibold text-ink">
          Cần làm ({todo.length})
        </h2>
        {todo.length === 0 ? (
          <EmptyState title="Không có bài cần làm" description="Bạn đã làm hết bài tập. Giỏi lắm!" />
        ) : (
          <ul className="grid gap-2">
            {todo.map((r) => (
              <li key={r.assignmentId}>
                <Link href={`/app/assignments/${r.assignmentId}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 shadow-card hover:shadow-raised">
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="font-semibold text-ink">{r.title}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                      {r.classCode}
                      {r.submissionStatus === "IN_PROGRESS" && <Badge tone="blue">Đang làm dở</Badge>}
                      {r.submissionStatus === "NEEDS_REVISION" && <Badge tone="danger">Cần làm lại</Badge>}
                    </span>
                  </span>
                  <DueBadge dueAt={r.dueAt} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="done" className="grid gap-2">
        <h2 id="done" className="text-lg font-semibold text-ink">
          Đã nộp / đã đóng ({done.length})
        </h2>
        {done.length === 0 ? (
          <p className="text-sm text-ink-muted">Chưa có.</p>
        ) : (
          <ul className="grid gap-2">
            {done.map((r) => (
              <li key={r.assignmentId}>
                <Link href={r.submissionId ? `/app/submissions/${r.submissionId}` : `/app/assignments/${r.assignmentId}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 hover:shadow-card">
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="font-medium text-ink">{r.title}</span>
                    <span className="text-sm text-ink-muted">
                      {r.classCode}
                      {r.submittedAt && ` · nộp ${formatDateTime(r.submittedAt)}`}
                    </span>
                  </span>
                  {r.submissionStatus === "GRADED" && r.finalScore !== null ? (
                    <span className="text-lg font-semibold text-ink tabular-nums">
                      {formatScore(r.finalScore)}
                      <span className="text-sm font-normal text-ink-muted">/{formatScore(r.maxScore)}</span>
                    </span>
                  ) : r.submissionStatus ? (
                    <Badge tone={SUBMISSION_STATUS_TONES[r.submissionStatus]}>{SUBMISSION_STATUS_LABELS[r.submissionStatus]}</Badge>
                  ) : (
                    <Badge tone="danger">Không nộp</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
