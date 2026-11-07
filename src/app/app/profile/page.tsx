import { KeyRound, LogOut, MonitorSmartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/design-system/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { logoutAction, logoutEverywhereAction } from "@/features/auth/actions";
import { ROLE_LABELS } from "@/lib/constants";
import { requireUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Tài khoản" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Tài khoản của tôi" />
      <div className="grid max-w-2xl gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-4 sm:pt-6">
            <Avatar name={user.fullName} className="size-14 text-lg" />
            <div>
              <p className="text-lg font-semibold text-ink">{user.fullName}</p>
              <p className="text-ink-muted">
                {ROLE_LABELS[user.role]} · Tên đăng nhập: <strong className="text-ink">{user.username}</strong>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Bảo mật</CardTitle>
              <CardDescription>Thông tin cá nhân do lớp học quản lý. Cần sửa họ tên, email hay số điện thoại, vui lòng báo quản trị viên.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/doi-mat-khau" className={buttonVariants({ variant: "outline" })}>
              <KeyRound /> Đổi mật khẩu
            </Link>
            <form action={logoutEverywhereAction}>
              <Button type="submit" variant="outline">
                <MonitorSmartphone /> Đăng xuất mọi thiết bị
              </Button>
            </form>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" className="text-danger">
                <LogOut /> Đăng xuất
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
