import "server-only";
import { TZDate } from "@date-fns/tz";
import { Prisma } from "@/generated/prisma/client";
import { createUser } from "@/features/users/service";
import { createUserSchema } from "@/features/users/schemas";
import { parseCsv, parseVnDate } from "@/lib/csv";
import { APP_TIMEZONE } from "@/lib/datetime";
import { suggestUsername } from "@/lib/text";
import type { CurrentUser } from "@/server/auth/current-user";
import { canManageClass } from "@/server/authz/policies";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError, forbiddenError, notFoundError } from "@/server/errors";
import type { ClassInput } from "./schemas";

function requireAdmin(actor: CurrentUser) {
  if (actor.role !== "ADMIN") throw forbiddenError();
}

/** Throws NOT_FOUND (not FORBIDDEN) so class ids cannot be probed. */
export async function assertCanManage(actor: CurrentUser, classId: string) {
  if (!(await canManageClass(actor, classId))) throw notFoundError();
}

function classData(input: ClassInput) {
  return {
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    level: input.level,
    ageMin: input.ageMin ?? null,
    ageMax: input.ageMax ?? null,
    startDate: new Date(input.startDate),
    endDate: input.endDate ? new Date(input.endDate) : null,
    status: input.status,
    maxStudents: input.maxStudents ?? null,
    location: input.location ?? null,
  };
}

function codeConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AppError("CONFLICT", "Mã lớp đã tồn tại.", { code: ["Mã lớp đã tồn tại."] });
  }
  throw error;
}

// ───────────────────────── Class CRUD (admin) ─────────────────────────

export async function createClass(actor: CurrentUser, input: ClassInput): Promise<{ id: string }> {
  requireAdmin(actor);
  try {
    const created = await db.class.create({ data: classData(input), select: { id: true } });
    await audit({ actorId: actor.id, action: "class.create", entityType: "class", entityId: created.id, metadata: { code: input.code } });
    return created;
  } catch (e) {
    codeConflict(e);
  }
}

export async function updateClass(actor: CurrentUser, id: string, input: ClassInput): Promise<void> {
  requireAdmin(actor);
  const existing = await db.class.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!existing) throw notFoundError();
  try {
    await db.class.update({ where: { id }, data: classData(input) });
  } catch (e) {
    codeConflict(e);
  }
  await audit({ actorId: actor.id, action: "class.update", entityType: "class", entityId: id });
}

/** Soft delete. All history (members, sessions, submissions) is kept. */
export async function archiveClass(actor: CurrentUser, id: string): Promise<void> {
  requireAdmin(actor);
  const res = await db.class.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (res.count === 0) throw notFoundError();
  await audit({ actorId: actor.id, action: "class.archive", entityType: "class", entityId: id });
}

// ───────────────────────── Teachers (admin) ─────────────────────────

export async function assignTeacher(actor: CurrentUser, classId: string, teacherUserId: string, role: "MAIN" | "ASSISTANT") {
  requireAdmin(actor);
  const [cls, teacher] = await Promise.all([
    db.class.findFirst({ where: { id: classId, deletedAt: null }, select: { id: true } }),
    db.teacher.findFirst({ where: { userId: teacherUserId, user: { deletedAt: null, status: "ACTIVE" } }, select: { id: true } }),
  ]);
  if (!cls || !teacher) throw notFoundError();
  await db.classTeacher.upsert({
    where: { classId_teacherId: { classId, teacherId: teacher.id } },
    create: { classId, teacherId: teacher.id, role },
    update: { role },
  });
  await audit({ actorId: actor.id, action: "class.assign_teacher", entityType: "class", entityId: classId, metadata: { teacherId: teacher.id, role } });
}

export async function removeTeacher(actor: CurrentUser, classId: string, teacherUserId: string) {
  requireAdmin(actor);
  const teacher = await db.teacher.findUnique({ where: { userId: teacherUserId }, select: { id: true } });
  if (!teacher) throw notFoundError();
  const res = await db.classTeacher.deleteMany({ where: { classId, teacherId: teacher.id } });
  if (res.count === 0) throw notFoundError();
  await audit({ actorId: actor.id, action: "class.remove_teacher", entityType: "class", entityId: classId, metadata: { teacherId: teacher.id } });
}

// ───────────────────────── Members ─────────────────────────

export async function addStudents(actor: CurrentUser, classId: string, studentIds: string[]): Promise<{ added: number; skipped: number }> {
  await assertCanManage(actor, classId);
  const students = await db.student.findMany({
    where: { id: { in: studentIds }, user: { deletedAt: null } },
    select: { id: true, memberships: { where: { classId, status: "ACTIVE" }, select: { id: true } } },
  });
  const toAdd = students.filter((s) => s.memberships.length === 0).map((s) => s.id);
  if (toAdd.length) {
    await db.classMember.createMany({ data: toAdd.map((studentId) => ({ classId, studentId })) });
  }
  await audit({ actorId: actor.id, action: "class.add_students", entityType: "class", entityId: classId, metadata: { studentIds: toAdd } });
  return { added: toAdd.length, skipped: studentIds.length - toAdd.length };
}

