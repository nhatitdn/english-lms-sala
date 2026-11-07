import type { Role } from "@/generated/prisma/enums";
import type { CurrentUser } from "@/server/auth/current-user";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";

let seq = 0;
const next = () => ++seq;
let cachedHash: string | undefined;
export const TEST_PASSWORD = "correct-horse-1";

async function pw() {
  cachedHash ??= await hashPassword(TEST_PASSWORD);
  return cachedHash;
}

export async function makeUser(role: Role, overrides: Partial<{ username: string; fullName: string; mustChangePassword: boolean }> = {}) {
  const n = next();
  const user = await db.user.create({
    data: {
      username: overrides.username ?? `${role.toLowerCase()}${n}`,
      fullName: overrides.fullName ?? `${role} ${n}`,
      role,
      passwordHash: await pw(),
      mustChangePassword: overrides.mustChangePassword ?? false,
      ...(role === "STUDENT" ? { student: { create: { studentCode: `HV${String(n).padStart(4, "0")}` } } } : {}),
      ...(role === "TEACHER" ? { teacher: { create: { slug: `t-${n}`, displayName: `T${n}` } } } : {}),
      ...(role === "PARENT" ? { parent: { create: {} } } : {}),
    },
    include: { student: true, teacher: true, parent: true },
  });
  return user;
}

export function asCurrent(u: Awaited<ReturnType<typeof makeUser>>): CurrentUser {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
    studentId: u.student?.id ?? null,
    teacherId: u.teacher?.id ?? null,
    parentId: u.parent?.id ?? null,
  };
}

export async function makeClass(opts: { teacherIds?: string[]; studentIds?: string[]; code?: string } = {}) {
  const n = next();
  return db.class.create({
    data: {
      code: opts.code ?? `CLS-${n}`,
      name: `Class ${n}`,
      level: "STARTER",
      startDate: new Date("2026-09-01"),
      status: "ACTIVE",
      teachers: { create: (opts.teacherIds ?? []).map((teacherId) => ({ teacherId })) },
      members: { create: (opts.studentIds ?? []).map((studentId) => ({ studentId })) },
    },
  });
}
