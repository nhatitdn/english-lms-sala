import "server-only";
import type { AssignmentStatus } from "@/generated/prisma/enums";
import type { CurrentUser } from "@/server/auth/current-user";
import { canEditAssignment, canManageClass, canViewAssignmentResults, canViewStudent, visibleAssignmentWhere } from "@/server/authz/policies";
import { db } from "@/server/db";
import { assignedWork, type AssignedWorkRow } from "./assigned-work";
import { answersRevealed, startBlocker, studentAssignment } from "./attempt";
import { correctAnswerText, jsonText, storageToDraft, toStudentQuestion } from "./questions";
import { loadQuestions } from "./store";

/** Class ids the staff member teaches (all for admin = null). */
async function managedClassIds(user: CurrentUser): Promise<string[] | null> {
  if (user.role === "ADMIN") return null;
  if (user.role !== "TEACHER" || !user.teacherId) return [];
  const rows = await db.classTeacher.findMany({ where: { teacherId: user.teacherId, class: { deletedAt: null } }, select: { classId: true } });
  return rows.map((r) => r.classId);
}

// ───────────────────────── Lists ─────────────────────────

export async function listAssignmentsForStaff(user: CurrentUser, filter: { classId?: string; status?: AssignmentStatus } = {}) {
  const rows = await db.assignment.findMany({
    where: {
      AND: [
        visibleAssignmentWhere(user),
        filter.classId ? { targets: { some: { classId: filter.classId } } } : {},
        filter.status ? { status: filter.status } : { status: { not: "ARCHIVED" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      maxScore: true,
      updatedAt: true,
      createdBy: true,
      creator: { select: { fullName: true } },
      _count: { select: { questions: true } },
      targets: { select: { dueAt: true, class: { select: { id: true, code: true } } }, orderBy: { availableAt: "asc" } },
      submissions: { where: { status: "SUBMITTED" }, select: { id: true } },
    },
  });
  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    kind: a.kind,
    status: a.status,
    maxScore: Number(a.maxScore),
    updatedAt: a.updatedAt,
    author: a.creator.fullName,
    mine: a.createdBy === user.id,
    questionCount: a._count.questions,
    classes: [...new Map(a.targets.map((t) => [t.class.id, t.class.code])).values()],
    nextDue: a.targets.map((t) => t.dueAt).filter((d): d is Date => !!d && d > new Date()).sort((x, y) => +x - +y)[0] ?? null,
    toGrade: a.submissions.length,
  }));
}

export async function listAssignmentsForStudent(user: CurrentUser) {
  if (!user.studentId) return { todo: [], done: [] };
  const rows = await assignedWork({ studentIds: [user.studentId] });
  const now = new Date();
  const isTodo = (r: AssignedWorkRow) =>
    r.assignmentStatus === "PUBLISHED" && (!r.closeAt || r.closeAt > now) && (r.submissionStatus === null || r.submissionStatus === "IN_PROGRESS" || r.submissionStatus === "NEEDS_REVISION");
  return { todo: rows.filter(isTodo), done: rows.filter((r) => !isTodo(r)).sort((a, b) => +(b.submittedAt ?? 0) - +(a.submittedAt ?? 0)) };
}

// ───────────────────────── Builder ─────────────────────────

