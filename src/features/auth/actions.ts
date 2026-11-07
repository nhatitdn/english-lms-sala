"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { changePasswordSchema } from "@/features/users/schemas";
import { audit } from "@/server/audit";
import { signIn, signOut } from "@/server/auth/config";
import { getCurrentUser } from "@/server/auth/current-user";
import { LOGIN_ERROR_MESSAGES, type LoginErrorCode } from "@/server/auth/login";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { formDataToObject } from "@/server/action";
import { z } from "zod";

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; values?: Record<string, string> } | null;

/** Only allow internal redirects into the app area (prevents open redirects). */
function safeCallback(raw: unknown): string {
  return typeof raw === "string" && /^\/app(\/[\w\-/]*)?$/.test(raw) ? raw : "/app";
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!login || !password) {
    return { error: "Vui lòng nhập tên đăng nhập và mật khẩu.", values: { login } };
  }
  try {
    await signIn("credentials", { login, password, redirectTo: safeCallback(formData.get("callbackUrl")) });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error instanceof CredentialsSignin ? error.code : "invalid") as LoginErrorCode;
      return { error: LOGIN_ERROR_MESSAGES[code] ?? LOGIN_ERROR_MESSAGES.invalid, values: { login } };
    }
    throw error; // includes the success redirect
  }
  return null;
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/dang-nhap" });
}

/** Sign out on every device: bump session_version, then end this session too. */
export async function logoutEverywhereAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    await db.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
    await audit({ actorId: user.id, action: "auth.logout_all", entityType: "user", entityId: user.id });
  }
  await signOut({ redirectTo: "/dang-nhap" });
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/dang-nhap");

  const parsed = changePasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { currentPassword, newPassword } = parsed.data;
  if (newPassword.toLowerCase().includes(user.username.toLowerCase())) {
    return { fieldErrors: { newPassword: ["Mật khẩu không được chứa tên đăng nhập."] } };
  }

  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(row.passwordHash, currentPassword))) {
    return { fieldErrors: { currentPassword: ["Mật khẩu hiện tại không đúng."] } };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false, sessionVersion: { increment: 1 } },
  });
  await audit({ actorId: user.id, action: "auth.change_password", entityType: "user", entityId: user.id });

  // Other devices are now signed out (session_version changed). Sign this device back in with the new password.
  await signIn("credentials", { login: user.username, password: newPassword, redirectTo: "/app?doi-mat-khau=ok" });
  return null;
}
