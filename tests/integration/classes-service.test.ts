import { describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";
import {
  addStudents,
  createClass,
  generateSessions,
  importStudentsCsv,
  removeStudent,
  setGroupMembers,
  createGroup,
  transferStudent,
  upsertSchedule,
} from "@/features/classes/service";
import { classSchema } from "@/features/classes/schemas";
import { db } from "@/server/db";
import { asCurrent, makeClass, makeUser } from "../support/factories";

const baseClass = { code: "STA-01", name: "Starter A", level: "STARTER", startDate: "2026-09-01" };

describe("class management", () => {
  it("only admins create classes; codes are unique and upper-cased", async () => {
    const admin = asCurrent(await makeUser("ADMIN"));
    const teacher = asCurrent(await makeUser("TEACHER"));
    const created = await createClass(admin, classSchema.parse({ ...baseClass, code: "sta-01" }));
    expect((await db.class.findUniqueOrThrow({ where: { id: created.id } })).code).toBe("STA-01");
    await expect(createClass(teacher, classSchema.parse({ ...baseClass, code: "X-1" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createClass(admin, classSchema.parse(baseClass))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("a teacher manages members only in assigned classes", async () => {
    const t1 = await makeUser("TEACHER");
    const kid = await makeUser("STUDENT");
    const mine = await makeClass({ teacherIds: [t1.teacher!.id] });
    const other = await makeClass();
    expect(await addStudents(asCurrent(t1), mine.id, [kid.student!.id])).toEqual({ added: 1, skipped: 0 });
    await expect(addStudents(asCurrent(t1), other.id, [kid.student!.id])).rejects.toMatchObject({ code: "NOT_FOUND" });
    // adding twice is a no-op
    expect(await addStudents(asCurrent(t1), mine.id, [kid.student!.id])).toEqual({ added: 0, skipped: 1 });
  });

  it("transferring keeps the learning history in the old class", async () => {
    const admin = asCurrent(await makeUser("ADMIN"));
    const teacher = await makeUser("TEACHER");
    const kid = await makeUser("STUDENT");
    const from = await makeClass({ studentIds: [kid.student!.id], teacherIds: [teacher.teacher!.id] });
    const to = await makeClass();
    const assignment = await db.assignment.create({ data: { title: "Quiz", status: "PUBLISHED", createdBy: teacher.id } });
    const sub = await db.submission.create({
      data: { assignmentId: assignment.id, studentId: kid.student!.id, classId: from.id, attemptNo: 1, status: "GRADED", finalScore: 8 },
    });

    await transferStudent(admin, from.id, to.id, kid.student!.id, "lên trình độ");

    const rows = await db.classMember.findMany({ where: { studentId: kid.student!.id }, orderBy: { joinedAt: "asc" } });
    expect(rows.map((r) => [r.classId, r.status])).toEqual([
      [from.id, "TRANSFERRED_OUT"],
      [to.id, "ACTIVE"],
    ]);
    expect(rows[0]!.transferredToClassId).toBe(to.id);
    // the graded submission still belongs to the old class
    expect((await db.submission.findUniqueOrThrow({ where: { id: sub.id } })).classId).toBe(from.id);
    // the teacher of the old class can no longer transfer into a class they don't manage
    await expect(transferStudent(asCurrent(teacher), to.id, from.id, kid.student!.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("removing a student keeps the membership row as history", async () => {
    const admin = asCurrent(await makeUser("ADMIN"));
    const kid = await makeUser("STUDENT");
    const cls = await makeClass({ studentIds: [kid.student!.id] });
    await removeStudent(admin, cls.id, kid.student!.id, "nghỉ học");
    const row = await db.classMember.findFirstOrThrow({ where: { classId: cls.id } });
    expect(row.status).toBe("LEFT");
    expect(row.leftAt).not.toBeNull();
  });

  it("groups only contain active members of the class", async () => {
    const admin = asCurrent(await makeUser("ADMIN"));
    const [a, outsider] = [await makeUser("STUDENT"), await makeUser("STUDENT")];
    const cls = await makeClass({ studentIds: [a.student!.id] });
    const g = await createGroup(admin, cls.id, "Nhóm 1");
    await setGroupMembers(admin, cls.id, g.id, [a.student!.id, outsider.student!.id]);
    const members = await db.classGroupMember.findMany({ where: { groupId: g.id } });
    expect(members.map((m) => m.studentId)).toEqual([a.student!.id]);
  });

  it("generates sessions from the weekly schedule in Vietnam time, idempotently", async () => {
    const admin = asCurrent(await makeUser("ADMIN"));
    const cls = await makeClass();
    await upsertSchedule(admin, { classId: cls.id, weekday: 2, startTime: "17:30", endTime: "19:00" }); // Tuesdays
    const sessions = await db.classSession.findMany({ where: { classId: cls.id }, orderBy: { startsAt: "asc" } });
    expect(sessions.length).toBeGreaterThanOrEqual(8);
    for (const s of sessions) {
      const local = new TZDate(s.startsAt, "Asia/Ho_Chi_Minh");
      expect(local.getDay()).toBe(2);
      expect([local.getHours(), local.getMinutes()]).toEqual([17, 30]);
      expect(s.endsAt.getTime() - s.startsAt.getTime()).toBe(90 * 60_000);
    }
    expect(await generateSessions(cls.id)).toBe(0); // nothing new the second time
  });

  it("imports students from pasted CSV, auto-creating usernames and reporting bad rows", async () => {
    const admin = asCurrent(await makeUser("ADMIN"));
    const cls = await makeClass();
    const rows = await importStudentsCsv(admin, cls.id, "Họ tên;Ngày sinh;SĐT\nNguyễn Minh Anh;12/03/2016;0905123456\nNguyễn Minh Anh;01/01/2015;\nTrần Bé;31/02/2016;");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ username: "minhanh.nguyen" });
    expect(rows[0]!.tempPassword).toBeTruthy();
    expect(rows[1]).toMatchObject({ username: "minhanh.nguyen2" }); // made unique
    expect(rows[2]!.error).toMatch(/Ngày sinh/);
    expect(await db.classMember.count({ where: { classId: cls.id, status: "ACTIVE" } })).toBe(2);
  });
});