export async function getAssignmentBuilder(user: CurrentUser, assignmentId: string) {
  if (!(await canEditAssignment(user, assignmentId))) return null;
  const a = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      targets: {
        orderBy: { createdAt: "asc" },
        include: { class: { select: { code: true, name: true } }, group: { select: { name: true } }, student: { select: { user: { select: { fullName: true } } } } },
      },
      audioLesson: { select: { id: true, title: true, audioFileId: true, coverFileId: true, lessonId: true } },
      _count: { select: { submissions: true } },
    },
  });
  const questions = await loadQuestions(assignmentId);
  const classIds = await managedClassIds(user);
  const classes = await db.class.findMany({
    where: { deletedAt: null, status: { in: ["PLANNED", "ACTIVE"] }, ...(classIds ? { id: { in: classIds } } : {}) },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      groups: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      members: { where: { status: "ACTIVE" }, select: { student: { select: { id: true, user: { select: { fullName: true } } } } }, orderBy: { student: { user: { fullName: "asc" } } } },
    },
  });
  return {
    assignment: { ...a, maxScore: Number(a.maxScore) },
    locked: a._count.submissions > 0,
    questions: questions.map((q) => ({ draft: storageToDraft(q), mediaKind: q.mediaKind ?? null })),
    totalPoints: questions.reduce((s, q) => s + q.points, 0),
    targets: a.targets.map((t) => ({
      id: t.id,
      classId: t.classId,
      classCode: t.class.code,
      className: t.class.name,
      targetType: t.targetType,
      label: t.targetType === "CLASS" ? "Cả lớp" : t.targetType === "GROUP" ? `Nhóm ${t.group?.name ?? ""}` : (t.student?.user.fullName ?? "Học viên"),
      availableAt: t.availableAt,
      dueAt: t.dueAt,
      closeAt: t.closeAt,
    })),
    classes: classes.map((c) => ({ id: c.id, code: c.code, name: c.name, groups: c.groups, students: c.members.map((m) => ({ id: m.student.id, name: m.student.user.fullName })) })),
  };
}

// ───────────────────────── Results (staff) ─────────────────────────

export async function getAssignmentResults(user: CurrentUser, assignmentId: string) {
  if (!(await canViewAssignmentResults(user, assignmentId))) return null;
  const a = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    select: { id: true, title: true, kind: true, status: true, maxScore: true, answerReveal: true, answersReleasedAt: true, createdBy: true, description: true, _count: { select: { questions: true } } },
  });
  const classIds = await managedClassIds(user);
  const rows = (await assignedWork({ assignmentIds: [assignmentId] })).filter((r) => !classIds || classIds.includes(r.classId));
  const handedIn = rows.filter((r) => r.submissionStatus && r.submissionStatus !== "IN_PROGRESS" && r.submissionStatus !== "EXCUSED");
  const scores = rows.map((r) => r.finalScore).filter((s): s is number => s !== null);
  return {
    assignment: { ...a, maxScore: Number(a.maxScore) },
    canEdit: await canEditAssignment(user, assignmentId),
    rows,
    stats: {
      assigned: rows.length,
      handedIn: handedIn.length,
      toGrade: rows.filter((r) => r.submissionStatus === "SUBMITTED").length,
      average: scores.length ? Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 100) / 100 : null,
    },
  };
}

// ───────────────────────── Student intro ─────────────────────────

export async function getStudentAssignment(user: CurrentUser, assignmentId: string) {
  if (user.role !== "STUDENT" || !user.studentId) return null;
  const row = await studentAssignment(user.studentId, assignmentId);
  if (!row) return null;
  const a = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    select: {
      id: true,
      title: true,
      description: true,
      kind: true,
      status: true,
      maxScore: true,
      timeLimitMin: true,
      maxAttempts: true,
      allowLate: true,
      _count: { select: { questions: true } },
      audioLesson: { select: { title: true } },
    },
  });
  const attempts = await db.submission.findMany({
    where: { assignmentId, studentId: user.studentId },
    orderBy: { attemptNo: "desc" },
    select: { id: true, attemptNo: true, status: true, submittedAt: true, finalScore: true, isLate: true },
  });
  return {
    assignment: { ...a, maxScore: Number(a.maxScore) },
    row,
    attempts: attempts.map((s) => ({ ...s, finalScore: s.finalScore === null ? null : Number(s.finalScore) })),
    blocker: startBlocker(a, row),
    inProgress: attempts.find((s) => s.status === "IN_PROGRESS")?.id ?? null,
  };
}

// ───────────────────────── Submission detail (result / grading) ─────────────────────────

export type SubmissionViewer = "staff" | "student" | "parent";

/**
 * One attempt with its answers. Students and parents only see correctness/correct answers when the
 * assignment's reveal rule allows it, and only see scores once the attempt is graded.
 */
