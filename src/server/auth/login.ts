import "server-only";
import type { Role } from "@/generated/prisma/enums";
import { db } from "../db";
import { audit } from "../audit";
import { consumeRateLimit } from "../rate-limit";
import { getDummyHash, verifyPassword } from "./password";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
export const IP_LOGIN_LIMIT = 20;
export const IP_LOGIN_WINDOW_SEC = 15 * 60;

export type LoginErrorCode = "invalid" | "locked" | "disabled" | "rate_limited";

export type AuthenticatedUser = {
  id: string;
  role: Role;
  sessionVersion: number;
  mustChangePassword: boolean;
};

export type LoginResult = { ok: true; user: AuthenticatedUser } | { ok: false; code: LoginErrorCode };

/**
 * Verify a username/email + password. All brute-force protection lives here:
 * per-IP rate limit, per-account lockout after MAX_FAILED_LOGINS failures, constant-ish timing.
 */
export async function authenticate(identifier: string, password: string, ip: string | null): Promise<LoginResult> {
  const login = identifier.trim();
  if (!login || !password) return { ok: false, code: "invalid" };

  if (ip) {
    const limit = await consumeRateLimit(`login:ip:${ip}`, IP_LOGIN_LIMIT, IP_LOGIN_WINDOW_SEC);
    if (!limit.allowed) return { ok: false, code: "rate_limited" };
  }

  // username and email are citext → case-insensitive match
  const user = await db.user.findFirst({
    where: { deletedAt: null, OR: [{ username: login }, { email: login }] },
    select: {
      id: true,
      role: true,
      status: true,
      passwordHash: true,
      sessionVersion: true,
      mustChangePassword: true,
      failedLoginCount: true,
      lockedUntil: true,
    },
  });

  if (!user) {
    await verifyPassword(await getDummyHash(), password); // keep timing similar
    return { ok: false, code: "invalid" };
  }

  if (user.status === "DISABLED") return { ok: false, code: "disabled" };
  if (user.status === "LOCKED") return { ok: false, code: "locked" };
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return { ok: false, code: "locked" };

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    const failures = user.failedLoginCount + 1;
    const lock = failures >= MAX_FAILED_LOGINS;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: lock ? 0 : failures,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil,
      },
    });
    await audit({
      actorId: null,
      action: lock ? "auth.account_locked" : "auth.login_failed",
      entityType: "user",
      entityId: user.id,
      metadata: { failures, ip },
    });
    return { ok: false, code: lock ? "locked" : "invalid" };
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await audit({ actorId: user.id, action: "auth.login", entityType: "user", entityId: user.id, metadata: { ip } });

  return {
    ok: true,
    user: {
      id: user.id,
      role: user.role,
      sessionVersion: user.sessionVersion,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

export const LOGIN_ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  invalid: "Tên đăng nhập hoặc mật khẩu không đúng.",
  locked: `Tài khoản tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${LOCK_MINUTES} phút hoặc liên hệ quản trị viên.`,
  disabled: "Tài khoản đã ngừng sử dụng. Vui lòng liên hệ quản trị viên.",
  rate_limited: "Bạn thử đăng nhập quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.",
};
