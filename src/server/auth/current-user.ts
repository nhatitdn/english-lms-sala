import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { ROLE_HOME } from "@/lib/constants";
import { db } from "../db";
import { auth } from "./config";

/** Admin sessions expire sooner than the 7-day cookie. */
export const ADMIN_SESSION_MAX_AGE_SEC = 12 * 60 * 60;

export type CurrentUser = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
  studentId: string | null;
  teacherId: string | null;
  parentId: string | null;
};

/**
 * Data Access Layer entry point: the signed-in user, re-validated against the database on every request
 * (status, soft delete, session_version). Returns null when there is no valid session.
 * Memoised per request with React cache().
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const claims = session?.user;
  if (!claims?.id) return null;

  const user = await db.user.findUnique({
    where: { id: claims.id },
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      status: true,
      deletedAt: true,
      sessionVersion: true,
      mustChangePassword: true,
      student: { select: { id: true } },
      teacher: { select: { id: true } },
      parent: { select: { id: true } },
    },
  });

  if (!user || user.deletedAt || user.status !== "ACTIVE") return null;
  if (user.sessionVersion !== claims.sv) return null; // password changed / logged out everywhere
  if (user.role !== claims.role) return null; // role changed by admin → force a fresh login
  if (user.role === "ADMIN" && Date.now() / 1000 - claims.loginAt > ADMIN_SESSION_MAX_AGE_SEC) return null;

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    studentId: user.student?.id ?? null,
    teacherId: user.teacher?.id ?? null,
    parentId: user.parent?.id ?? null,
  };
});

/** For pages/layouts: redirect to login (or to the forced password change) when needed. */
export async function requireUser(options: { allowMustChangePassword?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/dang-nhap");
  if (user.mustChangePassword && !options.allowMustChangePassword) redirect("/doi-mat-khau");
  return user;
}

/** For pages/layouts of one role area: users of another role are sent back to their own dashboard. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}
