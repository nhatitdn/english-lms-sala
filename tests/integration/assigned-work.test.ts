import { describe, expect, it } from "vitest";
import { assignedWork, isPending } from "@/features/assignments/assigned-work";
import { db } from "@/server/db";
import { makeClass, makeUser } from "../support/factories";

const past = (h: number) => new Date(Date.now() - h * 3600_000);
const future = (h: number) => new Date(Date.now() + h * 3600_000);

describe("assignedWork()", () => {
  it("resolves CLASS, GROUP and STUDENT targets, extensions, schedule and membership", async () => {
    const teacher = await makeUser("TEACHER");
    const [a, b, c] = await Promise.all([makeUser("STUDENT"), makeUser("STUDENT"), makeUser("STUDENT")]);
    const cls = await makeClass({ teacherIds: [teacher.teacher!.id], studentIds: [a.student!.id, b.student!.id, c.student!.id] });
    const group = await db.classGroup.create({ data: { classId: cls.id, name: "Nhóm 1", members: { create: [{ studentId: a.student!.id }] } } });

    type Target = { targetType: "CLASS" | "GROUP" | "STUDENT"; availableAt: Date; dueAt?: Date; groupId?: string; studentId?: string };
    const mk = (title: string, target: Target) =>
      db.assignment.create({ data: { title, status: "PUBLISHED", createdBy: teacher.id, targets: { create: { classId: cls.id, ...target } } } });
    const whole = await mk("Whole class", { targetType: "CLASS", availableAt: past(1), dueAt: future(10) });
    await mk("Group only", { targetType: "GROUP", groupId: group.id, availableAt: past(1) });
    await mk("Just B", { targetType: "STUDENT", studentId: b.student!.id, availableAt: past(1) });
    await mk("Scheduled later", { targetType: "CLASS", availableAt: future(5) });
    await db.assignment.create({ data: { title: "Draft", status: "DRAFT", createdBy: teacher.id, targets: { create: { classId: cls.id, targetType: "CLASS", availableAt: past(1) } } } });

    await db.assignmentExtension.create({ data: { assignmentId: whole.id, studentId: c.student!.id, newDueAt: future(100), grantedBy: teacher.id } });
    await db.submission.create({ data: { assignmentId: whole.id, studentId: a.student!.id, classId: cls.id, attemptNo: 1, status: "SUBMITTED", submittedAt: new Date() } });

    const rows = await assignedWork({ classIds: [cls.id] });
    const titlesFor = (s: string) => rows.filter((r) => r.studentId === s).map((r) => r.title).sort();
    expect(titlesFor(a.student!.id)).toEqual(["Group only", "Whole class"]);
    expect(titlesFor(b.student!.id)).toEqual(["Just B", "Whole class"]);
    expect(titlesFor(c.student!.id)).toEqual(["Whole class"]);

    const cWhole = rows.find((r) => r.studentId === c.student!.id && r.title === "Whole class")!;
    expect(cWhole.dueAt!.getTime()).toBeGreaterThan(future(99).getTime()); // extension wins
    expect(isPending(rows.find((r) => r.studentId === a.student!.id && r.title === "Whole class")!)).toBe(false);

    // a transferred-out student no longer has new work in that class
    await db.classMember.updateMany({ where: { classId: cls.id, studentId: b.student!.id }, data: { status: "TRANSFERRED_OUT" } });
    expect((await assignedWork({ studentIds: [b.student!.id] })).length).toBe(0);
  });
});
