import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { AnswerReveal, SubmissionStatus } from "@/generated/prisma/enums";
import type { CurrentUser } from "@/server/auth/current-user";
import { assignedToStudentWhere } from "@/server/authz/policies";
import { db } from "@/server/db";
import { AppError, forbiddenError, notFoundError } from "@/server/errors";
import { assignedWork, type AssignedWorkRow } from "./assigned-work";
import { gradeAnswer, parseAnswer, seededShuffle, toStudentQuestion, type StoredQuestion, type StudentQuestion } from "./questions";
import { loadQuestions, round2, scaleScore } from "./store";

const asJson = (v: unknown) => (v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));
/** Network grace after the deadline for the last autosave / submit to arrive. */
export const DEADLINE_GRACE_MS = 60_000;

function requireStudent(actor: CurrentUser): string {
  if (actor.role !== "STUDENT" || !actor.studentId) throw forbiddenError();
  return actor.studentId;
}

/** The student's effective view of an assignment (target dates + extension + latest attempt), or null. */
export async function studentAssignment(studentId: string, assignmentId: string): Promise<AssignedWorkRow | null> {
  return (await assignedWork({ assignmentIds: [assignmentId], studentIds: [studentId] }))[0] ?? null;
}

export type StartBlock = { reason: string } | null;

/** Why a new attempt cannot start right now (null = it can). Shared by the intro page and startAttempt. */
export function startBlocker(
  a: { status: string; allowLate: boolean; maxAttempts: number | null },
  row: Pick<AssignedWorkRow, "dueAt" | "closeAt" | "submissionStatus" | "attempts">,
  now: Date = new Date(),
): StartBlock {
  if (row.submissionStatus === "IN_PROGRESS") return null; // resume
  if (row.submissionStatus === "EXCUSED") return { reason: "Bạn được miễn làm bài này." };
  if (a.status !== "PUBLISHED") return { reason: "Bài tập đã khóa." };
  if (row.closeAt && now >= row.closeAt) return { reason: "Bài tập đã hết thời gian nhận bài." };
  const revision = row.submissionStatus === "NEEDS_REVISION";
  if (!revision && row.dueAt && now > row.dueAt && !a.allowLate) return { reason: "Đã quá hạn nộp bài." };
  if (!revision && a.maxAttempts !== null && row.attempts >= a.maxAttempts) {
    return { reason: a.maxAttempts === 1 ? "Bạn đã nộp bài này." : `Bạn đã dùng hết ${a.maxAttempts} lần làm bài.` };
  }
  return null;
}

export async function startAttempt(actor: CurrentUser, assignmentId: string): Promise<{ submissionId: string }> {
  const studentId = requireStudent(actor);
  const a = await db.assignment.findFirst({
    where: { AND: [{ id: assignmentId }, assignedToStudentWhere(studentId)] },
    select: { id: true, status: true, allowLate: true, maxAttempts: true, timeLimitMin: true },
  });
  const row = a ? await studentAssignment(studentId, assignmentId) : null;
  if (!a || !row) throw notFoundError();

  const latest = await db.submission.findFirst({
    where: { assignmentId, studentId },
    orderBy: { attemptNo: "desc" },
    select: { id: true, attemptNo: true, status: true, deadlineAt: true },
  });
  if (latest?.status === "IN_PROGRESS") {
    if (!(await finalizeIfExpired(latest.id))) return { submissionId: latest.id };
    return startAttempt(actor, assignmentId); // the expired one was just submitted — re-evaluate
  }
  const now = new Date();
  const block = startBlocker(a, row, now);
  if (block) throw new AppError("CONFLICT", block.reason);

  const limits = [
    a.timeLimitMin ? now.getTime() + a.timeLimitMin * 60_000 : null,
    !a.allowLate && row.dueAt ? row.dueAt.getTime() : null,
    row.closeAt ? row.closeAt.getTime() : null,
  ].filter((x): x is number => x !== null);
  const deadlineAt = limits.length ? new Date(Math.min(...limits)) : null;

  try {
    return await db.$transaction(async (tx) => {
      const sub = await tx.submission.create({
        data: { assignmentId, studentId, classId: row.classId, attemptNo: (latest?.attemptNo ?? 0) + 1, deadlineAt, startedAt: now },
        select: { id: true },
      });
      // resubmission after "needs revision": start from the previous answers
      if (latest?.status === "NEEDS_REVISION") {
        const prev = await tx.submissionAnswer.findMany({ where: { submissionId: latest.id }, select: { questionId: true, answer: true } });
        if (prev.length) await tx.submissionAnswer.createMany({ data: prev.map((p) => ({ submissionId: sub.id, questionId: p.questionId, answer: asJson(p.answer) })) });
        const files = await tx.submissionFile.findMany({ where: { submissionId: latest.id }, select: { questionId: true, fileId: true } });
        if (files.length) await tx.submissionFile.createMany({ data: files.map((f) => ({ submissionId: sub.id, questionId: f.questionId, fileId: f.fileId })) });
      }
      return { submissionId: sub.id };
    });
  } catch (e) {
    // two taps / two tabs at once: the unique (assignment, student, attempt_no) lets only one through
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const current = await db.submission.findFirst({ where: { assignmentId, studentId, status: "IN_PROGRESS" }, select: { id: true } });
      if (current) return { submissionId: current.id };
    }
    throw e;
  }
}

