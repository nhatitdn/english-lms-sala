import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/design-system/page-header";
import { EmptyState } from "@/components/design-system/states";
import { Badge } from "@/components/ui/badge";
import { gradingQueue } from "@/features/assignments/queries";
import { formatDateTime } from "@/lib/datetime";
import { formatScore } from "@/lib/format";
import { ASSIGNMENT_KIND_LABELS } from "@/lib/labels";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Chờ chấm" };

export default async function GradingQueuePage() {
  const user = await requireRole("ADMIN", "TEACHER");
  const queue = await gradingQueue(user);
  return (
    <>
      <PageHeader title="Chờ chấm" description="Bài đã nộp cần giáo viên chấm (viết, nói, nộp file, câu trả lời ngắn). Bài cũ nhất ở trên." />
      {queue.length === 0 ? (
        <EmptyState icon={Inbox} title="Không còn bài chờ chấm" description="Bài trắc nghiệm được chấm tự động. Bài viết, nói, nộp file sẽ xuất hiện ở đây khi học viên nộp." />
      ) : (
        <ul className="grid gap-2">
          {queue.map((s) => (
            <li key={s.id}>
              <Link href={`/app/submissions/${s.id}`} className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4 shadow-card hover:shadow-raised sm:flex-row sm:items-center sm:gap-3">
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="font-semibold text-ink">{s.student.user.fullName}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                    <Badge tone="blue">{ASSIGNMENT_KIND_LABELS[s.assignment.kind]}</Badge>
                    {s.assignment.title} · {s.class.code}
                    {s.attemptNo > 1 && ` · lần ${s.attemptNo}`}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-sm text-ink-muted">
                  {s.isLate && <Badge tone="danger">Nộp muộn</Badge>}
                  {s.autoScore !== null && Number(s.autoScore) > 0 && <span>tự chấm {formatScore(s.autoScore)}</span>}
                  {s.submittedAt && formatDateTime(s.submittedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
