import { Search, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/design-system/states";
import { PageHeader } from "@/components/design-system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listUsers } from "@/features/users/queries";
import { userListQuerySchema } from "@/features/users/schemas";
import { ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Người dùng" };

const ROLE_FILTERS = [
  { value: undefined, label: "Tất cả" },
  { value: "STUDENT", label: "Học viên" },
  { value: "PARENT", label: "Phụ huynh" },
  { value: "TEACHER", label: "Giáo viên" },
  { value: "ADMIN", label: "Quản trị" },
] as const;

const STATUS_TONE = { ACTIVE: "success", LOCKED: "warning", DISABLED: "neutral" } as const;

export default async function UsersPage({ searchParams }: PageProps<"/app/admin/users">) {
  const user = await requireRole("ADMIN");
  const query = userListQuerySchema.parse(await searchParams);
  const { rows, total, pageCount } = await listUsers(user, query);

  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: query.q, role: query.role, status: query.status, page: query.page, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) params.set(k, String(v));
    const s = params.toString();
    return `/app/admin/users${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Người dùng"
        description={`${total} tài khoản`}
        actions={
          <Link href="/app/admin/users/new" className={buttonVariants({ variant: "primary" })}>
            <UserPlus /> Tạo tài khoản
          </Link>
        }
      />

      <form className="mb-3 flex gap-2" role="search">
        {query.role && <input type="hidden" name="role" value={query.role} />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input name="q" defaultValue={query.q} placeholder="Tìm theo tên, tên đăng nhập, SĐT, mã HV…" className="pl-9" aria-label="Tìm người dùng" />
        </div>
        <Button type="submit" variant="outline">
          Tìm
        </Button>
      </form>

      <nav className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Lọc theo vai trò">
        {ROLE_FILTERS.map((f) => {
          const active = query.role === f.value;
          return (
            <Link
              key={f.label}
              href={href({ role: f.value, page: 1 })}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap",
                active ? "border-blue-600 bg-sky-100 text-blue-700" : "border-line bg-surface text-ink hover:bg-sky-50",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          title={query.q ? "Không tìm thấy người dùng phù hợp" : "Chưa có tài khoản nào"}
          description={query.q ? "Thử từ khóa khác hoặc bỏ bộ lọc." : "Tạo tài khoản đầu tiên cho giáo viên, học viên hoặc phụ huynh."}
        />
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="grid gap-2 md:hidden">
            {rows.map((u) => (
              <li key={u.id}>
                <Link href={`/app/admin/users/${u.id}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 shadow-card">
                  <Avatar name={u.fullName} />
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-medium text-ink">{u.fullName}</span>
                    <span className="truncate text-sm text-ink-muted">
                      {u.username}
                      {u.student && ` · ${u.student.studentCode}`}
                    </span>
                  </span>
                  <span className="grid justify-items-end gap-1">
                    <Badge tone="blue">{ROLE_LABELS[u.role]}</Badge>
                    {u.status !== "ACTIVE" && <Badge tone={STATUS_TONE[u.status]}>{USER_STATUS_LABELS[u.status]}</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {/* Tablet & desktop: table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Tên đăng nhập</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Liên hệ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Đăng nhập gần nhất</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Link href={`/app/admin/users/${u.id}`} className="flex items-center gap-2.5 font-medium hover:text-blue-700">
                        <Avatar name={u.fullName} className="size-8 text-xs" />
                        {u.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-ink-muted">
                      {u.username}
                      {u.student && <span className="block text-xs">{u.student.studentCode}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge tone="blue">{ROLE_LABELS[u.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-ink-muted">{u.phone ?? u.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONE[u.status]}>{USER_STATUS_LABELS[u.status]}</Badge>
                      {u.mustChangePassword && <span className="mt-1 block text-xs text-ink-muted">Chưa đổi mật khẩu tạm</span>}
                    </TableCell>
                    <TableCell className="text-ink-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Chưa đăng nhập"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {pageCount > 1 && (
            <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Phân trang">
              <span className="text-ink-muted">
                Trang {query.page}/{pageCount}
              </span>
              <span className="flex gap-2">
                {query.page > 1 && (
                  <Link href={href({ page: query.page - 1 })} className={buttonVariants({ size: "sm" })}>
                    Trước
                  </Link>
                )}
                {query.page < pageCount && (
                  <Link href={href({ page: query.page + 1 })} className={buttonVariants({ size: "sm" })}>
                    Sau
                  </Link>
                )}
              </span>
            </nav>
          )}
        </>
      )}
    </>
  );
}
