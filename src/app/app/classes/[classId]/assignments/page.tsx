import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DueBadge } from "@/components/design-system/due-badge";
import { EmptyState } from "@/components/design-system/states";
import { Badge } from "@/components/ui/badge";
import { assignedWork } from "@/features/assignments/assigned-work";
import { NewAssignmentDialog } from "@/features/assignments/components/assignment-actions";
import { listAssignmentsForStaff } from "@/features/assignments/queries";
import { getClassHeader } from "@/features/classes/queries";
import { formatDateTime } from "@/lib/datetime";
import { formatScore } from "@/lib/format";
import { ASSIGNMENT_KIND_LABELS, ASSIGNMENT_STATUS_LABELS, SUBMISSION_STATUS_LABELS, SUBMISSION_STATUS_TONES } from "@/lib/labels";
import { requireUser } from "@/server/auth/current-user";

export default async function ClassAssignmentsPage({ params }: PageProps<"/app/classes/[classId]/assignments">) {
  const user = await requireUser();
  const { classId } = await params;
  const header = await getClassHeader(user, classId);
  if (!header || user.role === "PARENT") notFound();

  if (header.access.canManage) {
    const list = await listAssignmentsForStaff(user, { classId });
    return (
      <div className="grid gap-3">
        <div className="flex justify-end">
          <NewAssignmentDialog defaultClassId={classId} />
        </div>
        {list.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Lớp chưa có bài tập" description="Tạo bài tập rồi giao cho cả lớp, một nhóm hoặc từng học viên." />
        ) : (
          <ul className="grid gap-2">
            {list.map((a) => (
              <li key={a.id}>
                <Link href={`/app/assignments/${a.id}`} className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4 shadow-card hover:shadow-raised sm:flex-row sm:items-center">
                  <span className="grid flex-1 gap-1">
                    <span className="font-semibold text-ink">{a.title}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                      <Badge tone="blue">{ASSIGNMENT_KIND_LABELS[a.kind]}</Badge>
                      <Badge tone={a.status === "PUBLISHED" ? "success" : "neutral"}>{ASSIGNMENT_STATUS_LABELS[a.status]}</Badge>
                      {a.questionCount} câu
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-sm text-ink-muted">
                    {a.toGrade > 0 && <Badge tone="orange">{a.toGrade} chờ chấm</Badge>}
                    {a.nextDue && `Hạn ${formatDateTime(a.nextDue)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const rows = user.studentId ? await assignedWork({ classIds: [classId], studentIds: [user.studentId] }) : [];
  if (rows.length === 0) return <EmptyState icon={ClipboardList} title="Chưa có bài tập" description="Bài tập giáo viên giao cho lớp sẽ hiện ở đây." />;
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.assignmentId}>
          <Link
            href={r.submissionId && r.submissionStatus !== "IN_PROGRESS" && r.submissionStatus !== "NEEDS_REVISION" ? `/app/submissions/${r.submissionId}` : `/app/assignments/${r.assignmentId}`}
            className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 shadow-card hover:shadow-raised"
          >
            <span className="grid flex-1 gap-1">
              <span className="font-semibold text-ink">{r.title}</span>
              <span className="text-sm text-ink-muted">{r.dueAt ? `Hạn ${formatDateTime(r.dueAt)}` : "Không hạn"}</span>
            </span>
            {r.submissionStatus === "GRADED" && r.finalScore !== null ? (
              <span className="font-semibold tabular-nums">
                {formatScore(r.finalScore)}/{formatScore(r.maxScore)}
              </span>
            ) : r.submissionStatus && r.submissionStatus !== "IN_PROGRESS" ? (
              <Badge tone={SUBMISSION_STATUS_TONES[r.submissionStatus]}>{SUBMISSION_STATUS_LABELS[r.submissionStatus]}</Badge>
            ) : (
              <DueBadge dueAt={r.dueAt} />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
