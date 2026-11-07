import type { Metadata } from "next";
import Link from "next/link";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { requireUser } from "@/server/auth/current-user";
import { ROLE_HOME } from "@/lib/constants";

export const metadata: Metadata = { title: "Đổi mật khẩu", robots: { index: false } };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowMustChangePassword: true });
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold text-ink">Đổi mật khẩu</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Tài khoản: <strong className="text-ink">{user.username}</strong>
      </p>
      <ChangePasswordForm forced={user.mustChangePassword} />
      {!user.mustChangePassword && (
        <Link href={ROLE_HOME[user.role]} className="mt-4 block text-center text-sm text-blue-600 hover:underline">
          Quay lại
        </Link>
      )}
    </>
  );
}
