import "server-only";
import type { CurrentUser } from "@/server/auth/current-user";
import { linkedStudentIds } from "@/server/authz/policies";
import { db } from "@/server/db";
import { forbiddenError } from "@/server/errors";
import { localDayRange } from "@/lib/datetime";
import { assignedWork, isPending } from "../assignments/assigned-work";

const DAY = 24 * 60 * 60 * 1000;

// ───────────────────────── Admin ─────────────────────────

export async function getAdminDashboard(user: CurrentUser) {
  if (user.role !== "ADMIN") throw forbiddenError();
  const [classes, teachers, students, publishedAssignments, waitingGrade, work, recentUsers] = await Promise.all([
    db.class.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    db.user.count({ where: { deletedAt: null, role: "TEACHER", status: "ACTIVE" } }),
    db.user.count({ where: { deletedAt: null, role: "STUDENT", status: "ACTIVE" } }),
    db.assignment.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
    db.submission.count({ where: { status: "SUBMITTED" } }),
    assignedWork({}),
    db.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, fullName: true, role: true, createdAt: true },
    }),
  ]);
  const notSubmitted = work.filter((w) => isPending(w)).length;
  return { classes, teachers, students, publishedAssignments, waitingGrade, notSubmitted, recentUsers };
}

// ───────────────────────── Teacher ─────────────────────────

export async function getTeacherDashboard(user: CurrentUser) {
  if (user.role !== "TEACHER" && user.role !== "ADMIN") throw forbiddenError();
  if (!user.teacherId) return null;

  const classes = await db.class.findMany({
    where: { deletedAt: null, status: { in: ["ACTIVE", "PLANNED"] }, teachers: { some: { teacherId: user.teacherId } } },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      level: true,
      location: true,
      _count: { select: { members: { where: { status: "ACTIVE" } } } },
    },
  });
  const classIds = classes.map((c) => c.id);
  const { start, end } = localDayRange();
  const now = new Date();

  const [todaySessions, toGrade, work, graded, studentRows] = await Promise.all([
    db.classSession.findMany({
      where: { classId: { in: classIds }, startsAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true, endsAt: true, status: true, class: { select: { id: true, code: true, name: true, location: true } } },
    }),
    db.submission.groupBy({
      by: ["assignmentId"],
      where: { classId: { in: classIds }, status: "SUBMITTED" },
      _count: { _all: true },
    }),
    assignedWork({ classIds }),
    db.submission.findMany({
      where: { classId: { in: classIds }, status: "GRADED", finalScore: { not: null } },
      select: { classId: true, finalScore: true, assignment: { select: { maxScore: true } } },
    }),
    db.classMember.findMany({
      where: { classId: { in: classIds }, status: "ACTIVE" },
      distinct: ["studentId"],
      select: { studentId: true },
    }),
  ]);

  const assignmentTitles = toGrade.length
    ? await db.assignment.findMany({ where: { id: { in: toGrade.map((g) => g.assignmentId) } }, select: { id: true, title: true } })
    : [];
  const gradeQueue = toGrade
    .map((g) => ({ assignmentId: g.assignmentId, title: assignmentTitles.find((a) => a.id === g.assignmentId)?.title ?? "", count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const missing = work
    .filter((w) => isPending(w) && w.dueAt && w.dueAt.getTime() < now.getTime() + 2 * DAY)
    .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())
    .slice(0, 8);

  const scoreByClass = classes.map((c) => {
    const rows = graded.filter((g) => g.classId === c.id);
    const avg = rows.length
      ? rows.reduce((sum, r) => sum + (Number(r.finalScore) / Number(r.assignment.maxScore)) * 10, 0) / rows.length
      : null;
    return { code: c.code, average: avg === null ? null : Math.round(avg * 10) / 10, count: rows.length };
  });

  return {
    classes,
    todaySessions,
    studentCount: studentRows.length,
    gradeQueue,
    toGradeTotal: gradeQueue.reduce((s, g) => s + g.count, 0),
    missing,
    missingTotal: work.filter((w) => isPending(w) && w.dueAt && w.dueAt.getTime() < now.getTime()).length,
    scoreByClass,
  };
}

// ───────────────────────── Student ─────────────────────────

export async function getStudentDashboard(user: CurrentUser) {
  if (user.role !== "STUDENT" || !user.studentId) throw forbiddenError();
  const studentId = user.studentId;
  const now = new Date();

  const memberships = await db.classMember.findMany({
    where: { studentId, status: "ACTIVE", class: { deletedAt: null } },
    select: { class: { select: { id: true, code: true, name: true, level: true, location: true } } },
  });
  const classIds = memberships.map((m) => m.class.id);

  const [work, recentGrades, upcoming, latestFeedback] = await Promise.all([
    assignedWork({ studentIds: [studentId] }),
    db.submission.findMany({
      where: { studentId, status: "GRADED", finalScore: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        finalScore: true,
        updatedAt: true,
        assignment: { select: { title: true, maxScore: true } },
        _count: { select: { feedback: true } },
      },
    }),
    db.classSession.findMany({
      where: { classId: { in: classIds }, startsAt: { gte: now, lt: new Date(now.getTime() + 7 * DAY) }, status: { not: "CANCELLED" } },
      orderBy: { startsAt: "asc" },
      take: 5,
      select: { id: true, startsAt: true, endsAt: true, class: { select: { code: true, name: true, location: true } } },
    }),
    db.feedback.findFirst({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      select: { content: true, createdAt: true, author: { select: { fullName: true } } },
    }),
  ]);

  const pending = work.filter((w) => isPending(w));
  const todo = pending.sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));
  const newWork = pending.filter((w) => now.getTime() - w.availableAt.getTime() < 3 * DAY);
  const dueSoon = pending.filter((w) => w.dueAt && w.dueAt.getTime() > now.getTime() && w.dueAt.getTime() - now.getTime() < 2 * DAY);
  const completed = work.filter((w) => !isPending(w)).length;

  return {
    classes: memberships.map((m) => m.class),
    todo,
    newCount: newWork.length,
    dueSoonCount: dueSoon.length,
    completed,
    total: work.length,
    recentGrades,
    upcoming,
    latestFeedback,
  };
}