export async function getSubmissionDetail(user: CurrentUser, submissionId: string) {
  const sub = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      attemptNo: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      isLate: true,
      autoScore: true,
      finalScore: true,
      classId: true,
      studentId: true,
      assignmentId: true,
      class: { select: { code: true, name: true } },
      student: { select: { user: { select: { fullName: true } } } },
      assignment: { select: { id: true, title: true, kind: true, maxScore: true, answerReveal: true, answersReleasedAt: true, deletedAt: true, audioLesson: { select: { audioFileId: true, title: true } } } },
      answers: { select: { questionId: true, answer: true, isCorrect: true, autoPoints: true, manualPoints: true } },
      files: { select: { questionId: true, file: { select: { id: true, originalName: true, kind: true, mimeType: true } } } },
      feedback: { orderBy: { createdAt: "asc" }, select: { id: true, questionId: true, content: true, needsRevision: true, createdAt: true, author: { select: { fullName: true } } } },
      grades: { orderBy: { createdAt: "desc" }, select: { id: true, score: true, maxScore: true, source: true, reason: true, isCurrent: true, createdAt: true, grader: { select: { fullName: true } } } },
    },
  });
  if (!sub || sub.assignment.deletedAt) return null;

  let viewer: SubmissionViewer;
  if ((user.role === "ADMIN" || user.role === "TEACHER") && (await canManageClass(user, sub.classId))) viewer = "staff";
  else if (user.role === "STUDENT" && user.studentId === sub.studentId) viewer = "student";
  else if (user.role === "PARENT" && (await canViewStudent(user, sub.studentId))) viewer = "parent";
  else return null;
  if (viewer !== "staff" && sub.status === "IN_PROGRESS") return { viewer, inProgress: true as const, submissionId: sub.id, assignmentId: sub.assignmentId };

  const row = await studentAssignment(sub.studentId, sub.assignmentId);
  const reveal = viewer === "staff" || answersRevealed(sub.assignment, sub, row?.dueAt ?? null);
  const graded = viewer === "staff" || sub.status === "GRADED" || sub.status === "NEEDS_REVISION";
  const questions = await loadQuestions(sub.assignmentId);
  const answers = new Map(sub.answers.map((a) => [a.questionId, a]));
  const items = questions.map((q, i) => {
    const a = answers.get(q.id);
    const auto = a?.autoPoints == null ? null : Number(a.autoPoints);
    const manual = a?.manualPoints == null ? null : Number(a.manualPoints);
    return {
      index: i + 1,
      question: toStudentQuestion(q, sub.id, false),
      // option texts in original order (staff + revealed result screens)
      answer: a?.answer ?? null,
      files: sub.files.filter((f) => f.questionId === q.id).map((f) => f.file),
      autoPoints: graded ? auto : null,
      manualPoints: graded ? manual : null,
      points: graded ? (manual ?? auto) : null,
      needsManual: auto === null,
      isCorrect: reveal ? (a?.isCorrect ?? null) : null,
      correctAnswer: reveal ? correctAnswerText(q) : null,
      explanation: reveal ? jsonText(q.explanation) || null : null,
      // option id → text map so answers can be shown in words
      optionText: Object.fromEntries(q.options.map((o) => [o.id, jsonText(o.content)])),
      feedback: sub.feedback.filter((f) => f.questionId === q.id),
    };
  });
  const attempts =
    viewer === "staff"
      ? await db.submission.findMany({
          where: { assignmentId: sub.assignmentId, studentId: sub.studentId },
          orderBy: { attemptNo: "desc" },
          select: { id: true, attemptNo: true, status: true, submittedAt: true, finalScore: true },
        })
      : [];
  return {
    viewer,
    inProgress: false as const,
    submission: {
      id: sub.id,
      attemptNo: sub.attemptNo,
      status: sub.status,
      startedAt: sub.startedAt,
      submittedAt: sub.submittedAt,
      isLate: sub.isLate,
      autoScore: sub.autoScore === null ? null : Number(sub.autoScore),
      finalScore: graded && sub.finalScore !== null ? Number(sub.finalScore) : null,
      studentId: sub.studentId,
      studentName: sub.student.user.fullName,
      classId: sub.classId,
      classCode: sub.class.code,
      className: sub.class.name,
    },
    assignment: { ...sub.assignment, maxScore: Number(sub.assignment.maxScore) },
    dueAt: row?.dueAt ?? null,
    reveal,
    items,
    totalPoints: questions.reduce((s, q) => s + q.points, 0),
    overallFeedback: sub.feedback.filter((f) => !f.questionId),
    grades: viewer === "staff" ? sub.grades.map((g) => ({ ...g, score: Number(g.score), maxScore: Number(g.maxScore) })) : [],
    attempts: attempts.map((a) => ({ ...a, finalScore: a.finalScore === null ? null : Number(a.finalScore) })),
  };
}

