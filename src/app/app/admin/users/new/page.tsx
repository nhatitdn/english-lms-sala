import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/design-system/page-header";
import { CreateUserForm } from "@/features/users/components/create-user-form";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Tạo tài khoản" };

export default async function NewUserPage() {
  await requireRole("ADMIN");
  return (
    <>
      <Link href="/app/admin/users" className="text-sm text-blue-600 hover:underline">
        ← Người dùng
      </Link>
      <PageHeader title="Tạo tài khoản" description="Hệ thống tạo mật khẩu tạm; người dùng đổi mật khẩu ở lần đăng nhập đầu tiên." className="mt-2" />
      <CreateUserForm />
    </>
  );
}
