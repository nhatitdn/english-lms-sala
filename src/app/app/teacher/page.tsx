import { CalendarClock, ClipboardCheck, ClipboardList, School, Users } from "lucide-react";
import type { Metadata } from "next";
import { ClassScoreChart } from "@/components/charts/class-score-chart";
import { DueBadge } from "@/components/design-system/due-badge";
import { EmptyState } from "@/components/design-system/states";
import { PageHeader } from "@/components/design-system/page-header";
import { StatCard } from "@/components/design-system/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTeacherDashboard } from "@/features/dashboard/queries";
import { LEVEL_LABELS } from "@/lib/constants";
import { formatLongDate, formatTime } from "@/lib/datetime";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Tổng quan giáo viên" };

export default async function TeacherDashboard() {
  const user = await requireRole("TEACHER", "ADMIN");
  const d = await getTeacherDashboard(user);

  if (!d) {
    return (
      <EmptyState
        title="Tài khoản chưa có hồ sơ giáo viên"
        description="Quản trị viên cần bật hồ sơ giáo viên cho tài khoản này trước khi được phân công lớp."
      />
    );
  }

  return (
    <>
      <PageHeader title={`Chào ${user.fullName.split(" ").pop()}`} description={formatLongDate(new Date())} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Lớp đang dạy" value={d.classes.length} icon={School} tone="blue" />
        <StatCard label="Học viên" value={d.studentCount} icon={Users} tone="orange" />
        <StatCard label="Bài cần chấm" value={d.toGradeTotal} icon={ClipboardCheck} tone="success" />
        <StatCard label="Lượt quá hạn chưa nộp" value={d.missingTotal} icon={ClipboardList} tone="danger" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Lịch dạy hôm nay</CardTitle>
              <CardDescription>Điểm danh sẽ có ở giai đoạn 4.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {d.todaySessions.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Hôm nay không có buổi dạy" />
            ) : (
              <ul className="divide-y divide-line">
                {d.todaySessions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                    <span className="font-semibold whitespace-nowrap text-ink tabular-nums sm:w-32">
                      {formatTime(s.startsAt)}–{formatTime(s.endsAt)}
                    </span>
                    <span className="font-medium text-ink">{s.class.code}</span>
                    <span className="text-ink-muted">{s.class.name}</span>
                    {s.class.location && <Badge tone="neutral">{s.class.location}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cần chấm</CardTitle>
          </CardHeader>
          <CardContent>
            {d.gradeQueue.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="Không có bài chờ chấm" />
            ) : (
              <ul className="divide-y divide-line">
                {d.gradeQueue.map((g) => (
                  <li key={g.assignmentId} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="truncate text-ink">{g.title}</span>
                    <Badge tone="success">{g.count} bài</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Điểm trung bình theo lớp</CardTitle>
              <CardDescription>Quy về thang 10, chỉ tính bài đã chấm.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {d.scoreByClass.length === 0 ? <EmptyState title="Chưa được phân công lớp" /> : <ClassScoreChart data={d.scoreByClass} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Chưa nộp bài</CardTitle>
              <CardDescription>Quá hạn hoặc hết hạn trong 48 giờ.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {d.missing.length === 0 ? (
              <EmptyState title="Mọi học viên đều đúng hạn" />
            ) : (
              <ul className="divide-y divide-line">
                {d.missing.map((m) => (
                  <li key={`${m.assignmentId}-${m.studentId}`} className="grid gap-1 py-2.5">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-ink">{m.studentName}</span>
                      <DueBadge dueAt={m.dueAt} />
                    </span>
                    <span className="truncate text-sm text-ink-muted">
                      {m.classCode} · {m.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Lớp của tôi</CardTitle>
          </CardHeader>
          <CardContent>
            {d.classes.length === 0 ? (
              <EmptyState icon={School} title="Bạn chưa được phân công lớp nào" description="Quản trị viên sẽ phân công lớp cho bạn." />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {d.classes.map((c) => (
                  <li key={c.id} className="rounded-md border border-line p-4">
                    <p className="font-semibold text-ink">
                      {c.code} · {c.name}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-2 text-sm text-ink-muted">
                      <Badge tone="blue">{LEVEL_LABELS[c.level]}</Badge>
                      <span>{c._count.members} học viên</span>
                      {c.location && <span>· {c.location}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
