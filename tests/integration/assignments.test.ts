import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAttempt, saveAnswers, startAttempt, submitAttempt, finalizeIfExpired } from "@/features/assignments/attempt";
import { gradeSubmission } from "@/features/assignments/grading";
import { getGradebook, getStudentAssignment, getSubmissionDetail, gradingQueue, listAssignmentsForStudent } from "@/features/assignments/queries";
import type { QuestionDraft } from "@/features/assignments/questions";
import * as svc from "@/features/assignments/service";
import type { CurrentUser } from "@/server/auth/current-user";
import { getLessonDetail } from "@/features/lessons/queries";
import { canAccessFile } from "@/server/authz/policies";
import { db } from "@/server/db";
import { asCurrent, makeClass, makeUser } from "../support/factories";

const state = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock("@/server/auth/current-user", () => ({ getCurrentUser: async () => state.user, requireUser: async () => state.user }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const H = 3600_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

async function world() {
  const t = await makeUser("TEACHER");
  const other = await makeUser("TEACHER");
  const s1 = await makeUser("STUDENT");
  const s2 = await makeUser("STUDENT");
  const outsider = await makeUser("STUDENT");
  const cls = await makeClass({ teacherIds: [t.teacher!.id], studentIds: [s1.student!.id, s2.student!.id] });
  return { t: asCurrent(t), other: asCurrent(other), s1: asCurrent(s1), s2: asCurrent(s2), outsider: asCurrent(outsider), cls };
}

/** A 3-question quiz (MC 1pt, fill-blank 2pt, writing 2pt) on a 10-point scale. */
async function quiz(teacher: CurrentUser, classId: string, opts: { writing?: boolean; due?: number; allowLate?: boolean; maxAttempts?: number | null; timeLimitMin?: number | null } = {}) {
  const { id } = await svc.createAssignment(teacher, { title: "Unit 3 Quiz", kind: "QUIZ" });
  await svc.updateAssignmentSettings(teacher, {
    id,
    title: "Unit 3 Quiz",
    kind: "QUIZ",
    maxScore: 10,
    timeLimitMin: opts.timeLimitMin ?? null,
    maxAttempts: opts.maxAttempts === undefined ? 1 : opts.maxAttempts,
    allowLate: opts.allowLate ?? true,
    answerReveal: "AFTER_SUBMIT",
    shuffleQuestions: false,
    shuffleOptions: true,
  });
  await svc.saveQuestion(teacher, id, { type: "MULTIPLE_CHOICE", prompt: "Pick 4", points: 1, options: [{ text: "3", correct: false }, { text: "4", correct: true }] } as QuestionDraft);
  await svc.saveQuestion(teacher, id, { type: "FILL_BLANK", prompt: "Fill", points: 2, text: "She [[goes]] to [[school]].", caseSensitive: false } as QuestionDraft);
  if (opts.writing) await svc.saveQuestion(teacher, id, { type: "WRITING", prompt: "Write about your family", points: 2 } as QuestionDraft);
  await svc.addTarget(teacher, { assignmentId: id, classId, targetType: "CLASS", studentIds: [], availableAt: iso(-H), dueAt: iso((opts.due ?? 24) * H) });
  await svc.setAssignmentStatus(teacher, id, "publish");
  const questions = await db.question.findMany({ where: { assignmentId: id }, orderBy: { sortOrder: "asc" }, include: { options: true } });
  return { id, questions };
}

const right = (q: { options: { id: string; isCorrect: boolean }[] }) => q.options.find((o) => o.isCorrect)!.id;

describe("Phase 3 — assignment lifecycle", () => {
  beforeEach(() => {
    state.user = null;
  });

  it("teacher assigns, student does it, auto-grades, sees the score (acceptance #6 #7 #9)", async () => {
    const w = await world();
    const { id, questions } = await quiz(w.t, w.cls.id);
    // notification for each student
    expect(await db.notification.count({ where: { type: "ASSIGNMENT_NEW" } })).toBe(2);

    const list = await listAssignmentsForStudent(w.s1);
    expect(list.todo.map((r) => r.assignmentId)).toEqual([id]);

    const { submissionId } = await startAttempt(w.s1, id);
    const view = await getAttempt(w.s1, submissionId);
    if ("finished" in view) throw new Error("unexpected");
    const [mc, fb] = view.questions;
    const saved = await saveAnswers(w.s1, { submissionId, version: view.version, answers: { [mc!.id]: { optionId: right(questions[0]!) }, [fb!.id]: { blanks: { "0": "goes", "1": "home" } } } });
    expect(saved).toMatchObject({ ok: true, version: 1 });

    // reload: answers come back
    const again = await getAttempt(w.s1, submissionId);
    if ("finished" in again) throw new Error("unexpected");
    expect(again.answers[mc!.id]).toEqual({ optionId: right(questions[0]!) });

    const r = await submitAttempt(w.s1, { submissionId });
    expect(r.status).toBe("GRADED");
    const sub = await db.submission.findUniqueOrThrow({ where: { id: submissionId }, include: { grades: true } });
    // 1 + 1 (half of the blanks) = 2 of 3 points → 6.67/10
    expect(Number(sub.finalScore)).toBe(6.67);
    expect(sub.grades).toHaveLength(1);
    expect(sub.grades[0]!.source).toBe("AUTO");

    const detail = await getSubmissionDetail(w.s1, submissionId);
    expect(detail && !detail.inProgress && detail.submission.finalScore).toBe(6.67);
    expect(detail && !detail.inProgress && detail.reveal).toBe(true);
    expect(await db.notification.count({ where: { type: "ASSIGNMENT_GRADED" } })).toBe(1);
  });

  it("the attempt payload never contains correct answers", async () => {
    const w = await world();
    const { id, questions } = await quiz(w.t, w.cls.id);
    const { submissionId } = await startAttempt(w.s1, id);
    const json = JSON.stringify(await getAttempt(w.s1, submissionId));
    expect(json).not.toMatch(/isCorrect|is_correct|correctPosition|matchKey|accepted|\[\[goes\]\]/);
    expect(json).not.toContain('"goes"');
    expect(json).toContain(right(questions[0]!)); // option ids are present, just not which is right
  });

  it("students cannot grade, cannot open other students' work, outsiders see nothing", async () => {
    const w = await world();
    const { id } = await quiz(w.t, w.cls.id, { writing: true });
    const { submissionId } = await startAttempt(w.s1, id);
    await submitAttempt(w.s1, { submissionId });

    await expect(gradeSubmission(w.s1, { submissionId, questions: [], needsRevision: false, scoreOverride: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(gradeSubmission(w.other, { submissionId, questions: [], needsRevision: false, scoreOverride: null })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await getSubmissionDetail(w.s2, submissionId)).toBeNull();
    await expect(getAttempt(w.s2, submissionId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(startAttempt(w.outsider, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(saveAnswers(w.s2, { submissionId, version: 0, answers: {} })).rejects.toMatchObject({ code: "NOT_FOUND" });

    // the action itself also refuses students (role check in the wrapper)
    state.user = w.s1;
    const { gradeSubmissionAction } = await import("@/features/assignments/actions");
    expect(await gradeSubmissionAction({ submissionId, questions: [], needsRevision: false, scoreOverride: 10 })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("manual grading: per-question points, comments, history, needs revision → resubmit", async () => {
    const w = await world();
    const { id, questions } = await quiz(w.t, w.cls.id, { writing: true });
    const { submissionId } = await startAttempt(w.s1, id);
    const view = await getAttempt(w.s1, submissionId);
    if ("finished" in view) throw new Error();
    await saveAnswers(w.s1, {
      submissionId,
      version: 0,
      answers: { [questions[0]!.id]: { optionId: right(questions[0]!) }, [questions[1]!.id]: { blanks: { "0": "goes", "1": "school" } }, [questions[2]!.id]: { text: "My family has four people." } },
    });
    expect((await submitAttempt(w.s1, { submissionId })).status).toBe("SUBMITTED");
    expect((await gradingQueue(w.t)).map((r) => r.id)).toEqual([submissionId]);
    expect(await gradingQueue(w.other)).toEqual([]);
    // student does not see a score while waiting
    const waiting = await getSubmissionDetail(w.s1, submissionId);
    expect(waiting && !waiting.inProgress && waiting.submission.finalScore).toBeNull();

    // writing too short → needs revision
    const g1 = await gradeSubmission(w.t, { submissionId, questions: [{ questionId: questions[2]!.id, points: 1, comment: "Viết thêm 2 câu nhé" }], comment: "Gần đúng rồi!", needsRevision: true, scoreOverride: null });
    expect(g1).toMatchObject({ status: "NEEDS_REVISION", score: 8 }); // (1+2+1)/5*10
    expect(await db.feedback.count({ where: { submissionId } })).toBe(2);

    // resubmission allowed despite maxAttempts=1, starting from the previous answers
    const second = await startAttempt(w.s1, id);
    expect(second.submissionId).not.toBe(submissionId);
    const v2 = await getAttempt(w.s1, second.submissionId);
    if ("finished" in v2) throw new Error();
    expect(v2.answers[questions[2]!.id]).toEqual({ text: "My family has four people." });
    await saveAnswers(w.s1, { submissionId: second.submissionId, version: v2.version, answers: { [questions[2]!.id]: { text: "My family has four people. I love them." } } });
    await submitAttempt(w.s1, { submissionId: second.submissionId });
    const g2 = await gradeSubmission(w.t, { submissionId: second.submissionId, questions: [{ questionId: questions[2]!.id, points: 2 }], needsRevision: false, scoreOverride: null });
    expect(g2).toMatchObject({ status: "GRADED", score: 10 });

    // re-grade with an override keeps history
    await expect(gradeSubmission(w.t, { submissionId: second.submissionId, questions: [], needsRevision: false, scoreOverride: 9.5 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await gradeSubmission(w.t, { submissionId: second.submissionId, questions: [], needsRevision: false, scoreOverride: 9.5, reason: "Trừ điểm trình bày" });
    const grades = await db.grade.findMany({ where: { submissionId: second.submissionId }, orderBy: { createdAt: "asc" } });
    expect(grades.map((g) => [Number(g.score), g.isCurrent])).toEqual([
      [10, false],
      [9.5, true],
    ]);
    // no more attempts after a final grade
    await expect(startAttempt(w.s1, id)).rejects.toMatchObject({ code: "CONFLICT" });

    const book = await getGradebook(w.t, w.cls.id);
    expect(book!.students.find((s) => s.id === w.s1.studentId)!.cells[0]).toMatchObject({ status: "GRADED", score: 9.5 });
    expect(book!.students.find((s) => s.id === w.s2.studentId)!.cells[0]).toMatchObject({ status: null, missing: false });
    const own = await getGradebook(w.s2, w.cls.id);
    expect(own!.students.map((s) => s.id)).toEqual([w.s2.studentId]);
  });

  it("late submission is marked late; closed-for-late assignments refuse new attempts", async () => {
    const w = await world();
    const late = await quiz(w.t, w.cls.id);
    // move the due date into the past
    await db.assignmentTarget.updateMany({ where: { assignmentId: late.id }, data: { dueAt: new Date(Date.now() - H) } });
    const { submissionId } = await startAttempt(w.s1, late.id);
    await submitAttempt(w.s1, { submissionId });
    expect((await db.submission.findUniqueOrThrow({ where: { id: submissionId } })).isLate).toBe(true);

    const strict = await quiz(w.t, w.cls.id, { allowLate: false });
    await db.assignmentTarget.updateMany({ where: { assignmentId: strict.id }, data: { dueAt: new Date(Date.now() - H) } });
    await expect(startAttempt(w.s1, strict.id)).rejects.toMatchObject({ code: "CONFLICT", message: "Đã quá hạn nộp bài." });
    // an extension re-opens it for one student only
    await svc.grantExtension(w.t, { assignmentId: strict.id, studentId: w.s1.studentId!, newDueAt: iso(H) });
    expect((await startAttempt(w.s1, strict.id)).submissionId).toBeTruthy();
    await expect(startAttempt(w.s2, strict.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("attempt limit is enforced", async () => {
    const w = await world();
    const { id } = await quiz(w.t, w.cls.id, { maxAttempts: 2 });
    for (let i = 0; i < 2; i++) {
      const { submissionId } = await startAttempt(w.s1, id);
      await submitAttempt(w.s1, { submissionId });
    }
    await expect(startAttempt(w.s1, id)).rejects.toMatchObject({ code: "CONFLICT", message: "Bạn đã dùng hết 2 lần làm bài." });
    const intro = await getStudentAssignment(w.s1, id);
    expect(intro!.blocker?.reason).toContain("hết 2 lần");
  });

  it("double start and double submit at the same time create one attempt and one grade", async () => {
    const w = await world();
    const { id } = await quiz(w.t, w.cls.id, { maxAttempts: null });
    const starts = await Promise.all([startAttempt(w.s1, id), startAttempt(w.s1, id), startAttempt(w.s1, id)]);
    expect(new Set(starts.map((s) => s.submissionId)).size).toBe(1);
    const submissionId = starts[0]!.submissionId;
    await Promise.all([submitAttempt(w.s1, { submissionId }), submitAttempt(w.s1, { submissionId }), submitAttempt(w.s1, { submissionId })]);
    expect(await db.submission.count({ where: { assignmentId: id, studentId: w.s1.studentId! } })).toBe(1);
    expect(await db.grade.count({ where: { submissionId } })).toBe(1);
  });

  it("stale tab gets 409 instead of overwriting newer answers; saves after submit are refused", async () => {
    const w = await world();
    const { id, questions } = await quiz(w.t, w.cls.id);
    const { submissionId } = await startAttempt(w.s1, id);
    expect(await saveAnswers(w.s1, { submissionId, version: 0, answers: { [questions[0]!.id]: { optionId: right(questions[0]!) } } })).toMatchObject({ ok: true, version: 1 });
    expect(await saveAnswers(w.s1, { submissionId, version: 0, answers: { [questions[0]!.id]: null } })).toMatchObject({ ok: false, reason: "version", version: 1 });
    await submitAttempt(w.s1, { submissionId });
    expect(await saveAnswers(w.s1, { submissionId, version: 1, answers: {} })).toMatchObject({ ok: false, reason: "closed" });
  });

  it("time limit: an expired attempt is submitted automatically at its deadline", async () => {
    const w = await world();
    const { id, questions } = await quiz(w.t, w.cls.id, { timeLimitMin: 10 });
    const { submissionId } = await startAttempt(w.s1, id);
    await saveAnswers(w.s1, { submissionId, version: 0, answers: { [questions[0]!.id]: { optionId: right(questions[0]!) } } });
    const sub = await db.submission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(sub.deadlineAt!.getTime() - sub.startedAt.getTime()).toBe(10 * 60_000);
    // pretend the student left the tab open for 20 minutes
    await db.submission.update({ where: { id: submissionId }, data: { deadlineAt: new Date(Date.now() - 5 * 60_000) } });
    expect(await saveAnswers(w.s1, { submissionId, version: 1, answers: {} })).toMatchObject({ ok: false, reason: "closed" });
    const after = await db.submission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(after.status).toBe("GRADED");
    expect(after.submittedAt!.getTime()).toBe(after.deadlineAt!.getTime());
    expect(Number(after.finalScore)).toBe(3.33);
    expect(await finalizeIfExpired(submissionId)).toBe(false);
  });

  it("forged answers are ignored: unknown question ids, other students' files", async () => {
    const w = await world();
    const { id } = await svc.createAssignment(w.t, { title: "Speak", kind: "SPEAKING" });
    await svc.saveQuestion(w.t, id, { type: "SPEAKING", prompt: "Introduce yourself", points: 5, maxDurationSec: 60 } as QuestionDraft);
    await svc.addTarget(w.t, { assignmentId: id, classId: w.cls.id, targetType: "STUDENT", studentIds: [w.s1.studentId!] });
    await svc.setAssignmentStatus(w.t, id, "publish");
    await expect(startAttempt(w.s2, id)).rejects.toMatchObject({ code: "NOT_FOUND" }); // targeted to s1 only
    const q = await db.question.findFirstOrThrow({ where: { assignmentId: id } });
    const foreign = await db.file.create({ data: { storageKey: "x/a.webm", kind: "RECORDING", originalName: "a.webm", mimeType: "audio/webm", extension: "webm", sizeBytes: BigInt(10), sha256: "x", uploadedBy: w.s2.id } });
    const mine = await db.file.create({ data: { storageKey: "x/b.webm", kind: "RECORDING", originalName: "b.webm", mimeType: "audio/webm", extension: "webm", sizeBytes: BigInt(10), sha256: "y", uploadedBy: w.s1.id } });
    const { submissionId } = await startAttempt(w.s1, id);
    await expect(saveAnswers(w.s1, { submissionId, version: 0, answers: { [q.id]: { fileId: foreign.id } } })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await saveAnswers(w.s1, { submissionId, version: 0, answers: { [q.id]: { fileId: mine.id }, "00000000-0000-4000-8000-000000000999": { text: "x" } } })).toMatchObject({ ok: true });
    await submitAttempt(w.s1, { submissionId });
    // the class teacher can play the recording; another teacher and classmates cannot
    expect(await canAccessFile(w.t, mine.id)).not.toBeNull();
    expect(await canAccessFile(w.other, mine.id)).toBeNull();
    expect(await canAccessFile(w.s2, mine.id)).toBeNull();
  });

  it("questions are locked once a student has started; duplicate gives an editable copy", async () => {
    const w = await world();
    const { id } = await quiz(w.t, w.cls.id);
    await startAttempt(w.s1, id);
    await expect(svc.saveQuestion(w.t, id, { type: "TRUE_FALSE", prompt: "x", points: 1, correct: true } as QuestionDraft)).rejects.toMatchObject({ code: "CONFLICT" });
    const copy = await svc.duplicateAssignment(w.t, id);
    expect(await db.question.count({ where: { assignmentId: copy.id } })).toBe(2);
    await svc.saveQuestion(w.t, copy.id, { type: "TRUE_FALSE", prompt: "x", points: 1, correct: true } as QuestionDraft);
    // only the author edits
    await expect(svc.saveQuestion(w.other, copy.id, { type: "TRUE_FALSE", prompt: "x", points: 1, correct: true } as QuestionDraft)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("publishing needs questions and a target; scheduled assignments stay hidden until available", async () => {
    const w = await world();
    const { id } = await svc.createAssignment(w.t, { title: "Later", kind: "QUIZ" });
    await expect(svc.setAssignmentStatus(w.t, id, "publish")).rejects.toMatchObject({ message: "Bài tập chưa có câu hỏi nào." });
    await svc.saveQuestion(w.t, id, { type: "TRUE_FALSE", prompt: "x", points: 1, correct: true } as QuestionDraft);
    await expect(svc.setAssignmentStatus(w.t, id, "publish")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await svc.addTarget(w.t, { assignmentId: id, classId: w.cls.id, targetType: "CLASS", studentIds: [], availableAt: iso(2 * H) });
    await svc.setAssignmentStatus(w.t, id, "publish");
    await expect(startAttempt(w.s1, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listAssignmentsForStudent(w.s1)).todo).toEqual([]);
    // a teacher of another class cannot target a class they do not teach
    const otherCls = await makeClass({ teacherIds: [w.other.teacherId!] });
    await expect(svc.addTarget(w.t, { assignmentId: id, classId: otherCls.id, targetType: "CLASS", studentIds: [] })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("listening quiz: linked to the audio item, audio playable by assigned students, transcript sent only after submitting", async () => {
    const w = await world();
    const mp3 = await db.file.create({ data: { storageKey: "x/l.mp3", kind: "AUDIO", originalName: "l.mp3", mimeType: "audio/mpeg", extension: "mp3", sizeBytes: BigInt(10), sha256: "z", uploadedBy: w.t.id } });
    const lesson = await db.lesson.create({
      data: {
        title: "Unit 3",
        status: "PUBLISHED",
        authorId: w.t.id,
        classes: { create: { classId: w.cls.id } },
        audioLessons: { create: { title: "Meet my family", audioFileId: mp3.id, transcriptMode: "AFTER_SUBMIT", transcript: { type: "doc", content: [] } } },
      },
      include: { audioLessons: true },
    });
    const item = lesson.audioLessons[0]!;
    const quiz = await svc.createListeningQuiz(w.t, lesson.id, item.id);
    expect(await svc.createListeningQuiz(w.t, lesson.id, item.id)).toEqual(quiz); // idempotent
    await expect(svc.createListeningQuiz(w.other, lesson.id, item.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await svc.saveQuestion(w.t, quiz.id, { type: "TRUE_FALSE", prompt: "Anna has a brother.", points: 1, correct: false } as QuestionDraft);
    await svc.addTarget(w.t, { assignmentId: quiz.id, classId: w.cls.id, targetType: "CLASS", studentIds: [] });
    await svc.setAssignmentStatus(w.t, quiz.id, "publish");

    const before = await getLessonDetail(w.s1, lesson.id);
    expect(before!.lesson.audioLessons[0]).toMatchObject({ transcript: null, quiz: { assignmentId: quiz.id, assigned: true, submitted: false } });
    const { submissionId } = await startAttempt(w.s1, quiz.id);
    const view = await getAttempt(w.s1, submissionId);
    expect(view).toMatchObject({ listening: { audioFileId: mp3.id } });
    expect(JSON.stringify(view)).not.toContain("transcript");
    await submitAttempt(w.s1, { submissionId });
    const after = await getLessonDetail(w.s1, lesson.id);
    expect(after!.lesson.audioLessons[0]).toMatchObject({ quiz: { submitted: true } });
    expect(after!.lesson.audioLessons[0]!.transcript).not.toBeNull();
    // staff always get the transcript
    expect((await getLessonDetail(w.t, lesson.id))!.lesson.audioLessons[0]!.transcript).not.toBeNull();
  });
});
