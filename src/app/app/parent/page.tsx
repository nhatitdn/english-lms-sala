import { CalendarCheck, ClipboardList, MessageSquareQuote, Star } from "lucide-react";
import type { Metadata } from "next";
import { DueBadge } from "@/components/design-system/due-badge";
import { EmptyState } from "@/components/design-system/states";
import { PageHeader } from "@/components/design-system/page-header";
import { Avatar } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getParentDashboard } from "@/features/dashboard/queries";
import { formatDate } from "@/lib/datetime";
import { formatPercent, formatScore } from "@/lib/format";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Tổng quan phụ huynh" };

export default async function ParentDashboard() {
  const user = await requireRole("PARENT");
  const { children } = await getParentDashboard(user);

  return (
    <>
      <PageHeader title="Kết quả học tập của con" description={`Xin chào ${user.fullName}`} />
      {children.length === 0 ? (
        <EmptyState title="Chưa liên kết học viên" description="Vui lòng liên hệ lớp học để liên kết tài khoản với con của bạn." />
      ) : (
        <div className="grid gap-5">
          {children.map((c) => (
            <Card key={c.id}>
              <CardHeader className="items-center">
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} className="size-11" />
                  <div>
                    <CardTitle>{c.name}</CardTitle>
                    <p className="text-sm text-ink-muted">
                      {c.studentCode}
                      {c.classes.length > 0 && ` · ${c.classes.map((k) => k.name).join(", ")}`}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-sky-50 p-3">
                    <dt className="text-xs text-ink-muted">Điểm TB</dt>
                    <dd className="text-xl font-semibold text-ink tabular-nums">{c.averageScore === null ? "—" : formatScore(c.averageScore)}</dd>
                  </div>
                  <div className="rounded-md bg-sky-50 p-3">
                    <dt className="text-xs text-ink-muted">Chuyên cần</dt>
                    <dd className="text-xl font-semibold text-ink tabular-nums">{formatPercent(c.attendanceRate)}</dd>
                  </div>
                  <div className="rounded-md bg-sky-50 p-3">
                    <dt className="text-xs text-ink-muted">Bài chưa nộp</dt>
                    <dd className="text-xl font-semibold text-ink tabular-nums">{c.pending.length}</dd>
                  </div>
                </dl>

                <div className="grid gap-4 md:grid-cols-3">
                  <section>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                      <ClipboardList className="size-4 text-orange-700" /> Bài tập chưa nộp
                    </h3>
                    {c.pending.length === 0 ? (
                      <p className="text-sm text-ink-muted">Con đã nộp đủ bài.</p>
                    ) : (
                      <ul className="grid gap-2">
                        {c.pending.slice(0, 4).map((w) => (
                          <li key={w.assignmentId} className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate text-ink">{w.title}</span>
                            <DueBadge dueAt={w.dueAt} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                      <Star className="size-4 text-gold" /> Điểm gần đây
                    </h3>
                    {c.recentGrades.length === 0 ? (
                      <p className="text-sm text-ink-muted">Chưa có bài được chấm.</p>
                    ) : (
                      <ul className="grid gap-2 text-sm">
                        {c.recentGrades.map((g, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span className="truncate text-ink">{g.assignment.title}</span>
                            <span className="font-semibold text-ink tabular-nums">
                              {formatScore(g.finalScore)}/{formatScore(g.assignment.maxScore)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                      <MessageSquareQuote className="size-4 text-blue-600" /> Nhận xét của giáo viên
                    </h3>
                    {c.feedback.length === 0 ? (
                      <p className="text-sm text-ink-muted">Chưa có nhận xét.</p>
                    ) : (
                      <ul className="grid gap-2">
                        {c.feedback.map((f) => (
                          <li key={f.id} className="rounded-md bg-cream p-2.5 text-sm">
                            <p className="text-ink">{f.content}</p>
                            <p className="mt-1 text-xs text-ink-muted">
                              {f.author.fullName} · {formatDate(f.createdAt)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
                {c.absences > 0 && (
                  <p className="flex items-center gap-2 text-sm text-warning">
                    <CalendarCheck className="size-4" /> Con đã vắng {c.absences} buổi không phép.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
