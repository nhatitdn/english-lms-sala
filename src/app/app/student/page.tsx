import { CalendarDays, ClipboardList, MessageSquareQuote, Star } from "lucide-react";
import type { Metadata } from "next";
import { DueBadge } from "@/components/design-system/due-badge";
import { EmptyState } from "@/components/design-system/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStudentDashboard } from "@/features/dashboard/queries";
import { formatDate, formatLongDate, formatTime } from "@/lib/datetime";
import { formatScore } from "@/lib/format";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Trang chủ" };

export default async function StudentDashboard() {
  const user = await requireRole("STUDENT");
  const d = await getStudentDashboard(user);
  const progress = d.total ? Math.round((d.completed / d.total) * 100) : 0;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Xin chào, {user.fullName.split(" ").pop()}</h1>
        <p className="text-ink-muted">
          {formatLongDate(new Date())}
          {d.classes.length > 0 && <> · {d.classes.map((c) => c.name).join(", ")}</>}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-orange-50 lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-5 text-orange-700" /> Bài cần làm
                {d.todo.length > 0 && <Badge tone="orange">{d.todo.length}</Badge>}
              </CardTitle>
              <CardDescription>
                {d.newCount} bài mới · {d.dueSoonCount} bài sắp đến hạn
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {d.todo.length === 0 ? (
              <EmptyState title="Bạn đã làm hết bài tập" description="Bài tập mới sẽ xuất hiện ở đây." />
            ) : (
              <ul className="divide-y divide-line">
                {d.todo.slice(0, 6).map((w) => (
                  <li key={w.assignmentId} className="flex items-center justify-between gap-3 py-3">
                    <span className="grid min-w-0">
                      <span className="truncate font-medium text-ink">{w.title}</span>
                      <span className="text-sm text-ink-muted">{w.className}</span>
                    </span>
                    <DueBadge dueAt={w.dueAt} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tiến độ</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Bài đã hoàn thành</span>
                <span className="font-semibold text-ink tabular-nums">
                  {d.completed}/{d.total}
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sky-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Tỷ lệ hoàn thành bài tập">
                <div className="h-full rounded-full bg-success" style={{ width: `${progress}%` }} />
              </div>
            </div>
            {d.latestFeedback && (
              <figure className="rounded-md bg-cream p-3">
                <MessageSquareQuote className="size-4 text-gold-700" aria-hidden />
                <blockquote className="mt-1 text-sm text-ink">{d.latestFeedback.content}</blockquote>
                <figcaption className="mt-1 text-xs text-ink-muted">
                  {d.latestFeedback.author.fullName} · {formatDate(d.latestFeedback.createdAt)}
                </figcaption>
              </figure>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="size-5 text-gold" /> Điểm gần đây
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.recentGrades.length === 0 ? (
              <EmptyState title="Chưa có bài được chấm" />
            ) : (
              <ul className="divide-y divide-line">
                {d.recentGrades.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="grid min-w-0">
                      <span className="truncate font-medium text-ink">{g.assignment.title}</span>
                      <span className="text-sm text-ink-muted">
                        {formatDate(g.updatedAt)}
                        {g._count.feedback > 0 && ` · ${g._count.feedback} nhận xét`}
                      </span>
                    </span>
                    <span className="text-lg font-semibold text-ink tabular-nums">
                      {formatScore(g.finalScore)}
                      <span className="text-sm font-normal text-ink-muted">/{formatScore(g.assignment.maxScore)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-5 text-blue-600" /> Lịch học 7 ngày tới
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.upcoming.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Không có buổi học nào trong 7 ngày tới" />
            ) : (
              <ul className="divide-y divide-line">
                {d.upcoming.map((s) => (
                  <li key={s.id} className="py-2.5">
                    <p className="font-medium text-ink">
                      {formatDate(s.startsAt, "EEEE dd/MM")} · {formatTime(s.startsAt)}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {s.class.name}
                      {s.class.location && ` · ${s.class.location}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
