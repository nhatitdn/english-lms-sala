import { BookOpen, ClipboardCheck, ClipboardList, GraduationCap, School, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/design-system/states";
import { PageHeader } from "@/components/design-system/page-header";
import { StatCard } from "@/components/design-system/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminDashboard } from "@/features/dashboard/queries";
import { recentActivity } from "@/features/users/queries";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDateTime, formatLongDate } from "@/lib/datetime";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Tổng quan quản trị" };

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "đăng nhập",
  "auth.login_failed": "đăng nhập sai mật khẩu",
  "auth.account_locked": "tài khoản bị tạm khóa",
  "auth.change_password": "đổi mật khẩu",
  "auth.logout_all": "đăng xuất mọi thiết bị",
  "user.create": "tạo tài khoản",
  "user.update": "sửa tài khoản",
  "user.reset_password": "cấp lại mật khẩu",
  "user.status_locked": "khóa tài khoản",
  "user.status_active": "mở khóa tài khoản",
  "user.status_disabled": "ngừng tài khoản",
  "user.link_parent": "liên kết phụ huynh",
  "user.unlink_parent": "bỏ liên kết phụ huynh",
};

export default async function AdminDashboard() {
  const user = await requireRole("ADMIN");
  const [d, activity] = await Promise.all([getAdminDashboard(user), recentActivity(user)]);

  return (
    <>
      <PageHeader
        title={`Chào ${user.fullName.split(" ").pop()}`}
        description={formatLongDate(new Date())}
        actions={
          <Link href="/app/admin/users/new" className={buttonVariants({ variant: "primary" })}>
            <UserPlus /> Tạo tài khoản
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Lớp đang hoạt động" value={d.classes} icon={School} tone="blue" />
        <StatCard label="Giáo viên" value={d.teachers} icon={GraduationCap} tone="gold" href="/app/admin/users?role=TEACHER" />
        <StatCard label="Học viên" value={d.students} icon={Users} tone="orange" href="/app/admin/users?role=STUDENT" />
        <StatCard label="Bài tập đã giao" value={d.publishedAssignments} icon={BookOpen} tone="blue" />
        <StatCard label="Lượt chưa nộp bài" value={d.notSubmitted} icon={ClipboardList} tone="danger" />
        <StatCard label="Bài chờ chấm" value={d.waitingGrade} icon={ClipboardCheck} tone="success" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tài khoản mới tạo</CardTitle>
            <Link href="/app/admin/users" className="text-sm text-blue-600 hover:underline">
              Xem tất cả
            </Link>
          </CardHeader>
          <CardContent>
            {d.recentUsers.length === 0 ? (
              <EmptyState title="Chưa có tài khoản" description="Tạo tài khoản giáo viên, học viên và phụ huynh để bắt đầu." />
            ) : (
              <ul className="divide-y divide-line">
                {d.recentUsers.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/app/admin/users/${u.id}`} className="truncate font-medium text-ink hover:text-blue-700">
                      {u.fullName}
                    </Link>
                    <Badge tone="neutral">{ROLE_LABELS[u.role]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hoạt động gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <EmptyState title="Chưa có hoạt động" />
            ) : (
              <ul className="divide-y divide-line text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="text-ink">
                      <strong className="font-medium">{a.actor?.fullName ?? "Hệ thống"}</strong> {ACTION_LABELS[a.action] ?? a.action}
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted">{formatDateTime(a.createdAt)}</span>
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