// ───────────────────────── Parent ─────────────────────────

export async function getParentDashboard(user: CurrentUser) {
  if (user.role !== "PARENT") throw forbiddenError();
  const studentIds = await linkedStudentIds(user);
  if (studentIds.length === 0) return { children: [] };

  const [students, work, attendance, grades, feedback] = await Promise.all([
    db.student.findMany({
      where: { id: { in: studentIds }, user: { deletedAt: null } },
      select: {
        id: true,
        studentCode: true,
        user: { select: { fullName: true } },
        memberships: { where: { status: "ACTIVE" }, select: { class: { select: { code: true, name: true } } } },
      },
    }),
    assignedWork({ studentIds }),
    db.attendance.groupBy({ by: ["studentId", "status"], where: { studentId: { in: studentIds } }, _count: { _all: true } }),
    db.submission.findMany({
      where: { studentId: { in: studentIds }, status: "GRADED", finalScore: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { studentId: true, finalScore: true, updatedAt: true, assignment: { select: { title: true, maxScore: true } } },
    }),
    db.feedback.findMany({
      where: { studentId: { in: studentIds }, visibleToParent: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, studentId: true, content: true, createdAt: true, author: { select: { fullName: true } } },
    }),
  ]);

  const children = students.map((s) => {
    const att = attendance.filter((a) => a.studentId === s.id);
    const totalMarked = att.reduce((n, a) => n + a._count._all, 0);
    const attended = att.filter((a) => a.status === "PRESENT" || a.status === "LATE").reduce((n, a) => n + a._count._all, 0);
    const myGrades = grades.filter((g) => g.studentId === s.id);
    const avg = myGrades.length
      ? myGrades.reduce((sum, g) => sum + (Number(g.finalScore) / Number(g.assignment.maxScore)) * 10, 0) / myGrades.length
      : null;
    const myWork = work.filter((w) => w.studentId === s.id);
    return {
      id: s.id,
      name: s.user.fullName,
      studentCode: s.studentCode,
      classes: s.memberships.map((m) => m.class),
      attendanceRate: totalMarked ? attended / totalMarked : null,
      absences: att.filter((a) => a.status === "ABSENT").reduce((n, a) => n + a._count._all, 0),
      averageScore: avg === null ? null : Math.round(avg * 10) / 10,
      pending: myWork.filter((w) => isPending(w)),
      recentGrades: myGrades.slice(0, 3),
      feedback: feedback.filter((f) => f.studentId === s.id).slice(0, 2),
    };
  });
  return { children };
}

export async function unreadNotificationCount(user: CurrentUser): Promise<number> {
  return db.notification.count({ where: { userId: user.id, readAt: null } });
}
