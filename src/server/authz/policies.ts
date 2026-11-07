import "server-only";
import type { Prisma } from "@/generated/prisma/client";
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

// ───────────────────────── Lessons & files ─────────────────────────


/** Prisma filter: lessons this user may open. */
export function visibleLessonWhere(user: CurrentUser, now: Date = new Date()): Prisma.LessonWhereInput {
  const base: Prisma.LessonWhereInput = { deletedAt: null };
  switch (user.role) {
    case "ADMIN":
      return base;
    case "TEACHER":
      // own lessons (any status) + every published lesson (teachers reuse each other's material)
      return { ...base, OR: [{ authorId: user.id }, { status: "PUBLISHED" }] };
    case "STUDENT":
      return {
        ...base,
        status: "PUBLISHED",
        classes: {
          some: {
            OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }],
            class: { deletedAt: null, members: { some: { studentId: user.studentId ?? "", status: "ACTIVE" } } },
          },
        },
      };
    default:
      return { id: "00000000-0000-0000-0000-000000000000" }; // parents: no lesson access
  }
}

export async function canViewLesson(user: CurrentUser, lessonId: string): Promise<boolean> {
  const row = await db.lesson.findFirst({ where: { AND: [{ id: lessonId }, visibleLessonWhere(user)] }, select: { id: true } });
  return row !== null;
}

/** Only the author or an admin edits a lesson. */
export async function canEditLesson(user: CurrentUser, lessonId: string): Promise<boolean> {
  if (user.role !== "ADMIN" && user.role !== "TEACHER") return false;
  const row = await db.lesson.findFirst({
    where: { id: lessonId, deletedAt: null, ...(user.role === "ADMIN" ? {} : { authorId: user.id }) },
    select: { id: true },
  });
  return row !== null;
}

export type AccessibleFile = { id: string; storageKey: string; mimeType: string; originalName: string; sizeBytes: bigint; kind: string };

/**
 * Can this user download/stream the file? Derived from what the file belongs to — there is no
 * per-file ACL. Returns the file row or null (→ 404).
 */
export async function canAccessFile(user: CurrentUser, fileId: string): Promise<AccessibleFile | null> {
  const file = await db.file.findFirst({
    where: { id: fileId, deletedAt: null },
    select: { id: true, storageKey: true, mimeType: true, originalName: true, sizeBytes: true, kind: true, visibility: true, uploadedBy: true },
  });
  if (!file) return null;
  if (file.visibility === "PUBLIC" || user.role === "ADMIN" || file.uploadedBy === user.id) return file;
  if (user.role === "PARENT") return null;

  const lessonVisible = visibleLessonWhere(user);
  if (user.role === "TEACHER") {
    const material = await db.learningMaterial.findFirst({
      where: { fileId, deletedAt: null, OR: [{ sharedWithTeachers: true }, { ownerId: user.id }] },
      select: { id: true },
    });
    if (material) return file;
  }
  const [attached, audio, embedded] = await Promise.all([
    db.lessonAttachment.findFirst({ where: { material: { fileId, deletedAt: null }, lesson: lessonVisible }, select: { id: true } }),
    db.audioLesson.findFirst({ where: { OR: [{ audioFileId: fileId }, { coverFileId: fileId }], lesson: lessonVisible }, select: { id: true } }),
    db.lesson.findFirst({ where: { AND: [lessonVisible, { contentFileIds: { has: fileId } }] }, select: { id: true } }),
  ]);
  return attached || audio || embedded ? file : null;
}
