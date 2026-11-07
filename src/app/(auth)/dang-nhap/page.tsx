import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUser } from "@/server/auth/current-user";
import { ROLE_HOME } from "@/lib/constants";

export const metadata: Metadata = { title: "Đăng nhập", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/dang-nhap">) {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/doi-mat-khau" : ROLE_HOME[user.role]);
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : undefined;
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold text-ink">Đăng nhập</h1>
      <p className="mb-5 text-sm text-ink-muted">Dùng tài khoản do lớp học cấp cho bạn.</p>
      <LoginForm callbackUrl={callbackUrl} />
    </>
  );
}