async function ownSubmission(actor: CurrentUser, submissionId: string) {
  const studentId = requireStudent(actor);
  const sub = await db.submission.findFirst({
    where: { id: submissionId, studentId },
    select: { id: true, assignmentId: true, studentId: true, status: true, version: true, deadlineAt: true, startedAt: true },
  });
  if (!sub) throw notFoundError();
  return sub;
}

// ───────────────────────── Attempt screen ─────────────────────────

export type AttemptView = {
  submissionId: string;
  assignment: { id: string; title: string; description: string | null; kind: string; maxScore: number; timeLimitMin: number | null };
  attemptNo: number;
  version: number;
  deadlineAt: string | null;
  serverNow: string;
  questions: StudentQuestion[];
  answers: Record<string, unknown>;
  files: Record<string, { id: string; name: string; kind: string }[]>;
  listening: { title: string; audioFileId: string; coverFileId: string | null } | null;
};

/** Everything the student needs to work — and nothing that reveals answers. */
export async function getAttempt(actor: CurrentUser, submissionId: string): Promise<AttemptView | { finished: true }> {
  const sub = await ownSubmission(actor, submissionId);
  if (sub.status !== "IN_PROGRESS" || (await finalizeIfExpired(sub.id))) return { finished: true };
  const full = await db.submission.findUniqueOrThrow({
    where: { id: submissionId },
    select: {
      attemptNo: true,
      version: true,
      deadlineAt: true,
      answers: { select: { questionId: true, answer: true } },
      files: { select: { questionId: true, file: { select: { id: true, originalName: true, kind: true, deletedAt: true } } } },
      assignment: {
        select: {
          id: true,
          title: true,
          description: true,
          kind: true,
          maxScore: true,
          timeLimitMin: true,
          shuffleQuestions: true,
          shuffleOptions: true,
          audioLesson: { select: { title: true, audioFileId: true, coverFileId: true } },
        },
      },
    },
  });
  const a = full.assignment;
  const stored = await loadQuestions(a.id);
  const ordered = a.shuffleQuestions ? seededShuffle(stored, submissionId) : stored;
  const files: AttemptView["files"] = {};
  for (const f of full.files) {
    if (!f.questionId || f.file.deletedAt) continue;
    (files[f.questionId] ??= []).push({ id: f.file.id, name: f.file.originalName, kind: f.file.kind });
  }
  return {
    submissionId,
    assignment: { id: a.id, title: a.title, description: a.description, kind: a.kind, maxScore: Number(a.maxScore), timeLimitMin: a.timeLimitMin },
    attemptNo: full.attemptNo,
    version: full.version,
    deadlineAt: full.deadlineAt?.toISOString() ?? null,
    serverNow: new Date().toISOString(),
    questions: ordered.map((q) => toStudentQuestion(q, submissionId, a.shuffleOptions)),
    answers: Object.fromEntries(full.answers.map((x) => [x.questionId, x.answer])),
    files,
    listening: a.audioLesson,
  };
}

// ───────────────────────── Autosave ─────────────────────────

export type SaveResult =
  | { ok: true; version: number; savedAt: string }
  | { ok: false; status: 409; reason: "version"; version: number }
  | { ok: false; status: 409; reason: "closed" };

/**
 * Save changed answers. Optimistic concurrency: the client sends the version it last saw; a second tab
 * or device with an older copy gets 409 instead of silently overwriting newer answers.
 */
