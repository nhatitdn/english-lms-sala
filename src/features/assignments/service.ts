import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AnswerReveal, AssignmentKind } from "@/generated/prisma/enums";
import type { CurrentUser } from "@/server/auth/current-user";
import { canEditAssignment, canEditLesson, canManageClass, canViewAssignmentResults } from "@/server/authz/policies";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError, forbiddenError, notFoundError } from "@/server/errors";
import { assignedWork } from "./assigned-work";
import { draftToStorage, type QuestionDraft } from "./questions";
import type { TargetInput } from "./schemas";

const asJson = (v: unknown) => v as Prisma.InputJsonValue;

function requireStaff(actor: CurrentUser) {
  if (actor.role !== "ADMIN" && actor.role !== "TEACHER") throw forbiddenError();
}

async function assertEditable(actor: CurrentUser, assignmentId: string) {
  if (!(await canEditAssignment(actor, assignmentId))) throw notFoundError();
}

/** Questions are frozen once a student has started: option ids are referenced by saved answers. */
async function assertQuestionsEditable(actor: CurrentUser, assignmentId: string) {
  await assertEditable(actor, assignmentId);
  const started = await db.submission.count({ where: { assignmentId } });
  if (started > 0) {
    throw new AppError("CONFLICT", "Đã có học viên làm bài nên không thể sửa câu hỏi. Hãy nhân bản bài tập để chỉnh sửa.");
  }
}

// ───────────────────────── Assignment ─────────────────────────

export async function createAssignment(actor: CurrentUser, input: { title: string; kind: AssignmentKind; classId?: string }) {
  requireStaff(actor);
  if (input.classId && !(await canManageClass(actor, input.classId))) throw notFoundError();
  const a = await db.assignment.create({
    data: {
      title: input.title,
      kind: input.kind,
      createdBy: actor.id,
      // writing / speaking / upload tasks are usually done once and graded by hand; answers never "revealed"
      answerReveal: input.kind === "QUIZ" || input.kind === "LISTENING" || input.kind === "MIXED" ? "AFTER_DUE" : "NEVER",
    },
    select: { id: true },
  });
  await audit({ actorId: actor.id, action: "assignment.create", entityType: "assignment", entityId: a.id });
  return a;
}

export async function updateAssignmentSettings(
  actor: CurrentUser,
  input: {
    id: string;
    title: string;
    description?: string;
    kind: AssignmentKind;
    maxScore: number;
    timeLimitMin: number | null;
    maxAttempts: number | null;
    allowLate: boolean;
    answerReveal: AnswerReveal;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
  },
) {
  await assertEditable(actor, input.id);
  const { id, ...data } = input;
  await db.assignment.update({ where: { id }, data: { ...data, description: data.description ?? null } });
  await audit({ actorId: actor.id, action: "assignment.update", entityType: "assignment", entityId: id });
}

export async function setAssignmentStatus(actor: CurrentUser, assignmentId: string, action: "publish" | "unpublish" | "close" | "reopen") {
  await assertEditable(actor, assignmentId);
  const a = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    select: { status: true, title: true, _count: { select: { questions: true, targets: true, submissions: true } } },
  });
  if (action === "publish" || action === "reopen") {
    if (a._count.questions === 0) throw new AppError("VALIDATION_ERROR", "Bài tập chưa có câu hỏi nào.");
    if (a._count.targets === 0) throw new AppError("VALIDATION_ERROR", "Hãy giao bài cho ít nhất 1 lớp, nhóm hoặc học viên trước khi đăng.");
  }
  if (action === "unpublish" && a._count.submissions > 0) {
    throw new AppError("CONFLICT", "Đã có học viên làm bài — hãy dùng “Khóa bài” thay vì chuyển về nháp.");
  }
  const status = action === "publish" || action === "reopen" ? "PUBLISHED" : action === "close" ? "CLOSED" : "DRAFT";
  await db.assignment.update({ where: { id: assignmentId }, data: { status } });
  await audit({ actorId: actor.id, action: `assignment.${action}`, entityType: "assignment", entityId: assignmentId });
  if (status === "PUBLISHED") await notifyNewAssignment(assignmentId);
}

