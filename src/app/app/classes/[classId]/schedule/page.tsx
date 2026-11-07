import { CalendarClock } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/design-system/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleManager } from "@/features/classes/components/schedule-manager";
import { getClassHeader, upcomingSessions } from "@/features/classes/queries";
import { formatDate, formatTime } from "@/lib/datetime";
import { timeToHHMM } from "@/lib/schedule";
import { requireUser } from "@/server/auth/current-user";

const SESSION_STATUS = { SCHEDULED: null, COMPLETED: "Đã học", CANCELLED: "Nghỉ", RESCHEDULED: "Đổi lịch" } as const;

export default async function SchedulePage({ params }: PageProps<"/app/classes/[classId]/schedule">) {
  const user = await requireUser();
  const { classId } = await params;
  const data = await getClassHeader(user, classId);
  if (!data) notFound();
  const sessions = await upcomingSessions(user, classId, 16);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.access.canManage && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Lịch học định kỳ</CardTitle>
              <CardDescription>Lịch tuần/tháng, nghỉ học và học bù có ở giai đoạn 4.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ScheduleManager
              classId={classId}
              items={data.cls.schedules.map((s) => ({ id: s.id, weekday: s.weekday, start: timeToHHMM(s.startTime), end: timeToHHMM(s.endTime), location: s.location }))}
            />
          </CardContent>
        </Card>
      )}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Các buổi học sắp tới</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Chưa có buổi học nào" />
          ) : (
            <ul className="divide-y divide-line">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="font-medium text-ink">{formatDate(s.startsAt, "EEEE, dd/MM/yyyy")}</span>
                  <span className="flex items-center gap-2 text-ink tabular-nums">
                    {SESSION_STATUS[s.status] && <Badge tone={s.status === "CANCELLED" ? "danger" : "neutral"}>{SESSION_STATUS[s.status]}</Badge>}
                    {formatTime(s.startsAt)}–{formatTime(s.endsAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
