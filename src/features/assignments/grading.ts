import "server-only";
import type { CurrentUser } from "@/server/auth/current-user";
import { canManageClass } from "@/server/authz/policies";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError, forbiddenError, notFoundError } from "@/server/errors";
import { studentAssignment } from "./attempt";
import type { GradeInput } from "./schemas";
import { loadQuestions, round2, scaleScore } from "./store";

function requireStaff(actor: CurrentUser) {
  if (actor.role !== "ADMIN" && actor.role !== "TEACHER") throw forbiddenError();
}

/**
 * Teacher grading: per-question points (blank = keep the automatic score), comments, optional total
 * override with a reason, "needs revision" (lets the student resubmit). Grades are append-only history:
 * the previous grade stays with is_current = false.
 */
export async function gradeSubmission(actor: CurrentUser, input: GradeInput) {
  requireStaff(actor);
  const sub = await db.submission.findUnique({
    where: { id: input.submissionId },
    select: {
      id: true,
      status: true,
      classId: true,
      studentId: true,
      assignmentId: true,
      assignment: { select: { maxScore: true, title: true } },
      student: { select: { userId: true } },
      answers: { select: { questionId: true, autoPoints: true, manualPoints: true } },
    },
  });
  if (!sub || !(await canManageClass(actor, sub.classId))) throw notFoundError();
  if (sub.status === "IN_PROGRESS") throw new AppError("CONFLICT", "Học viên chưa nộp bài này.");
  if (sub.status === "EXCUSED") throw new AppError("CONFLICT", "Học viên được miễn bài này.");

  const questions = await loadQuestions(sub.assignmentId);
  const byQ = new Map(input.questions.map((q) => [q.questionId, q]));
  const answers = new Map(sub.answers.map((a) => [a.questionId, a]));
  for (const q of input.questions) {
    const question = questions.find((x) => x.id === q.questionId);
    if (!question) throw new AppError("VALIDATION_ERROR", "Câu hỏi không thuộc bài tập này.");
    if (q.points !== null && q.points > question.points) {
      throw new AppError("VALIDATION_ERROR", `Điểm câu hỏi không vượt quá ${question.points}.`, { [`points.${q.questionId}`]: [`Tối đa ${question.points}`] });
    }
  }

  // effective points per question: teacher's points, else what the auto-grader gave, else 0 (ungraded)
  let earned = 0;
  let total = 0;
  const manual: { questionId: string; points: number | null }[] = [];
  for (const q of questions) {
    total += q.points;
    const given = byQ.get(q.id);
    const prev = answers.get(q.id);
    const manualPoints = given ? given.points : prev?.manualPoints != null ? Number(prev.manualPoints) : null;
    manual.push({ questionId: q.id, points: manualPoints });
    earned += manualPoints ?? (prev?.autoPoints != null ? Number(prev.autoPoints) : 0);
  }
  const maxScore = Number(sub.assignment.maxScore);
  let score = scaleScore(earned, total, maxScore);
  if (input.scoreOverride !== null) {
    if (input.scoreOverride > maxScore) throw new AppError("VALIDATION_ERROR", `Điểm tối đa là ${maxScore}.`, { scoreOverride: [`Tối đa ${maxScore}`] });
    if (!input.reason) throw new AppError("VALIDATION_ERROR", "Nhập lý do khi sửa tổng điểm.", { reason: ["Nhập lý do khi sửa tổng điểm."] });
    score = round2(input.scoreOverride);
  }
  const status = input.needsRevision ? "NEEDS_REVISION" : "GRADED";

  const grade = await db.$transaction(async (tx) => {
    for (const m of manual) {
      await tx.submissionAnswer.upsert({
        where: { submissionId_questionId: { submissionId: sub.id, questionId: m.questionId } },
        create: { submissionId: sub.id, questionId: m.questionId, manualPoints: m.points },
        update: { manualPoints: m.points },
      });
    }
    await tx.grade.updateMany({ where: { submissionId: sub.id, isCurrent: true }, data: { isCurrent: false } });
    const g = await tx.grade.create({
      data: { submissionId: sub.id, score, maxScore, source: "MANUAL", gradedBy: actor.id, reason: input.reason ?? null, isCurrent: true },
      select: { id: true },
    });
    await tx.submission.update({ where: { id: sub.id }, data: { status, finalScore: score } });
    const comments = [
      ...(input.comment ? [{ questionId: null as string | null, content: input.comment }] : []),
      ...input.questions.filter((q) => q.comment).map((q) => ({ questionId: q.questionId as string | null, content: q.comment! })),
    ];
    if (comments.length) {
      await tx.feedback.createMany({
        data: comments.map((c, i) => ({
          studentId: sub.studentId,
          classId: sub.classId,
          submissionId: sub.id,
          questionId: c.questionId,
          authorId: actor.id,
          content: c.content,
          needsRevision: i === 0 && input.needsRevision,
        })),
      });
    }
    await tx.notification.createMany({
      data: [
        {
          userId: sub.student.userId,
          type: "ASSIGNMENT_GRADED",
          title: input.needsRevision ? `${sub.assignment.title}: cần làm lại` : `${sub.assignment.title}: ${score}/${maxScore} điểm`,
          link: `/app/submissions/${sub.id}`,
          dedupeKey: `grade:${g.id}`,
        },
      ],
      skipDuplicates: true,
    });
    await audit(
      { actorId: actor.id, action: "submission.grade", entityType: "submission", entityId: sub.id, metadata: { score, status, override: input.scoreOverride !== null } },
      tx,
    );
    return g;
  });
  return { gradeId: grade.id, score, status };
}

/** "Miễn nộp": records an EXCUSED attempt so the student no longer counts as missing. */
export async function excuseStudent(actor: CurrentUser, input: { assignmentId: string; studentId: string; classId: string }) {
  requireStaff(actor);
  if (!(await canManageClass(actor, input.classId))) throw notFoundError();
  const row = await studentAssignment(input.studentId, input.assignmentId);
  if (!row || row.classId !== input.classId) throw notFoundError();
  const latest = await db.submission.findFirst({ where: { assignmentId: input.assignmentId, studentId: input.studentId }, orderBy: { attemptNo: "desc" } });
  if (latest && latest.status !== "NEEDS_REVISION") {
    if (latest.status === "EXCUSED") return;
    throw new AppError("CONFLICT", "Học viên đã làm bài này.");
  }
  await db.submission.create({
    data: { assignmentId: input.assignmentId, studentId: input.studentId, classId: input.classId, attemptNo: (latest?.attemptNo ?? 0) + 1, status: "EXCUSED", submittedAt: new Date() },
  });
  await audit({ actorId: actor.id, action: "submission.excuse", entityType: "assignment", entityId: input.assignmentId, metadata: { studentId: input.studentId } });
}
