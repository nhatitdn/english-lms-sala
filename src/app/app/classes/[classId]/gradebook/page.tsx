import { Download, Table2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/design-system/states";
import { buttonVariants } from "@/components/ui/button";
import { getGradebook } from "@/features/assignments/queries";
import { getClassHeader } from "@/features/classes/queries";
import { formatScore } from "@/lib/format";
import { SUBMISSION_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/current-user";

export default async function GradebookPage({ params }: PageProps<"/app/classes/[classId]/gradebook">) {
  const user = await requireUser();
  const { classId } = await params;
  const header = await getClassHeader(user, classId);
  if (!header) notFound();
  const book = await getGradebook(user, classId);
  if (!book) notFound();
  if (book.assignments.length === 0) return <EmptyState icon={Table2} title="Chưa có điểm" description="Bảng điểm hiện các bài tập đã giao cho lớp." />;

  return (
    <div className="grid gap-3">
      {book.staff && (
        <div className="flex justify-end">
          <a href={`/api/classes/${classId}/gradebook`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download /> Tải CSV (Excel)
          </a>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
        <table className="w-full min-w-max border-collapse text-sm">
          <caption className="sr-only">Bảng điểm lớp {header.cls.code}</caption>
          <thead>
            <tr className="border-b border-line bg-sky-50">
              <th scope="col" className="sticky left-0 z-10 bg-sky-50 px-3 py-2 text-left font-semibold text-ink">
                Học viên
              </th>
              {book.assignments.map((a) => (
                <th key={a.id} scope="col" className="max-w-36 px-3 py-2 text-center font-medium text-ink">
                  <Link href={`/app/assignments/${a.id}`} className="line-clamp-2 hover:underline" title={a.title}>
                    {a.title}
                  </Link>
                  <span className="block text-xs font-normal text-ink-muted">/{formatScore(a.maxScore)}</span>
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-center font-semibold text-ink">
                TB (thang 10)
              </th>
            </tr>
          </thead>
          <tbody>
            {book.students.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium whitespace-nowrap text-ink">
                  {s.name}
                </th>
                {s.cells.map((c, i) => {
                  const label = !c ? "—" : c.score !== null && (c.status === "GRADED" || c.status === "NEEDS_REVISION") ? formatScore(c.score) : c.status && c.status !== "IN_PROGRESS" ? SUBMISSION_STATUS_LABELS[c.status] : c.missing ? "Thiếu" : "·";
                  const cls = cn("px-3 py-2 text-center tabular-nums", c?.missing && "bg-danger/5 font-medium text-danger", c?.status === "SUBMITTED" && "text-gold-700", c?.status === "NEEDS_REVISION" && "text-danger");
                  return (
                    <td key={book.assignments[i]!.id} className={cls}>
                      {c?.submissionId && c.status !== "IN_PROGRESS" ? (
                        <Link href={`/app/submissions/${c.submissionId}`} className="hover:underline">
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center font-semibold tabular-nums">{formatScore(s.average)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-muted">“Thiếu” = quá hạn chưa nộp · “·” = chưa đến hạn · TB quy đổi mọi bài về thang 10, chỉ tính bài đã chấm.</p>
    </div>
  );
}
