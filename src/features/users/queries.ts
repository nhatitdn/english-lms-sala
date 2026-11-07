import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { forbiddenError } from "@/server/errors";
import type { UserListQuery } from "./schemas";

export const USER_PAGE_SIZE = 20;

function assertAdmin(actor: CurrentUser) {
  if (actor.role !== "ADMIN") throw forbiddenError();
}

export async function listUsers(actor: CurrentUser, query: UserListQuery) {
  assertAdmin(actor);
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query.role ? { role: query.role } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { fullName: { contains: query.q, mode: "insensitive" } },
            { username: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
            { phone: { contains: query.q } },
            { student: { studentCode: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
      skip: (query.page - 1) * USER_PAGE_SIZE,
      take: USER_PAGE_SIZE,
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        mustChangePassword: true,
        student: { select: { studentCode: true, isIndependent: true } },
      },
    }),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / USER_PAGE_SIZE)) };
}

export async function getUserDetail(actor: CurrentUser, id: string) {
  assertAdmin(actor);
  return db.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      mustChangePassword: true,
      lastLoginAt: true,
      lockedUntil: true,
      createdAt: true,
      student: {
        select: {
          id: true,
          studentCode: true,
          dateOfBirth: true,
          school: true,
          currentLevel: true,
          isIndependent: true,
          guardianConsentAt: true,
          privateNotes: true,
          parents: {
            select: { relationship: true, parent: { select: { user: { select: { id: true, fullName: true, username: true, phone: true } } } } },
          },
          memberships: {
            where: { status: "ACTIVE" },
            select: { class: { select: { id: true, code: true, name: true } } },
          },
        },
      },
      teacher: { select: { id: true, slug: true, displayName: true, qualifications: true } },
      parent: {
        select: {
          id: true,
          children: {
            select: {
              relationship: true,
              student: { select: { studentCode: true, user: { select: { id: true, fullName: true, username: true } } } },
            },
          },
        },
      },
    },
  });
}

/** Search candidates for parent ↔ student linking. */
export async function searchUsersByRole(actor: CurrentUser, role: "PARENT" | "STUDENT", q: string) {
  assertAdmin(actor);
  const term = q.trim();
  if (term.length < 2) return [];
  return db.user.findMany({
    where: {
      role,
      deletedAt: null,
      OR: [
        { fullName: { contains: term, mode: "insensitive" } },
        { username: { contains: term, mode: "insensitive" } },
        { phone: { contains: term } },
      ],
    },
    take: 8,
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, username: true, phone: true },
  });
}

export async function recentActivity(actor: CurrentUser, take = 8) {
  assertAdmin(actor);
  return db.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, action: true, createdAt: true, actor: { select: { fullName: true } } },
  });
}
