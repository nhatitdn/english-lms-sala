import { BookOpen, CalendarClock, Pencil, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/design-system/states";
import { StatCard } from "@/components/design-system/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArchiveClassButton } from "@/features/classes/components/archive-class-button";
import { TeacherManager } from "@/features/classes/components/teacher-manager";
import { getClassHeader, teacherOptions, upcomingSessions } from "@/features/classes/queries";
import { lessonsForClass } from "@/features/lessons/queries";
import { formatDate, formatTime } from "@/lib/datetime";
import { requireUser } from "@/server/auth/current-user";

export default async function ClassOverview({ params }: PageProps<"/app/classes/[classId]">) {
  const user = await requireUser();
  const { classId } = await params;
  const data = await getClassHeader(user, classId);
  if (!data) notFound();
  const { cls, access } = data;
  const [sessions, lessons, teachers] = await Promise.all([
    upcomingSessions(user, classId, 4),
    lessonsForClass(user, classId),
    user.role === "ADMIN" ? teacherOptions() : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid content-start gap-4 lg:col-span-2">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Học viên" value={cls._count.members} icon={Users} tone="orange" href={access.canManage ? `/app/classes/${cls.id}/members` : undefined} hint={cls.maxStudents ? `tối đa ${cls.maxStudents}` : undefined} />
          {user.role !== "PARENT" && <StatCard label="Bài giảng" value={lessons.length} icon={BookOpen} tone="blue" href={`/app/classes/${cls.id}/lessons`} />}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Buổi học sắp tới</CardTitle>
            <Link href={`/app/classes/${cls.id}/schedule`} className="text-sm text-blue-600 hover:underline">
              Xem lịch
            </Link>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Chưa có buổi học" description={access.canManage ? "Đặt lịch học định kỳ ở mục Lịch học." : undefined} />
            ) : (
              <ul className="divide-y divide-line">
                {sessions.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3 py-2.5 text-ink">
                    <span>{formatDate(s.startsAt, "EEEE, dd/MM")}</span>
                    <span className="tabular-nums">
                      {formatTime(s.startsAt)}–{formatTime(s.endsAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        {cls.description && (
          <Card>
            <CardHeader>
              <CardTitle>Giới thiệu lớp</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-ink">{cls.description}</p>
            </CardContent>
          </Card>
        )}
      </div>
      <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">Bắt đầu</dt>
                <dd className="text-ink">{formatDate(cls.startDate)}</dd>
              </div>
              {cls.endDate && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Kết thúc</dt>
                  <dd className="text-ink">{formatDate(cls.endDate)}</dd>
                </div>
              )}
              {(cls.ageMin || cls.ageMax) && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Độ tuổi</dt>
                  <dd className="text-ink">
                    {cls.ageMin ?? "?"}–{cls.ageMax ?? "?"}
                  </dd>
                </div>
              )}
              {cls.location && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Địa điểm</dt>
                  <dd className="text-right text-ink">{cls.location}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Giáo viên</CardTitle>
          </CardHeader>
          <CardContent>
            {user.role === "ADMIN" ? (
              <TeacherManager
                classId={cls.id}
                assigned={cls.teachers.map((t) => ({ userId: t.teacher.user.id, name: t.teacher.displayName, role: t.role }))}
                options={teachers.map((t) => ({ userId: t.user.id, name: `${t.displayName} (${t.user.fullName})` }))}
              />
            ) : cls.teachers.length === 0 ? (
              <p className="text-sm text-ink-muted">Chưa phân công giáo viên.</p>
            ) : (
              <ul className="grid gap-1 text-ink">
                {cls.teachers.map((t) => (
                  <li key={t.teacher.user.id}>
                    {t.teacher.displayName} <span className="text-sm text-ink-muted">· {t.role === "MAIN" ? "giáo viên chính" : "trợ giảng"}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        {user.role === "ADMIN" && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/app/classes/${cls.id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <Pencil /> Sửa thông tin lớp
            </Link>
            <ArchiveClassButton classId={cls.id} name={cls.name} />
          </div>
        )}
      </div>
    </div>
  );
}
