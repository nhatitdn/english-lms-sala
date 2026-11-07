import { Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/design-system/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { AddStudents } from "@/features/classes/components/add-students";
import { CsvImport } from "@/features/classes/components/csv-import";
import { GroupsManager } from "@/features/classes/components/groups-manager";
import { MemberActions } from "@/features/classes/components/member-actions";
import { getClassMembers, transferTargets } from "@/features/classes/queries";
import { formatDate } from "@/lib/datetime";
import { requireUser } from "@/server/auth/current-user";

const HISTORY_LABEL = { TRANSFERRED_OUT: "Đã chuyển lớp", LEFT: "Đã rời lớp", COMPLETED: "Đã hoàn thành", ACTIVE: "Đang học" } as const;

export default async function MembersPage({ params }: PageProps<"/app/classes/[classId]/members">) {
  const user = await requireUser();
  const { classId } = await params;
  const data = await getClassMembers(user, classId);
  if (!data) notFound(); // only managers
  const targets = await transferTargets(user, classId);
  const active = data.members.filter((m) => m.status === "ACTIVE");
  const history = data.members.filter((m) => m.status !== "ACTIVE");

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid content-start gap-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Học viên đang học ({active.length})</CardTitle>
              <CardDescription>Chuyển lớp hoặc cho rời lớp vẫn giữ nguyên lịch sử học tập.</CardDescription>
            </div>
            {user.role === "ADMIN" && <CsvImport classId={classId} />}
          </CardHeader>
          <CardContent className="grid gap-4">
            <AddStudents classId={classId} />
            {active.length === 0 ? (
              <EmptyState icon={Users} title="Lớp chưa có học viên" description="Tìm và thêm học viên ở ô phía trên." />
            ) : (
              <ul className="divide-y divide-line">
                {active.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={m.student.user.fullName} />
                    <span className="grid min-w-0 flex-1">
                      {user.role === "ADMIN" ? (
                        <Link href={`/app/admin/users/${m.student.user.id}`} className="truncate font-medium text-ink hover:text-blue-700">
                          {m.student.user.fullName}
                        </Link>
                      ) : (
                        <span className="truncate font-medium text-ink">{m.student.user.fullName}</span>
                      )}
                      <span className="truncate text-sm text-ink-muted">
                        {m.student.studentCode} · vào lớp {formatDate(m.joinedAt)}
                        {m.student.parents[0] && ` · PH: ${m.student.parents[0].parent.user.fullName}${m.student.parents[0].parent.user.phone ? ` (${m.student.parents[0].parent.user.phone})` : ""}`}
                      </span>
                    </span>
                    <MemberActions classId={classId} studentId={m.student.id} name={m.student.user.fullName} targets={targets} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Lịch sử</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-line text-sm">
                {history.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-ink">{m.student.user.fullName}</span>
                    <span className="flex items-center gap-2 text-ink-muted">
                      <Badge tone="neutral">{HISTORY_LABEL[m.status]}</Badge>
                      {m.transferredTo && `→ ${m.transferredTo.code}`}
                      {m.leftAt && ` · ${formatDate(m.leftAt)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
      <Card className="self-start">
        <CardHeader>
          <CardTitle>Nhóm trong lớp</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupsManager classId={classId} groups={data.groups} members={active.map((m) => ({ studentId: m.student.id, name: m.student.user.fullName }))} />
        </CardContent>
      </Card>
    </div>
  );
}
