import { describe, expect, it } from "vitest";
import { createUser, linkParentStudent, resetPassword, setUserStatus, unlinkParentStudent, updateUser } from "@/features/users/service";
import { createUserSchema } from "@/features/users/schemas";
import { authenticate } from "@/server/auth/login";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { asCurrent, makeUser } from "../support/factories";

describe("admin user management", () => {
  it("admin creates a student account with a student code, temporary password and forced password change", async () => {
    const admin = asCurrent(await makeUser("ADMIN"));
    const input = createUserSchema.parse({ role: "STUDENT", username: "Bao.Pham", fullName: "Phạm Quốc Bảo", dateOfBirth: "2015-02-01", guardianConsent: "on" });
    const created = await createUser(admin, input);

    expect(created.username).toBe("bao.pham"); // normalised
    expect(created.tempPassword).toMatch(/^[a-z]+-[a-z0-9]{4}-\d{2}$/);
    const row = await db.user.findUniqueOrThrow({ where: { id: created.id }, include: { student: true } });
    expect(row.mustChangePassword).toBe(true);
    expect(row.student?.studentCode).toBe("HV0001");
    expect(row.student?.guardianConsentAt).not.toBeNull();
    expect((await authenticate("bao.pham", created.tempPassword!, null)).ok).toBe(true);

    const second = await createUser(admin, createUserSchema.parse({ role: "STUDENT", username: "an.vo", fullName: "Võ An" }));
    const s2 = await db.student.findUniqueOrThrow({ where: { userId: second.id } });
    expect(s2.studentCode).toBe("HV0002");
  });

  it("creates teacher and parent profiles", async () => {
    const admin = asCurrent(await makeUser("ADMIN"));
    const t = await createUser(admin, createUserSchema.parse({ role: "TEACHER", username: "co.lan", fullName: "Trần Lan", displayName: "Cô Lan" }));
    const p = await createUser(admin, createUserSchema.parse({ role: "PARENT", username: "ph.huong", fullName: "Hương", phone: "0905 123 456" }));
    expect((await db.teacher.findUniqueOrThrow({ where: { userId: t.id } })).displayName).toBe("Cô Lan");
    expect(await db.parent.findUnique({ where: { userId: p.id } })).not.toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: p.id } })).phone).toBe("0905123456");
  });

  it("rejects duplicate usernames (case-insensitive) with a field error", async () => {
    const admin = asCurrent(await makeUser("ADMIN"));
    await createUser(admin, createUserSchema.parse({ role: "PARENT", username: "dup", fullName: "Anh A" }));
    const err = await createUser(admin, createUserSchema.parse({ role: "PARENT", username: "DUP", fullName: "Bình B" })).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("CONFLICT");
    expect(err.fieldErrors?.username).toBeDefined();
  });

  it("non-admins cannot create, edit, reset or lock accounts", async () => {
    const teacher = asCurrent(await makeUser("TEACHER"));
    const student = await makeUser("STUDENT");
    const input = createUserSchema.parse({ role: "STUDENT", username: "x1x", fullName: "Xin Chào" });
    await expect(createUser(teacher, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(resetPassword(teacher, student.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setUserStatus(teacher, student.id, "LOCKED")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      updateUser(teacher, { id: student.id, username: "xyz", fullName: "Xin", isIndependent: false, guardianConsent: false } as never),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("password reset issues a new temp password, forces a change and ends existing sessions", async () => {
    const admin = asCurrent(await makeUser("ADMIN"));
    const kid = await makeUser("STUDENT", { username: "forgetful" });
    const before = kid.sessionVersion;
    const { tempPassword } = await resetPassword(admin, kid.id);
    const row = await db.user.findUniqueOrThrow({ where: { id: kid.id } });
    expect(row.sessionVersion).toBe(before + 1);
    expect(row.mustChangePassword).toBe(true);
    expect((await authenticate("forgetful", tempPassword, null)).ok).toBe(true);
  });

  it("locking ends sessions; an admin cannot lock themself or the last active admin", async () => {
    const adminUser = await makeUser("ADMIN");
    const admin = asCurrent(adminUser);
    const kid = await makeUser("STUDENT");
    await setUserStatus(admin, kid.id, "LOCKED");
    const row = await db.user.findUniqueOrThrow({ where: { id: kid.id } });
    expect(row.status).toBe("LOCKED");
    expect(row.sessionVersion).toBe(kid.sessionVersion + 1);

    await expect(setUserStatus(admin, admin.id, "LOCKED")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const other = asCurrent(await makeUser("ADMIN"));
    await setUserStatus(other, admin.id, "DISABLED"); // allowed: another admin remains
    await expect(setUserStatus(admin, other.id, "LOCKED")).rejects.toMatchObject({ code: "FORBIDDEN" }); // `other` is the last active admin
  });

  it("links and unlinks parents and students; one parent can have several children", async () => {
    const admin = asCurrent(await makeUser("ADMIN"));
    const parent = await makeUser("PARENT");
    const kid1 = await makeUser("STUDENT");
    const kid2 = await makeUser("STUDENT");
    await linkParentStudent(admin, { parentUserId: parent.id, studentUserId: kid1.id, relationship: "MOTHER" });
    await linkParentStudent(admin, { parentUserId: parent.id, studentUserId: kid2.id, relationship: "MOTHER" });
    expect(await db.parentStudent.count({ where: { parentId: parent.parent!.id } })).toBe(2);
    await unlinkParentStudent(admin, { parentUserId: parent.id, studentUserId: kid1.id });
    expect(await db.parentStudent.count({ where: { parentId: parent.parent!.id } })).toBe(1);
    // linking a non-parent fails
    await expect(linkParentStudent(admin, { parentUserId: kid2.id, studentUserId: kid1.id, relationship: "OTHER" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("every admin change is written to the activity log", async () => {
    const admin = asCurrent(await makeUser("ADMIN"));
    const created = await createUser(admin, createUserSchema.parse({ role: "PARENT", username: "logme", fullName: "Log Me" }));
    await resetPassword(admin, created.id);
    const actions = (await db.activityLog.findMany({ where: { entityId: created.id }, orderBy: { createdAt: "asc" } })).map((l) => l.action);
    expect(actions).toEqual(["user.create", "user.reset_password"]);
  });
});

describe("validation", () => {
  it("rejects bad usernames, emails and short passwords", () => {
    expect(createUserSchema.safeParse({ role: "STUDENT", username: "Có Dấu", fullName: "A B" }).success).toBe(false);
    expect(createUserSchema.safeParse({ role: "STUDENT", username: "ok.name", fullName: "A B", email: "not-an-email" }).success).toBe(false);
    expect(createUserSchema.safeParse({ role: "STUDENT", username: "ok.name", fullName: "A B", password: "short" }).success).toBe(false);
    expect(createUserSchema.safeParse({ role: "HACKER", username: "ok.name", fullName: "A B" }).success).toBe(false);
  });
});
