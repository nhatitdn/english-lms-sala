import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/design-system/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { AccountActions } from "@/features/users/components/account-actions";
import { EditUserForm } from "@/features/users/components/edit-user-form";
import { ParentLinks } from "@/features/users/components/parent-links";
import { getUserDetail } from "@/features/users/queries";
import { ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Chi tiết tài khoản" };

const STATUS_TONE = { ACTIVE: "success", LOCKED: "warning", DISABLED: "neutral" } as const;

function isMinor(dob: Date | null): boolean {
  if (!dob) return false;
  const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
  return age < 18;
}

export default async function UserDetailPage({ params }: PageProps<"/app/admin/users/[id]">) {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const u = await getUserDetail(admin, id);
  if (!u) notFound();

  const s = u.student;
  const values = {
    username: u.username,
    fullName: u.fullName,
    email: u.email ?? "",
    phone: u.phone ?? "",
    dateOfBirth: s?.dateOfBirth ? s.dateOfBirth.toISOString().slice(0, 10) : "",
    school: s?.school ?? "",
    currentLevel: s?.currentLevel ?? "",
    isIndependent: s?.isIndependent ?? false,
    guardianConsent: !!s?.guardianConsentAt,
    privateNotes: s?.privateNotes ?? "",
    displayName: u.teacher?.displayName ?? "",
    qualifications: u.teacher?.qualifications ?? "",
  };
  const minorWithoutConsent = s && !s.isIndependent && isMinor(s.dateOfBirth) && !s.guardianConsentAt;

  return (
    <>
      <Link href="/app/admin/users" className="text-sm text-blue-600 hover:underline">
        ← Người dùng
      </Link>
      <PageHeader
        className="mt-2"
        title={u.fullName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{ROLE_LABELS[u.role]}</Badge>
            <Badge tone={STATUS_TONE[u.status]}>{USER_STATUS_LABELS[u.status]}</Badge>
            {s && <span>{s.studentCode}</span>}
            <span>· Tạo ngày {formatDate(u.createdAt)}</span>
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-4 lg:col-span-2">
          {minorWithoutConsent && (
            <Alert tone="warning" title="Chưa có xác nhận đồng ý của phụ huynh">
              Học viên dưới 18 tuổi. Hãy xác nhận phụ huynh đã đồng ý trước khi đưa vào lớp.
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Thông tin</CardTitle>
            </CardHeader>
            <CardContent>
              <EditUserForm id={u.id} values={values} kind={s ? "student" : u.teacher ? "teacher" : "other"} />
            </CardContent>
          </Card>

          {(u.role === "PARENT" || u.role === "STUDENT") && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{u.role === "PARENT" ? "Con được liên kết" : "Phụ huynh"}</CardTitle>
                  <CardDescription>Phụ huynh chỉ xem được kết quả của học viên được liên kết.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {u.role === "PARENT" ? (
                  <ParentLinks
                    selfUserId={u.id}
                    side="PARENT"
                    linked={(u.parent?.children ?? []).map((c) => ({
                      userId: c.student.user.id,
                      fullName: c.student.user.fullName,
                      username: c.student.user.username,
                      relationship: c.relationship,
                      extra: c.student.studentCode,
                    }))}
                  />
                ) : (
                  <ParentLinks
                    selfUserId={u.id}
                    side="STUDENT"
                    linked={(s?.parents ?? []).map((p) => ({
                      userId: p.parent.user.id,
                      fullName: p.parent.user.fullName,
                      username: p.parent.user.username,
                      relationship: p.relationship,
                      extra: p.parent.user.phone,
                    }))}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Tài khoản</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Tên đăng nhập</dt>
                  <dd className="font-medium text-ink">{u.username}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">Đăng nhập gần nhất</dt>
                  <dd className="text-ink">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Chưa đăng nhập"}</dd>
                </div>
                {u.mustChangePassword && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Mật khẩu</dt>
                    <dd className="text-warning">Đang dùng mật khẩu tạm</dd>
                  </div>
                )}
                {u.lockedUntil && u.lockedUntil > new Date() && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Tạm khóa đến</dt>
                    <dd className="text-warning">{formatDateTime(u.lockedUntil)}</dd>
                  </div>
                )}
              </dl>
              <AccountActions id={u.id} username={u.username} fullName={u.fullName} status={u.status} isSelf={u.id === admin.id} />
            </CardContent>
          </Card>

          {s && (
            <Card>
              <CardHeader>
                <CardTitle>Lớp đang học</CardTitle>
              </CardHeader>
              <CardContent>
                {s.memberships.length === 0 ? (
                  <p className="text-sm text-ink-muted">Chưa vào lớp nào. Quản lý lớp có ở giai đoạn 2.</p>
                ) : (
                  <ul className="grid gap-1 text-sm">
                    {s.memberships.map((m) => (
                      <li key={m.class.id} className="text-ink">
                        {m.class.code} · {m.class.name}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
