import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/server/auth/current-user";
import { canManageClass, canViewClass } from "@/server/authz/policies";
import { db } from "@/server/db";

/** Classes the user may see, with headline numbers. */
export async function listClassesFor(user: CurrentUser) {
  let where: Prisma.ClassWhereInput = { deletedAt: null };
  if (user.role === "TEACHER") where = { ...where, teachers: { some: { teacherId: user.teacherId ?? "" } } };
  if (user.role === "STUDENT") where = { ...where, members: { some: { studentId: user.studentId ?? "", status: "ACTIVE" } } };
  if (user.role === "PARENT") where = { ...where, members: { some: { status: "ACTIVE", student: { parents: { some: { parentId: user.parentId ?? "" } } } } } };

  return db.class.findMany({
    where,
    orderBy: [{ status: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      level: true,
      status: true,
      location: true,
      startDate: true,
      endDate: true,
      ageMin: true,
      ageMax: true,
      teachers: { select: { role: true, teacher: { select: { displayName: true } } }, orderBy: { role: "asc" } },
      schedules: { select: { weekday: true, startTime: true, endTime: true }, orderBy: { weekday: "asc" } },
      _count: { select: { members: { where: { status: "ACTIVE" } } } },
    },
  });
}

export type ClassAccess = { canView: boolean; canManage: boolean };

/** Header data for a class page plus what the user may do there. Returns null when not visible (→ 404). */
export async function getClassHeader(user: CurrentUser, classId: string) {
  const canView = await canViewClass(user, classId);
  if (!canView) return null;
  const canManage = await canManageClass(user, classId);
  const cls = await db.class.findFirst({
    where: { id: classId, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      level: true,
      status: true,
      location: true,
      startDate: true,
      endDate: true,
      ageMin: true,
      ageMax: true,
      maxStudents: true,
      teachers: { select: { role: true, teacher: { select: { displayName: true, user: { select: { id: true, fullName: true } } } } }, orderBy: { role: "asc" } },
      schedules: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
      _count: { select: { members: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!cls) return null;
  return { cls, access: { canView, canManage } satisfies ClassAccess };
}

/** Full member list incl. history. Managers only. */
export async function getClassMembers(user: CurrentUser, classId: string) {
  if (!(await canManageClass(user, classId))) return null;
  const [members, groups] = await Promise.all([
    db.classMember.findMany({
      where: { classId },
      orderBy: [{ status: "asc" }, { joinedAt: "asc" }],
      select: {
        id: true,
        status: true,
        joinedAt: true,
        leftAt: true,
        note: true,
        transferredTo: { select: { code: true, name: true } },
        student: {
          select: {
            id: true,
            studentCode: true,
            dateOfBirth: true,
            user: { select: { id: true, fullName: true, username: true, phone: true } },
            parents: { select: { parent: { select: { user: { select: { fullName: true, phone: true } } } } } },
          },
        },
      },
    }),
    db.classGroup.findMany({ where: { classId }, orderBy: { name: "asc" }, select: { id: true, name: true, members: { select: { studentId: true } } } }),
  ]);
  return { members, groups };
}

/** Students that can be added (not ACTIVE in this class). Managers only, minimal fields. */
export async function searchStudentsToAdd(user: CurrentUser, classId: string, q: string) {
  if (!(await canManageClass(user, classId))) return [];
  const term = q.trim();
  if (term.length < 2) return [];
  return db.student.findMany({
    where: {
      user: { deletedAt: null, status: "ACTIVE" },
      memberships: { none: { classId, status: "ACTIVE" } },
      OR: [
        { user: { fullName: { contains: term, mode: "insensitive" } } },
        { user: { username: { contains: term, mode: "insensitive" } } },
        { studentCode: { contains: term, mode: "insensitive" } },
      ],
    },
    take: 10,
    orderBy: { user: { fullName: "asc" } },
    select: {
      id: true,
      studentCode: true,
      user: { select: { fullName: true, username: true } },
      memberships: { where: { status: "ACTIVE" }, select: { class: { select: { code: true } } } },
    },
  });
}

/** Other classes the user manages (transfer targets). */
export async function transferTargets(user: CurrentUser, excludeClassId: string) {
  return db.class.findMany({
    where: {
      deletedAt: null,
      id: { not: excludeClassId },
      status: { in: ["PLANNED", "ACTIVE"] },
      ...(user.role === "ADMIN" ? {} : { teachers: { some: { teacherId: user.teacherId ?? "" } } }),
    },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export async function upcomingSessions(user: CurrentUser, classId: string, take = 12) {
  if (!(await canViewClass(user, classId))) return [];
  return db.classSession.findMany({
    where: { classId, startsAt: { gte: new Date(Date.now() - 3 * 3600_000) } },
    orderBy: { startsAt: "asc" },
    take,
    select: { id: true, startsAt: true, endsAt: true, status: true, topic: true, note: true },
  });
}

export async function teacherOptions() {
  return db.teacher.findMany({
    where: { user: { deletedAt: null, status: "ACTIVE" } },
    orderBy: { displayName: "asc" },
    select: { displayName: true, user: { select: { id: true, fullName: true } } },
  });
}
