import { describe, expect, it } from "vitest";
import { canManageClass, canViewClass, canViewStudent, linkedStudentIds } from "@/server/authz/policies";
import { db } from "@/server/db";
import { asCurrent, makeClass, makeUser } from "../support/factories";

async function world() {
  const admin = await makeUser("ADMIN");
  const teacherA = await makeUser("TEACHER");
  const teacherB = await makeUser("TEACHER");
  const kid1 = await makeUser("STUDENT");
  const kid2 = await makeUser("STUDENT");
  const parent1 = await makeUser("PARENT");
  const classA = await makeClass({ teacherIds: [teacherA.teacher!.id], studentIds: [kid1.student!.id] });
  const classB = await makeClass({ teacherIds: [teacherB.teacher!.id], studentIds: [kid2.student!.id] });
  await db.parentStudent.create({ data: { parentId: parent1.parent!.id, studentId: kid1.student!.id } });
  return { admin, teacherA, teacherB, kid1, kid2, parent1, classA, classB };
}

describe("class policies", () => {
  it("admin manages every class; teachers only their assigned classes", async () => {
    const w = await world();
    expect(await canManageClass(asCurrent(w.admin), w.classB.id)).toBe(true);
    expect(await canManageClass(asCurrent(w.teacherA), w.classA.id)).toBe(true);
    expect(await canManageClass(asCurrent(w.teacherA), w.classB.id)).toBe(false); // teacher → class not assigned
  });

  it("students see only classes they are ACTIVE members of", async () => {
    const w = await world();
    expect(await canViewClass(asCurrent(w.kid1), w.classA.id)).toBe(true);
    expect(await canViewClass(asCurrent(w.kid1), w.classB.id)).toBe(false); // student → other class
    await db.classMember.updateMany({ where: { classId: w.classA.id, studentId: w.kid1.student!.id }, data: { status: "TRANSFERRED_OUT" } });
    expect(await canViewClass(asCurrent(w.kid1), w.classA.id)).toBe(false);
  });

  it("parents see only classes of their linked children", async () => {
    const w = await world();
    expect(await canViewClass(asCurrent(w.parent1), w.classA.id)).toBe(true);
    expect(await canViewClass(asCurrent(w.parent1), w.classB.id)).toBe(false);
  });

  it("students cannot manage classes", async () => {
    const w = await world();
    expect(await canManageClass(asCurrent(w.kid1), w.classA.id)).toBe(false);
  });

  it("soft-deleted classes are invisible to teachers", async () => {
    const w = await world();
    await db.class.update({ where: { id: w.classA.id }, data: { deletedAt: new Date() } });
    expect(await canManageClass(asCurrent(w.teacherA), w.classA.id)).toBe(false);
  });
});

describe("student policies", () => {
  it("a parent sees only linked children", async () => {
    const w = await world();
    expect(await canViewStudent(asCurrent(w.parent1), w.kid1.student!.id)).toBe(true);
    expect(await canViewStudent(asCurrent(w.parent1), w.kid2.student!.id)).toBe(false); // parent → another student
    expect(await linkedStudentIds(asCurrent(w.parent1))).toEqual([w.kid1.student!.id]);
  });

  it("a student sees only themself", async () => {
    const w = await world();
    expect(await canViewStudent(asCurrent(w.kid1), w.kid1.student!.id)).toBe(true);
    expect(await canViewStudent(asCurrent(w.kid1), w.kid2.student!.id)).toBe(false);
  });

  it("a teacher sees students of their classes only (history kept after transfer)", async () => {
    const w = await world();
    expect(await canViewStudent(asCurrent(w.teacherA), w.kid1.student!.id)).toBe(true);
    expect(await canViewStudent(asCurrent(w.teacherA), w.kid2.student!.id)).toBe(false);
    await db.classMember.updateMany({ where: { studentId: w.kid1.student!.id }, data: { status: "TRANSFERRED_OUT" } });
    expect(await canViewStudent(asCurrent(w.teacherA), w.kid1.student!.id)).toBe(true);
  });
});

describe("database guarantees", () => {
  it("a student cannot be ACTIVE twice in the same class", async () => {
    const w = await world();
    await expect(db.classMember.create({ data: { classId: w.classA.id, studentId: w.kid1.student!.id } })).rejects.toThrow();
    // but can re-join after leaving (history row kept)
    await db.classMember.updateMany({ where: { classId: w.classA.id }, data: { status: "LEFT" } });
    await expect(db.classMember.create({ data: { classId: w.classA.id, studentId: w.kid1.student!.id } })).resolves.toBeTruthy();
  });

  it("a gallery photo cannot be published without parental consent", async () => {
    const admin = await makeUser("ADMIN");
    const file = await db.file.create({
      data: { storageKey: "public/x.webp", visibility: "PUBLIC", kind: "IMAGE", originalName: "x.webp", mimeType: "image/webp", extension: "webp", sizeBytes: 10, sha256: "x", uploadedBy: admin.id },
    });
    await expect(db.galleryImage.create({ data: { fileId: file.id, isPublished: true, consentConfirmed: false } })).rejects.toThrow();
  });
});
