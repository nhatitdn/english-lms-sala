import "server-only";
import type { CurrentUser } from "../auth/current-user";
import { db } from "../db";

/**
 * Resource policies. Pure "can X?" checks against the database, used by every service.
 * Rule of thumb: a user may only reach a class/student through a relationship that exists in the DB.
 */

export function isAdmin(user: CurrentUser): boolean {
  return user.role === "ADMIN";
}

/** ADMIN, or a teacher assigned to the class. */
export async function canManageClass(user: CurrentUser, classId: string): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (user.role !== "TEACHER" || !user.teacherId) return false;
  const row = await db.classTeacher.findFirst({
    where: { classId, teacherId: user.teacherId, class: { deletedAt: null } },
    select: { classId: true },
  });
  return row !== null;
}

/** Managers of the class, active student members, and parents of active student members. */
export async function canViewClass(user: CurrentUser, classId: string): Promise<boolean> {
  if (await canManageClass(user, classId)) return true;
  if (user.role === "STUDENT" && user.studentId) {
    const m = await db.classMember.findFirst({
      where: { classId, studentId: user.studentId, status: "ACTIVE", class: { deletedAt: null } },
      select: { id: true },
    });
    return m !== null;
  }
  if (user.role === "PARENT" && user.parentId) {
    const m = await db.classMember.findFirst({
      where: {
        classId,
        status: "ACTIVE",
        class: { deletedAt: null },
        student: { parents: { some: { parentId: user.parentId } } },
      },
      select: { id: true },
    });
    return m !== null;
  }
  return false;
}

/** ADMIN; the student themself; a linked parent; a teacher of any class the student is (or was) in. */
export async function canViewStudent(user: CurrentUser, studentId: string): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (user.role === "STUDENT") return user.studentId === studentId;
  if (user.role === "PARENT" && user.parentId) {
    const link = await db.parentStudent.findUnique({
      where: { parentId_studentId: { parentId: user.parentId, studentId } },
      select: { studentId: true },
    });
    return link !== null;
  }
  if (user.role === "TEACHER" && user.teacherId) {
    const m = await db.classMember.findFirst({
      where: { studentId, class: { deletedAt: null, teachers: { some: { teacherId: user.teacherId } } } },
      select: { id: true },
    });
    return m !== null;
  }
  return false;
}

/** Student ids a parent may see. */
export async function linkedStudentIds(user: CurrentUser): Promise<string[]> {
  if (user.role !== "PARENT" || !user.parentId) return [];
  const links = await db.parentStudent.findMany({ where: { parentId: user.parentId }, select: { studentId: true } });
  return links.map((l) => l.studentId);
}