// ───────────────────────── Grading queue ─────────────────────────

export async function gradingQueue(user: CurrentUser, classId?: string) {
  const classIds = await managedClassIds(user);
  if (classIds && classIds.length === 0) return [];
  const rows = await db.submission.findMany({
    where: {
      status: "SUBMITTED",
      assignment: { deletedAt: null },
      class: { deletedAt: null },
      ...(classId ? { classId } : {}),
      ...(classIds ? { classId: { in: classId ? classIds.filter((c) => c === classId) : classIds } } : {}),
    },
    orderBy: { submittedAt: "asc" },
    take: 300,
    select: {
      id: true,
      submittedAt: true,
      isLate: true,
      autoScore: true,
      attemptNo: true,
      assignment: { select: { id: true, title: true, kind: true, maxScore: true } },
      class: { select: { id: true, code: true } },
      student: { select: { user: { select: { fullName: true } } } },
    },
  });
  return rows.map((r) => ({ ...r, autoScore: r.autoScore === null ? null : Number(r.autoScore), assignment: { ...r.assignment, maxScore: Number(r.assignment.maxScore) } }));
}

// ───────────────────────── Gradebook ─────────────────────────

/** Students × assignments of one class. Staff of the class see everyone; a student sees only their own row. */
export async function getGradebook(user: CurrentUser, classId: string) {
  const staff = (user.role === "ADMIN" || user.role === "TEACHER") && (await canManageClass(user, classId));
  const ownStudent = user.role === "STUDENT" ? user.studentId : null;
  if (!staff && !ownStudent) return null;
  const rows = await assignedWork({ classIds: [classId], ...(staff ? {} : { studentIds: [ownStudent!] }) });
  const assignments = [...new Map(rows.map((r) => [r.assignmentId, { id: r.assignmentId, title: r.title, maxScore: r.maxScore, dueAt: r.targetDueAt }])).values()].sort(
    (a, b) => +(a.dueAt ?? 8.64e15) - +(b.dueAt ?? 8.64e15),
  );
  const students = [...new Map(rows.map((r) => [r.studentId, { id: r.studentId, name: r.studentName }])).values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const cell = new Map(rows.map((r) => [`${r.studentId}:${r.assignmentId}`, r]));
  const now = new Date();
  return {
    staff,
    assignments,
    students: students.map((s) => {
      const cells = assignments.map((a) => {
        const r = cell.get(`${s.id}:${a.id}`);
        if (!r) return null;
        const missing = !r.submissionStatus || r.submissionStatus === "IN_PROGRESS" ? !!r.dueAt && r.dueAt < now : false;
        return { status: r.submissionStatus, score: r.finalScore, submissionId: r.submissionId, missing, maxScore: r.maxScore };
      });
      const scored = cells.filter((c) => c?.score != null) as { score: number; maxScore: number }[];
      const avg10 = scored.length ? Math.round((scored.reduce((sum, c) => sum + (c.score / c.maxScore) * 10, 0) / scored.length) * 10) / 10 : null;
      return { ...s, cells, average: avg10 };
    }),
  };
}