/** In-app "new assignment" notification for students who can see it now (deduplicated per student). */
export async function notifyNewAssignment(assignmentId: string) {
  const rows = await assignedWork({ assignmentIds: [assignmentId] });
  if (!rows.length) return;
  const students = await db.student.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.studentId))] } }, select: { id: true, userId: true } });
  const title = rows[0]!.title;
  await db.notification.createMany({
    data: students.map((s) => ({
      userId: s.userId,
      type: "ASSIGNMENT_NEW" as const,
      title: `Bài tập mới: ${title}`,
      link: `/app/assignments/${assignmentId}`,
      dedupeKey: assignmentId,
    })),
    skipDuplicates: true,
  });
}

export async function deleteAssignment(actor: CurrentUser, assignmentId: string) {
  await assertEditable(actor, assignmentId);
  // soft delete: submissions and grades stay in the database
  await db.assignment.update({ where: { id: assignmentId }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
  await db.audioLesson.updateMany({ where: { assignmentId }, data: { assignmentId: null } });
  await audit({ actorId: actor.id, action: "assignment.delete", entityType: "assignment", entityId: assignmentId });
}

/** Copy settings + questions into a new draft owned by the actor (no targets, no submissions). */
export async function duplicateAssignment(actor: CurrentUser, assignmentId: string) {
  requireStaff(actor);
  if (!(await canViewAssignmentResults(actor, assignmentId))) throw notFoundError();
  const src = await db.assignment.findUniqueOrThrow({ where: { id: assignmentId }, include: { questions: { include: { options: true } } } });
  const copy = await db.$transaction(async (tx) => {
    const a = await tx.assignment.create({
      data: {
        title: `${src.title} (bản sao)`.slice(0, 200),
        description: src.description,
        instructions: src.instructions ?? undefined,
        kind: src.kind,
        maxScore: src.maxScore,
        timeLimitMin: src.timeLimitMin,
        maxAttempts: src.maxAttempts,
        allowLate: src.allowLate,
        answerReveal: src.answerReveal,
        shuffleQuestions: src.shuffleQuestions,
        shuffleOptions: src.shuffleOptions,
        createdBy: actor.id,
      },
      select: { id: true },
    });
    for (const q of src.questions) {
      await tx.question.create({
        data: {
          assignmentId: a.id,
          type: q.type,
          prompt: asJson(q.prompt),
          mediaFileId: q.mediaFileId,
          points: q.points,
          config: asJson(q.config),
          explanation: q.explanation ?? undefined,
          sortOrder: q.sortOrder,
          options: {
            create: q.options.map((o) => ({
              content: asJson(o.content),
              isCorrect: o.isCorrect,
              matchSide: o.matchSide,
              matchKey: o.matchKey,
              correctPosition: o.correctPosition,
              sortOrder: o.sortOrder,
            })),
          },
        },
      });
    }
    return a;
  });
  await audit({ actorId: actor.id, action: "assignment.duplicate", entityType: "assignment", entityId: copy.id, metadata: { from: assignmentId } });
  return copy;
}

/** Answers for MANUAL reveal mode. */
export async function releaseAnswers(actor: CurrentUser, assignmentId: string) {
  await assertEditable(actor, assignmentId);
  await db.assignment.update({ where: { id: assignmentId }, data: { answersReleasedAt: new Date() } });
  await audit({ actorId: actor.id, action: "assignment.release_answers", entityType: "assignment", entityId: assignmentId });
}

// ───────────────────────── Questions ─────────────────────────

export async function saveQuestion(actor: CurrentUser, assignmentId: string, draft: QuestionDraft) {
  await assertQuestionsEditable(actor, assignmentId);
  if (draft.mediaFileId) {
    const media = await db.file.findFirst({
      where: {
        id: draft.mediaFileId,
        deletedAt: null,
        kind: { in: ["IMAGE", "AUDIO"] },
        OR: [...(actor.role === "ADMIN" ? [{}] : []), { uploadedBy: actor.id }, { questionMedia: { some: { assignmentId } } }],
      },
      select: { id: true },
    });
    if (!media) throw new AppError("VALIDATION_ERROR", "File đính kèm câu hỏi không hợp lệ.");
  }
  const { config, options } = draftToStorage(draft);
  const data = {
    type: draft.type,
    prompt: asJson({ text: draft.prompt }),
    points: draft.points,
    mediaFileId: draft.mediaFileId ?? null,
    config: asJson(config),
    explanation: draft.explanation ? asJson({ text: draft.explanation }) : undefined,
  };
  return db.$transaction(async (tx) => {
    if (draft.id) {
      const res = await tx.question.updateMany({ where: { id: draft.id, assignmentId }, data: { ...data, explanation: data.explanation ?? { text: "" } } });
      if (res.count === 0) throw notFoundError();
      await tx.questionOption.deleteMany({ where: { questionId: draft.id } });
      if (options.length) await tx.questionOption.createMany({ data: options.map((o) => ({ ...o, content: asJson(o.content), questionId: draft.id! })) });
      return { id: draft.id };
    }
    const max = await tx.question.aggregate({ where: { assignmentId }, _max: { sortOrder: true } });
    const q = await tx.question.create({
      data: { ...data, assignmentId, sortOrder: (max._max.sortOrder ?? 0) + 1, options: { create: options.map((o) => ({ ...o, content: asJson(o.content) })) } },
      select: { id: true },
    });
    return q;
  });
}

export async function deleteQuestion(actor: CurrentUser, assignmentId: string, questionId: string) {
  await assertQuestionsEditable(actor, assignmentId);
  const res = await db.question.deleteMany({ where: { id: questionId, assignmentId } });
  if (res.count === 0) throw notFoundError();
}

export async function moveQuestion(actor: CurrentUser, assignmentId: string, questionId: string, direction: "up" | "down") {
  await assertEditable(actor, assignmentId); // re-ordering is harmless even after students started
  const list = await db.question.findMany({ where: { assignmentId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = list.findIndex((q) => q.id === questionId);
  if (i < 0) throw notFoundError();
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j]!, list[i]!];
  await db.$transaction(async (tx) => {
    for (const [idx, q] of list.entries()) await tx.question.update({ where: { id: q.id }, data: { sortOrder: idx + 1 } });
  });
}

// ───────────────────────── Targets (who gets it, when) ─────────────────────────

export async function addTarget(actor: CurrentUser, input: TargetInput) {
  await assertEditable(actor, input.assignmentId);
  if (!(await canManageClass(actor, input.classId))) throw notFoundError();
  const availableAt = input.availableAt ? new Date(input.availableAt) : new Date();
  const dates = { availableAt, dueAt: input.dueAt ? new Date(input.dueAt) : null, closeAt: input.closeAt ? new Date(input.closeAt) : null };
  const base = { assignmentId: input.assignmentId, classId: input.classId };

  if (input.targetType === "GROUP") {
    const group = await db.classGroup.findFirst({ where: { id: input.groupId, classId: input.classId }, select: { id: true } });
    if (!group) throw new AppError("VALIDATION_ERROR", "Nhóm không thuộc lớp này.", { groupId: ["Nhóm không thuộc lớp này."] });
    await db.assignmentTarget.create({ data: { ...base, ...dates, targetType: "GROUP", groupId: group.id } });
  } else if (input.targetType === "STUDENT") {
    const members = await db.classMember.findMany({
      where: { classId: input.classId, status: "ACTIVE", studentId: { in: input.studentIds } },
      select: { studentId: true },
    });
    if (members.length !== new Set(input.studentIds).size) throw new AppError("VALIDATION_ERROR", "Có học viên không thuộc lớp này.");
    await db.assignmentTarget.createMany({ data: members.map((m) => ({ ...base, ...dates, targetType: "STUDENT" as const, studentId: m.studentId })) });
  } else {
    await db.assignmentTarget.create({ data: { ...base, ...dates, targetType: "CLASS" } });
  }
  await audit({ actorId: actor.id, action: "assignment.assign", entityType: "assignment", entityId: input.assignmentId, metadata: { classId: input.classId, type: input.targetType } });
  const a = await db.assignment.findUniqueOrThrow({ where: { id: input.assignmentId }, select: { status: true } });
  if (a.status === "PUBLISHED") await notifyNewAssignment(input.assignmentId);
}

export async function removeTarget(actor: CurrentUser, assignmentId: string, targetId: string) {
  await assertEditable(actor, assignmentId);
  const t = await db.assignmentTarget.findFirst({ where: { id: targetId, assignmentId }, select: { classId: true } });
  if (!t) throw notFoundError();
  if (!(await canManageClass(actor, t.classId))) throw notFoundError();
  await db.assignmentTarget.delete({ where: { id: targetId } });
  await audit({ actorId: actor.id, action: "assignment.unassign", entityType: "assignment", entityId: assignmentId, metadata: { targetId } });
}

/** Per-student new due date. Allowed for teachers of the class the student received the assignment through. */
export async function grantExtension(actor: CurrentUser, input: { assignmentId: string; studentId: string; newDueAt: string; reason?: string }) {
  requireStaff(actor);
  const row = (await assignedWork({ assignmentIds: [input.assignmentId], studentIds: [input.studentId] }))[0];
  if (!row || !(await canManageClass(actor, row.classId))) throw notFoundError();
  const newDueAt = new Date(input.newDueAt);
  if (newDueAt <= new Date()) throw new AppError("VALIDATION_ERROR", "Hạn mới phải ở tương lai.", { newDueAt: ["Hạn mới phải ở tương lai."] });
  await db.assignmentExtension.upsert({
    where: { assignmentId_studentId: { assignmentId: input.assignmentId, studentId: input.studentId } },
    create: { assignmentId: input.assignmentId, studentId: input.studentId, newDueAt, reason: input.reason, grantedBy: actor.id },
    update: { newDueAt, reason: input.reason ?? null, grantedBy: actor.id },
  });
  await audit({ actorId: actor.id, action: "assignment.extend", entityType: "assignment", entityId: input.assignmentId, metadata: { studentId: input.studentId } });
}

// ───────────────────────── Listening Quiz ─────────────────────────

/**
 * A Listening Quiz is an ordinary assignment (kind LISTENING) linked to a listening item, so the
 * question engine, grading and gradebook are shared (ANALYSIS §7). The audio plays above the questions.
 */
export async function createListeningQuiz(actor: CurrentUser, lessonId: string, audioLessonId: string) {
  if (!(await canEditLesson(actor, lessonId))) throw notFoundError();
  const item = await db.audioLesson.findFirst({ where: { id: audioLessonId, lessonId }, select: { title: true, assignmentId: true, assignment: { select: { deletedAt: true } } } });
  if (!item) throw notFoundError();
  if (item.assignmentId && !item.assignment?.deletedAt) return { id: item.assignmentId };
  return db.$transaction(async (tx) => {
    const a = await tx.assignment.create({
      data: { title: `Listening: ${item.title}`.slice(0, 200), kind: "LISTENING", createdBy: actor.id, answerReveal: "AFTER_SUBMIT", maxAttempts: 2 },
      select: { id: true },
    });
    await tx.audioLesson.update({ where: { id: audioLessonId }, data: { assignmentId: a.id } });
    await audit({ actorId: actor.id, action: "assignment.create", entityType: "assignment", entityId: a.id, metadata: { audioLessonId } }, tx);
    return a;
  });
}
