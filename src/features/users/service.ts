import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { UserStatus } from "@/generated/prisma/enums";
import type { CurrentUser } from "@/server/auth/current-user";
import { generateTempPassword, hashPassword } from "@/server/auth/password";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError, forbiddenError, notFoundError } from "@/server/errors";
import type { CreateUserInput, UpdateUserInput } from "./schemas";

function requireAdmin(actor: CurrentUser) {
  if (actor.role !== "ADMIN") throw forbiddenError();
}

/** Map unique-constraint violations to friendly field errors. */
function uniqueViolation(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = JSON.stringify(error.meta ?? {});
    if (target.includes("username")) throw new AppError("CONFLICT", "Tên đăng nhập đã được dùng.", { username: ["Tên đăng nhập đã được dùng."] });
    if (target.includes("email")) throw new AppError("CONFLICT", "Email đã được dùng.", { email: ["Email đã được dùng."] });
    if (target.includes("slug")) throw new AppError("CONFLICT", "Đường dẫn hồ sơ giáo viên đã tồn tại.");
    throw new AppError("CONFLICT", "Dữ liệu bị trùng.");
  }
  throw error;
}

/** Next student code: HV0001, HV0002, … */
async function nextStudentCode(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING(student_code FROM 3) AS INTEGER)) AS max
    FROM students WHERE student_code ~ '^HV[0-9]+$'`;
  const next = (rows[0]?.max ?? 0) + 1;
  return `HV${String(next).padStart(4, "0")}`;
}

function teacherSlug(username: string): string {
  return username.replace(/[._]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export type CreatedUser = { id: string; username: string; tempPassword: string | null };

export async function createUser(actor: CurrentUser, input: CreateUserInput): Promise<CreatedUser> {
  requireAdmin(actor);
  const tempPassword = input.password ? null : generateTempPassword();
  const passwordHash = await hashPassword(input.password ?? tempPassword!);

  try {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: input.username,
          fullName: input.fullName,
          email: input.email ?? null,
          phone: input.phone ?? null,
          role: input.role,
          passwordHash,
          mustChangePassword: true,
        },
      });

      if (input.role === "STUDENT") {
        await tx.student.create({
          data: {
            userId: created.id,
            studentCode: await nextStudentCode(tx),
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
            school: input.school ?? null,
            currentLevel: input.currentLevel ?? null,
            isIndependent: input.isIndependent,
            guardianConsentAt: input.guardianConsent ? new Date() : null,
            privateNotes: input.privateNotes ?? null,
          },
        });
      } else if (input.role === "TEACHER" || (input.role === "ADMIN" && input.alsoTeacher)) {
        await tx.teacher.create({
          data: {
            userId: created.id,
            slug: teacherSlug(input.username),
            displayName: (input.role === "TEACHER" ? input.displayName : undefined) ?? input.fullName,
            qualifications: input.role === "TEACHER" ? (input.qualifications ?? null) : null,
          },
        });
      } else if (input.role === "PARENT") {
        await tx.parent.create({ data: { userId: created.id } });
      }

      await audit({ actorId: actor.id, action: "user.create", entityType: "user", entityId: created.id, metadata: { role: input.role } }, tx);
      return created;
    });
    return { id: user.id, username: user.username, tempPassword };
  } catch (error) {
    uniqueViolation(error);
  }
}

export async function updateUser(actor: CurrentUser, input: UpdateUserInput): Promise<void> {
  requireAdmin(actor);
  const existing = await db.user.findFirst({
    where: { id: input.id, deletedAt: null },
    select: { id: true, role: true, student: { select: { id: true, guardianConsentAt: true } }, teacher: { select: { id: true } } },
  });
  if (!existing) throw notFoundError();

  try {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: { username: input.username, fullName: input.fullName, email: input.email ?? null, phone: input.phone ?? null },
      });
      if (existing.student) {
        await tx.student.update({
          where: { id: existing.student.id },
          data: {
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
            school: input.school ?? null,
            currentLevel: input.currentLevel ?? null,
            isIndependent: input.isIndependent,
            // keep the original consent timestamp; only set/clear on change
            guardianConsentAt: input.guardianConsent ? (existing.student.guardianConsentAt ?? new Date()) : null,
            privateNotes: input.privateNotes ?? null,
          },
        });
      }
      if (existing.teacher) {
        await tx.teacher.update({
          where: { id: existing.teacher.id },
          data: { displayName: input.displayName ?? input.fullName, qualifications: input.qualifications ?? null },
        });
      }
      await audit({ actorId: actor.id, action: "user.update", entityType: "user", entityId: existing.id }, tx);
    });
  } catch (error) {
    uniqueViolation(error);
  }
}

/** Generate a new temporary password; signs the user out everywhere and forces a change at next login. */
export async function resetPassword(actor: CurrentUser, userId: string): Promise<{ tempPassword: string }> {
  requireAdmin(actor);
  const user = await db.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } });
  if (!user) throw notFoundError();
  const tempPassword = generateTempPassword();
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await audit({ actorId: actor.id, action: "user.reset_password", entityType: "user", entityId: user.id });
  return { tempPassword };
}

export async function setUserStatus(actor: CurrentUser, userId: string, status: UserStatus): Promise<void> {
  requireAdmin(actor);
  if (userId === actor.id && status !== "ACTIVE") {
    throw new AppError("FORBIDDEN", "Bạn không thể tự khóa tài khoản của chính mình.");
  }
  const user = await db.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, role: true } });
  if (!user) throw notFoundError();
  if (user.role === "ADMIN" && status !== "ACTIVE") {
    const otherActiveAdmins = await db.user.count({ where: { role: "ADMIN", status: "ACTIVE", deletedAt: null, id: { not: userId } } });
    if (otherActiveAdmins === 0) throw new AppError("FORBIDDEN", "Phải còn ít nhất một quản trị viên đang hoạt động.");
  }
  await db.user.update({
    where: { id: user.id },
    data: {
      status,
      // locking / disabling ends all sessions immediately
      ...(status !== "ACTIVE" ? { sessionVersion: { increment: 1 } } : { failedLoginCount: 0, lockedUntil: null }),
    },
  });
  await audit({ actorId: actor.id, action: `user.status_${status.toLowerCase()}`, entityType: "user", entityId: user.id });
}

export async function linkParentStudent(
  actor: CurrentUser,
  input: { parentUserId: string; studentUserId: string; relationship: "FATHER" | "MOTHER" | "GUARDIAN" | "OTHER" },
): Promise<void> {
  requireAdmin(actor);
  const [parent, student] = await Promise.all([
    db.parent.findFirst({ where: { userId: input.parentUserId, user: { deletedAt: null } }, select: { id: true } }),
    db.student.findFirst({ where: { userId: input.studentUserId, user: { deletedAt: null } }, select: { id: true } }),
  ]);
  if (!parent || !student) throw notFoundError();
  await db.parentStudent.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
    create: { parentId: parent.id, studentId: student.id, relationship: input.relationship },
    update: { relationship: input.relationship },
  });
  await audit({
    actorId: actor.id,
    action: "user.link_parent",
    entityType: "student",
    entityId: student.id,
    metadata: { parentId: parent.id, relationship: input.relationship },
  });
}

export async function unlinkParentStudent(actor: CurrentUser, input: { parentUserId: string; studentUserId: string }): Promise<void> {
  requireAdmin(actor);
  const link = await db.parentStudent.findFirst({
    where: { parent: { userId: input.parentUserId }, student: { userId: input.studentUserId } },
    select: { parentId: true, studentId: true },
  });
  if (!link) throw notFoundError();
  await db.parentStudent.delete({ where: { parentId_studentId: { parentId: link.parentId, studentId: link.studentId } } });
  await audit({ actorId: actor.id, action: "user.unlink_parent", entityType: "student", entityId: link.studentId, metadata: { parentId: link.parentId } });
}