/** Student leaves the class. The membership row is kept (status LEFT) as history. */
export async function removeStudent(actor: CurrentUser, classId: string, studentId: string, note?: string) {
  await assertCanManage(actor, classId);
  const res = await db.classMember.updateMany({
    where: { classId, studentId, status: "ACTIVE" },
    data: { status: "LEFT", leftAt: new Date(), note: note ?? null },
  });
  if (res.count === 0) throw notFoundError();
  await db.classGroupMember.deleteMany({ where: { studentId, group: { classId } } });
  await audit({ actorId: actor.id, action: "class.remove_student", entityType: "class", entityId: classId, metadata: { studentId } });
}

/**
 * Move a student to another class in one transaction. Their old membership becomes TRANSFERRED_OUT
 * (pointing to the new class); submissions, grades and attendance stay attached to the old class — history is kept.
 */
export async function transferStudent(actor: CurrentUser, fromClassId: string, toClassId: string, studentId: string, note?: string) {
  if (fromClassId === toClassId) throw new AppError("VALIDATION_ERROR", "Lớp chuyển đến phải khác lớp hiện tại.");
  await assertCanManage(actor, fromClassId);
  await assertCanManage(actor, toClassId);
  await db.$transaction(async (tx) => {
    const target = await tx.class.findFirst({ where: { id: toClassId, deletedAt: null }, select: { id: true } });
    if (!target) throw notFoundError();
    const moved = await tx.classMember.updateMany({
      where: { classId: fromClassId, studentId, status: "ACTIVE" },
      data: { status: "TRANSFERRED_OUT", leftAt: new Date(), transferredToClassId: toClassId, note: note ?? null },
    });
    if (moved.count === 0) throw notFoundError();
    const already = await tx.classMember.findFirst({ where: { classId: toClassId, studentId, status: "ACTIVE" }, select: { id: true } });
    if (!already) await tx.classMember.create({ data: { classId: toClassId, studentId, note: note ?? null } });
    await tx.classGroupMember.deleteMany({ where: { studentId, group: { classId: fromClassId } } });
    await audit({ actorId: actor.id, action: "class.transfer_student", entityType: "student", entityId: studentId, metadata: { fromClassId, toClassId } }, tx);
  });
}

// ───────────────────────── Groups ─────────────────────────

export async function createGroup(actor: CurrentUser, classId: string, name: string) {
  await assertCanManage(actor, classId);
  try {
    return await db.classGroup.create({ data: { classId, name }, select: { id: true } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AppError("CONFLICT", "Tên nhóm đã có trong lớp.", { name: ["Tên nhóm đã có trong lớp."] });
    throw e;
  }
}

export async function deleteGroup(actor: CurrentUser, classId: string, groupId: string) {
  await assertCanManage(actor, classId);
  const res = await db.classGroup.deleteMany({ where: { id: groupId, classId } });
  if (res.count === 0) throw notFoundError();
}

export async function setGroupMembers(actor: CurrentUser, classId: string, groupId: string, studentIds: string[]) {
  await assertCanManage(actor, classId);
  const group = await db.classGroup.findFirst({ where: { id: groupId, classId }, select: { id: true } });
  if (!group) throw notFoundError();
  // only ACTIVE members of this class can be in its groups
  const valid = await db.classMember.findMany({ where: { classId, status: "ACTIVE", studentId: { in: studentIds } }, select: { studentId: true } });
  await db.$transaction(async (tx) => {
    await tx.classGroupMember.deleteMany({ where: { groupId } });
    await tx.classGroupMember.createMany({ data: valid.map((v) => ({ groupId, studentId: v.studentId })) });
  });
}

// ───────────────────────── Schedules & sessions ─────────────────────────

/** "17:30" → Time column value. Schedule times are Vietnam local times of day. */
function toTime(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, h!, m!));
}

export async function upsertSchedule(
  actor: CurrentUser,
  input: { classId: string; scheduleId?: string; weekday: number; startTime: string; endTime: string; location?: string },
) {
  await assertCanManage(actor, input.classId);
  const cls = await db.class.findFirstOrThrow({ where: { id: input.classId }, select: { startDate: true } });
  const data = { weekday: input.weekday, startTime: toTime(input.startTime), endTime: toTime(input.endTime), location: input.location ?? null };
  if (input.scheduleId) {
    const res = await db.classSchedule.updateMany({ where: { id: input.scheduleId, classId: input.classId }, data });
    if (res.count === 0) throw notFoundError();
    // future, not-yet-held sessions of this schedule are regenerated with the new time
    await db.classSession.deleteMany({ where: { scheduleId: input.scheduleId, startsAt: { gt: new Date() }, status: "SCHEDULED", attendance: { none: {} } } });
  } else {
    await db.classSchedule.create({ data: { ...data, classId: input.classId, effectiveFrom: cls.startDate } });
  }
  await generateSessions(input.classId);
  await audit({ actorId: actor.id, action: "class.schedule_update", entityType: "class", entityId: input.classId });
}

