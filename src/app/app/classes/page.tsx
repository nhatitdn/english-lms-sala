import { CalendarDays, MapPin, Plus, School, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/design-system/states";
import { PageHeader } from "@/components/design-system/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { listClassesFor } from "@/features/classes/queries";
import { LEVEL_LABELS } from "@/lib/constants";
import { CLASS_STATUS_LABELS } from "@/lib/labels";
import { formatSchedule } from "@/lib/schedule";
import { requireUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Lớp học" };

const STATUS_TONE = { PLANNED: "gold", ACTIVE: "success", COMPLETED: "neutral", CANCELLED: "danger" } as const;

export default async function ClassesPage() {
  const user = await requireUser();
  const classes = await listClassesFor(user);
  const title = user.role === "PARENT" ? "Lớp của con" : user.role === "STUDENT" ? "Lớp của tôi" : "Lớp học";

  return (
    <>
      <PageHeader
        title={title}
        description={`${classes.length} lớp`}
        actions={
          user.role === "ADMIN" && (
            <Link href="/app/classes/new" className={buttonVariants({ variant: "primary" })}>
              <Plus /> Tạo lớp
            </Link>
          )
        }
      />
      {classes.length === 0 ? (
        <EmptyState
          icon={School}
          title={user.role === "ADMIN" ? "Chưa có lớp nào" : "Chưa có lớp nào"}
          description={user.role === "ADMIN" ? "Tạo lớp đầu tiên, sau đó phân công giáo viên và thêm học viên." : user.role === "TEACHER" ? "Quản trị viên sẽ phân công lớp cho bạn." : "Bạn sẽ thấy lớp ở đây khi được thêm vào lớp."}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <li key={c.id}>
              <Link href={`/app/classes/${c.id}`} className="flex h-full flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-raised">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-ink-muted">{c.code}</p>
                    <p className="truncate text-lg font-semibold text-ink">{c.name}</p>
                  </div>
                  <Badge tone={STATUS_TONE[c.status]}>{CLASS_STATUS_LABELS[c.status]}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="blue">{LEVEL_LABELS[c.level]}</Badge>
                  {(c.ageMin || c.ageMax) && <Badge tone="neutral">{c.ageMin ?? "?"}–{c.ageMax ?? "?"} tuổi</Badge>}
                </div>
                <dl className="mt-auto grid gap-1.5 text-sm text-ink-muted">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-4 shrink-0" aria-hidden />
                    <dt className="sr-only">Lịch học</dt>
                    <dd className="truncate">{formatSchedule(c.schedules)}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="size-4 shrink-0" aria-hidden />
                    <dt className="sr-only">Sĩ số và giáo viên</dt>
                    <dd className="truncate">
                      {c._count.members} học viên
                      {c.teachers.length > 0 && ` · ${c.teachers.map((t) => t.teacher.displayName).join(", ")}`}
                    </dd>
                  </div>
                  {c.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 shrink-0" aria-hidden />
                      <dt className="sr-only">Địa điểm</dt>
                      <dd className="truncate">{c.location}</dd>
                    </div>
                  )}
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
