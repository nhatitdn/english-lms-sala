import { z } from "zod";
import { questionDraftSchema } from "./questions";

const KINDS = ["QUIZ", "LISTENING", "WRITING", "SPEAKING", "FILE_UPLOAD", "MIXED"] as const;
const REVEAL = ["NEVER", "AFTER_SUBMIT", "AFTER_DUE", "MANUAL"] as const;

const optionalInt = (min: number, max: number, msg: string) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int().min(min, msg).max(max, msg).nullable());
const bool = z.preprocess((v) => v === true || v === "true" || v === "on", z.boolean());
const isoDate = z.iso.datetime({ offset: true, message: "Thời điểm không hợp lệ." });
const optionalIso = z.preprocess((v) => (v === "" || v === null ? undefined : v), isoDate.optional());

export const createAssignmentSchema = z.object({
  title: z.string().trim().min(2, "Nhập tên bài tập.").max(200),
  kind: z.enum(KINDS).default("QUIZ"),
  classId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
});

export const assignmentSettingsSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(2, "Nhập tên bài tập.").max(200),
  description: z.string().trim().max(3000).optional().transform((v) => v || undefined),
  kind: z.enum(KINDS),
  maxScore: z.coerce.number().min(1, "Thang điểm từ 1 đến 100.").max(100, "Thang điểm từ 1 đến 100."),
  timeLimitMin: optionalInt(1, 600, "Thời gian làm bài từ 1 đến 600 phút."),
  maxAttempts: optionalInt(1, 20, "Số lần làm từ 1 đến 20."),
  allowLate: bool,
  answerReveal: z.enum(REVEAL),
  shuffleQuestions: bool,
  shuffleOptions: bool,
});

export const saveQuestionSchema = z.object({ assignmentId: z.uuid(), question: questionDraftSchema });
export const questionRefSchema = z.object({ assignmentId: z.uuid(), questionId: z.uuid() });
export const moveQuestionSchema = questionRefSchema.extend({ direction: z.enum(["up", "down"]) });
export const assignmentIdSchema = z.object({ assignmentId: z.uuid() });

export const targetSchema = z
  .object({
    assignmentId: z.uuid(),
    classId: z.uuid({ message: "Chọn lớp." }),
    targetType: z.enum(["CLASS", "GROUP", "STUDENT"]),
    groupId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
    studentIds: z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(z.uuid())),
    availableAt: optionalIso,
    dueAt: optionalIso,
    closeAt: optionalIso,
  })
  .superRefine((v, ctx) => {
    if (v.targetType === "GROUP" && !v.groupId) ctx.addIssue({ code: "custom", path: ["groupId"], message: "Chọn nhóm." });
    if (v.targetType === "STUDENT" && v.studentIds.length === 0) ctx.addIssue({ code: "custom", path: ["studentIds"], message: "Chọn ít nhất 1 học viên." });
    const avail = v.availableAt ? Date.parse(v.availableAt) : Date.now();
    if (v.dueAt && Date.parse(v.dueAt) <= avail) ctx.addIssue({ code: "custom", path: ["dueAt"], message: "Hạn nộp phải sau thời điểm giao." });
    if (v.closeAt && v.dueAt && Date.parse(v.closeAt) < Date.parse(v.dueAt)) ctx.addIssue({ code: "custom", path: ["closeAt"], message: "Thời điểm khóa bài phải sau hạn nộp." });
    if (v.closeAt && Date.parse(v.closeAt) <= avail) ctx.addIssue({ code: "custom", path: ["closeAt"], message: "Thời điểm khóa bài phải sau thời điểm giao." });
  });
export type TargetInput = z.infer<typeof targetSchema>;

export const removeTargetSchema = z.object({ assignmentId: z.uuid(), targetId: z.uuid() });

export const extensionSchema = z.object({
  assignmentId: z.uuid(),
  studentId: z.uuid({ message: "Chọn học viên." }),
  newDueAt: isoDate,
  reason: z.string().trim().max(300).optional().transform((v) => v || undefined),
});

export const listeningQuizSchema = z.object({ lessonId: z.uuid(), audioLessonId: z.uuid() });

// ── Student attempt ──
export const startAttemptSchema = z.object({ assignmentId: z.uuid() });
export const saveAnswersSchema = z.object({
  submissionId: z.uuid(),
  version: z.number().int().min(0),
  answers: z.record(z.uuid(), z.unknown()).refine((r) => Object.keys(r).length <= 200, "Quá nhiều câu trả lời."),
});
export const submitSchema = z.object({
  submissionId: z.uuid(),
  version: z.number().int().min(0).optional(),
  answers: z.record(z.uuid(), z.unknown()).optional(),
});

// ── Grading ──
export const gradeSchema = z.object({
  submissionId: z.uuid(),
  questions: z
    .array(
      z.object({
        questionId: z.uuid(),
        points: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().min(0, "Điểm không âm.").nullable()),
        comment: z.string().trim().max(2000).optional(),
      }),
    )
    .max(200),
  comment: z.string().trim().max(3000).optional(),
  needsRevision: z.boolean().default(false),
  scoreOverride: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().min(0).nullable()).default(null),
  reason: z.string().trim().max(300).optional(),
});
export type GradeInput = z.infer<typeof gradeSchema>;

export const excuseSchema = z.object({ assignmentId: z.uuid(), studentId: z.uuid(), classId: z.uuid() });