export async function saveAnswers(actor: CurrentUser, input: { submissionId: string; version: number; answers: Record<string, unknown> }): Promise<SaveResult> {
  const sub = await ownSubmission(actor, input.submissionId);
  if (sub.status !== "IN_PROGRESS") return { ok: false, status: 409, reason: "closed" };
  if (sub.deadlineAt && Date.now() > sub.deadlineAt.getTime() + DEADLINE_GRACE_MS) {
    await finalizeIfExpired(sub.id);
    return { ok: false, status: 409, reason: "closed" };
  }
  if (sub.version !== input.version) return { ok: false, status: 409, reason: "version", version: sub.version };

  const questions = await db.question.findMany({ where: { assignmentId: sub.assignmentId }, select: { id: true, type: true, config: true } });
  const byId = new Map(questions.map((q) => [q.id, q]));
  const clean: { questionId: string; answer: unknown; fileIds: string[] | null }[] = [];
  for (const [questionId, raw] of Object.entries(input.answers)) {
    const q = byId.get(questionId);
    if (!q) continue; // unknown/forged question id — ignore
    const answer = raw === null ? null : parseAnswer(q.type, raw);
    let fileIds: string[] | null = null;
    if (q.type === "SPEAKING" || q.type === "FILE_UPLOAD") {
      const ids = answer ? (q.type === "SPEAKING" ? [(answer as { fileId: string }).fileId] : (answer as { fileIds: string[] }).fileIds) : [];
      const max = q.type === "SPEAKING" ? 1 : Number((q.config as { maxFiles?: number }).maxFiles ?? 3);
      if (ids.length > max) throw new AppError("VALIDATION_ERROR", `Tối đa ${max} file cho câu này.`);
      // only files this student uploaded, of the right kind
      const kinds = q.type === "SPEAKING" ? ["RECORDING", "AUDIO"] : ["IMAGE", "DOCUMENT"];
      const owned = ids.length
        ? await db.file.count({ where: { id: { in: ids }, uploadedBy: actor.id, deletedAt: null, kind: { in: kinds as ("RECORDING" | "AUDIO" | "IMAGE" | "DOCUMENT")[] } } })
        : 0;
      if (owned !== new Set(ids).size) throw new AppError("VALIDATION_ERROR", "File đính kèm không hợp lệ.");
      fileIds = ids;
    }
    clean.push({ questionId, answer, fileIds });
  }

  const savedAt = new Date();
  return db.$transaction(async (tx) => {
    const bumped = await tx.submission.updateMany({
      where: { id: sub.id, status: "IN_PROGRESS", version: input.version },
      data: { version: { increment: 1 }, lastSavedAt: savedAt },
    });
    if (bumped.count === 0) {
      const now = await tx.submission.findUniqueOrThrow({ where: { id: sub.id }, select: { version: true, status: true } });
      return now.status === "IN_PROGRESS" ? { ok: false as const, status: 409 as const, reason: "version" as const, version: now.version } : { ok: false as const, status: 409 as const, reason: "closed" as const };
    }
    for (const c of clean) {
      await tx.submissionAnswer.upsert({
        where: { submissionId_questionId: { submissionId: sub.id, questionId: c.questionId } },
        create: { submissionId: sub.id, questionId: c.questionId, answer: asJson(c.answer) },
        update: { answer: asJson(c.answer) },
      });
      if (c.fileIds) {
        await tx.submissionFile.deleteMany({ where: { submissionId: sub.id, questionId: c.questionId } });
        if (c.fileIds.length) await tx.submissionFile.createMany({ data: c.fileIds.map((fileId) => ({ submissionId: sub.id, questionId: c.questionId, fileId })) });
      }
    }
    return { ok: true as const, version: input.version + 1, savedAt: savedAt.toISOString() };
  });
}

// ───────────────────────── Submit & auto-grade ─────────────────────────

export async function submitAttempt(
  actor: CurrentUser,
  input: { submissionId: string; version?: number; answers?: Record<string, unknown> },
): Promise<{ submissionId: string; status: SubmissionStatus }> {
  const sub = await ownSubmission(actor, input.submissionId);
  if (sub.status === "IN_PROGRESS" && input.answers && Object.keys(input.answers).length && input.version !== undefined) {
    const saved = await saveAnswers(actor, { submissionId: sub.id, version: input.version, answers: input.answers });
    if (!saved.ok && saved.reason === "version") throw new AppError("CONFLICT", "Bài làm đã được cập nhật ở tab/thiết bị khác. Hãy tải lại trang trước khi nộp.");
  }
  const status = await finalizeSubmission(sub.id, new Date());
  return { submissionId: sub.id, status };
}

/** Submit an attempt whose time is up (called lazily whenever the attempt is touched). Returns true if it was finalized. */
export async function finalizeIfExpired(submissionId: string, now: Date = new Date()): Promise<boolean> {
  const sub = await db.submission.findUnique({ where: { id: submissionId }, select: { status: true, deadlineAt: true } });
  if (!sub || sub.status !== "IN_PROGRESS" || !sub.deadlineAt) return false;
  if (now.getTime() <= sub.deadlineAt.getTime() + DEADLINE_GRACE_MS) return false;
  await finalizeSubmission(submissionId, sub.deadlineAt);
  return true;
}