export async function deleteSchedule(actor: CurrentUser, classId: string, scheduleId: string) {
  await assertCanManage(actor, classId);
  const schedule = await db.classSchedule.findFirst({ where: { id: scheduleId, classId }, select: { id: true } });
  if (!schedule) throw notFoundError();
  // Past sessions stay (they may have attendance); future untouched ones are removed.
  await db.classSession.deleteMany({ where: { scheduleId, startsAt: { gt: new Date() }, status: "SCHEDULED", attendance: { none: {} } } });
  await db.classSchedule.update({ where: { id: scheduleId }, data: { effectiveTo: new Date() } });
  await db.classSession.updateMany({ where: { scheduleId }, data: { scheduleId: null } });
  await db.classSchedule.delete({ where: { id: scheduleId } });
}

/**
 * Create concrete sessions for the next `days` days from the recurring schedules (idempotent).
 * Runs after schedule changes and daily from cron (Phase 4).
 */
export async function generateSessions(classId: string, days = 56, now: Date = new Date()): Promise<number> {
  const cls = await db.class.findFirst({
    where: { id: classId, deletedAt: null, status: { in: ["PLANNED", "ACTIVE"] } },
    select: { startDate: true, endDate: true, schedules: true },
  });
  if (!cls) return 0;
  const today = new TZDate(now, APP_TIMEZONE);
  const rows: Prisma.ClassSessionCreateManyInput[] = [];
  for (let i = 0; i <= days; i++) {
    const day = new TZDate(today.getFullYear(), today.getMonth(), today.getDate() + i, APP_TIMEZONE);
    const isoDate = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    if (isoDate < cls.startDate.toISOString().slice(0, 10)) continue;
    if (cls.endDate && isoDate > cls.endDate.toISOString().slice(0, 10)) break;
    const weekday = day.getDay() === 0 ? 7 : day.getDay();
    for (const s of cls.schedules) {
      if (s.weekday !== weekday) continue;
      if (isoDate < s.effectiveFrom.toISOString().slice(0, 10)) continue;
      if (s.effectiveTo && isoDate > s.effectiveTo.toISOString().slice(0, 10)) continue;
      const startsAt = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), s.startTime.getUTCHours(), s.startTime.getUTCMinutes(), APP_TIMEZONE);
      const endsAt = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), s.endTime.getUTCHours(), s.endTime.getUTCMinutes(), APP_TIMEZONE);
      if (startsAt.getTime() < now.getTime()) continue;
      rows.push({ classId, scheduleId: s.id, startsAt: new Date(startsAt.getTime()), endsAt: new Date(endsAt.getTime()) });
    }
  }
  if (rows.length === 0) return 0;
  const res = await db.classSession.createMany({ data: rows, skipDuplicates: true });
  return res.count;
}

// ───────────────────────── CSV import (admin) ─────────────────────────

export type ImportRow = { line: number; fullName: string; username: string; tempPassword?: string; error?: string };

/**
 * Create student accounts from pasted CSV and add them to the class.
 * Columns: Họ tên, Ngày sinh (dd/mm/yyyy), Số điện thoại, Tên đăng nhập (optional). Header row optional.
 */
export async function importStudentsCsv(actor: CurrentUser, classId: string, csv: string): Promise<ImportRow[]> {
  requireAdmin(actor);
  await assertCanManage(actor, classId);
  const rows = parseCsv(csv);
  if (rows.length && /h[oọ]\s*t[eê]n|name/i.test(rows[0]![0] ?? "")) rows.shift();
  if (rows.length > 200) throw new AppError("VALIDATION_ERROR", "Mỗi lần nhập tối đa 200 học viên.");

  const results: ImportRow[] = [];
  const createdStudentIds: string[] = [];
  for (const [i, cols] of rows.entries()) {
    const [fullName = "", dob = "", phone = "", usernameCol = ""] = cols;
    const line = i + 1;
    let username = (usernameCol || suggestUsername(fullName)).toLowerCase();
    // make the suggested username unique
    if (!usernameCol) {
      let n = 1;
      const base = username;
      while (await db.user.findUnique({ where: { username }, select: { id: true } })) username = `${base}${++n}`;
    }
    const dateOfBirth = dob ? parseVnDate(dob) : null;
    if (dob && !dateOfBirth) {
      results.push({ line, fullName, username, error: `Ngày sinh "${dob}" không hợp lệ.` });
      continue;
    }
    const parsed = createUserSchema.safeParse({ role: "STUDENT", fullName, username, phone: phone || undefined, dateOfBirth: dateOfBirth ?? undefined });
    if (!parsed.success) {
      results.push({ line, fullName, username, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." });
      continue;
    }
    try {
      const created = await createUser(actor, parsed.data);
      const student = await db.student.findUniqueOrThrow({ where: { userId: created.id }, select: { id: true } });
      createdStudentIds.push(student.id);
      results.push({ line, fullName, username: created.username, tempPassword: created.tempPassword ?? undefined });
    } catch (e) {
      results.push({ line, fullName, username, error: e instanceof AppError ? e.message : "Không tạo được tài khoản." });
    }
  }
  if (createdStudentIds.length) await addStudents(actor, classId, createdStudentIds);
  return results;
}