/**
 * IN_PROGRESS → SUBMITTED (idempotent: a second concurrent call finds nothing to update), then grade every
 * auto-gradable question. Fully auto-gradable attempts become GRADED immediately with an AUTO grade.
 */
export async function finalizeSubmission(submissionId: string, at: Date): Promise<SubmissionStatus> {
  const meta = await db.submission.findUniqueOrThrow({
    where: { id: submissionId },
    select: { assignmentId: true, studentId: true, deadlineAt: true, assignment: { select: { maxScore: true, title: true } }, student: { select: { userId: true } } },
  });
  const row = await studentAssignment(meta.studentId, meta.assignmentId);
  const questions = await loadQuestions(meta.assignmentId);
  const submittedAt = meta.deadlineAt && at > meta.deadlineAt ? (at.getTime() - meta.deadlineAt.getTime() <= DEADLINE_GRACE_MS ? at : meta.deadlineAt) : at;
  const isLate = !!row?.dueAt && submittedAt > row.dueAt;

  return db.$transaction(async (tx) => {
    const claimed = await tx.submission.updateMany({ where: { id: submissionId, status: "IN_PROGRESS" }, data: { status: "SUBMITTED", submittedAt, isLate } });
    if (claimed.count === 0) {
      return (await tx.submission.findUniqueOrThrow({ where: { id: submissionId }, select: { status: true } })).status;
    }
    const saved = await tx.submissionAnswer.findMany({ where: { submissionId }, select: { questionId: true, answer: true } });
    const byQ = new Map(saved.map((s) => [s.questionId, s.answer]));
    const result = gradeAll(questions, byQ);
    for (const r of result.perQuestion) {
      await tx.submissionAnswer.upsert({
        where: { submissionId_questionId: { submissionId, questionId: r.questionId } },
        create: { submissionId, questionId: r.questionId, answer: Prisma.DbNull, isCorrect: r.isCorrect, autoPoints: r.autoPoints },
        update: { isCorrect: r.isCorrect, autoPoints: r.autoPoints },
      });
    }
    const maxScore = Number(meta.assignment.maxScore);
    const autoScore = scaleScore(result.autoEarned, result.totalPoints, maxScore);
    if (result.allAuto) {
      await tx.submission.update({ where: { id: submissionId }, data: { status: "GRADED", autoScore, finalScore: autoScore } });
      await tx.grade.create({ data: { submissionId, score: autoScore, maxScore, source: "AUTO", isCurrent: true } });
      await tx.notification.createMany({
        data: [{ userId: meta.student.userId, type: "ASSIGNMENT_GRADED", title: `${meta.assignment.title}: ${autoScore}/${maxScore} điểm`, link: `/app/submissions/${submissionId}`, dedupeKey: `auto:${submissionId}` }],
        skipDuplicates: true,
      });
      return "GRADED";
    }
    await tx.submission.update({ where: { id: submissionId }, data: { autoScore } });
    return "SUBMITTED";
  });
}

export function gradeAll(questions: StoredQuestion[], answers: Map<string, unknown>) {
  let totalPoints = 0;
  let autoEarned = 0;
  let allAuto = true;
  const perQuestion = questions.map((q) => {
    totalPoints += q.points;
    const g = gradeAnswer(q, answers.get(q.id) ?? null);
    if (g.auto) autoEarned += g.points;
    else allAuto = false;
    return { questionId: q.id, autoPoints: g.auto ? g.points : null, isCorrect: g.auto ? g.isCorrect : null };
  });
  return { perQuestion, totalPoints: round2(totalPoints), autoEarned: round2(autoEarned), allAuto };
}

// ───────────────────────── Answer reveal ─────────────────────────

/** May the student see correct answers for this attempt yet? */
export function answersRevealed(
  a: { answerReveal: AnswerReveal; answersReleasedAt: Date | null },
  submission: { status: SubmissionStatus },
  effectiveDueAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (submission.status === "IN_PROGRESS") return false;
  switch (a.answerReveal) {
    case "NEVER":
      return false;
    case "AFTER_SUBMIT":
      return true;
    case "AFTER_DUE":
      return !effectiveDueAt || now > effectiveDueAt;
    case "MANUAL":
      return a.answersReleasedAt !== null && a.answersReleasedAt <= now;
  }
}
