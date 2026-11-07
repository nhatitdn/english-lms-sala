"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction } from "@/server/action";
import { startAttempt, submitAttempt } from "./attempt";
import { excuseStudent, gradeSubmission } from "./grading";
import {
  assignmentIdSchema,
  assignmentSettingsSchema,
  createAssignmentSchema,
  excuseSchema,
  extensionSchema,
  gradeSchema,
  listeningQuizSchema,
  moveQuestionSchema,
  questionRefSchema,
  removeTargetSchema,
  saveQuestionSchema,
  startAttemptSchema,
  submitSchema,
  targetSchema,
} from "./schemas";
import * as service from "./service";

const STAFF = ["ADMIN", "TEACHER"] as const;
const touch = (assignmentId?: string) => {
  revalidatePath("/app", "layout");
  if (assignmentId) revalidatePath(`/app/assignments/${assignmentId}`, "layout");
};

export const createAssignmentAction = createAction({ schema: createAssignmentSchema, roles: [...STAFF] }, async (input, { user }) => {
  const a = await service.createAssignment(user, input);
  touch();
  return { data: a };
});

export const updateAssignmentSettingsAction = createAction({ schema: assignmentSettingsSchema, roles: [...STAFF] }, async (input, { user }) => {
  await service.updateAssignmentSettings(user, input);
  touch(input.id);
  return { data: null, message: "Đã lưu cài đặt bài tập." };
});

export const setAssignmentStatusAction = createAction(
  { schema: assignmentIdSchema.extend({ action: z.enum(["publish", "unpublish", "close", "reopen"]) }), roles: [...STAFF] },
  async (input, { user }) => {
    await service.setAssignmentStatus(user, input.assignmentId, input.action);
    touch(input.assignmentId);
    const msg = { publish: "Đã đăng bài tập — học viên đã nhận được thông báo.", unpublish: "Đã chuyển về bản nháp.", close: "Đã khóa bài tập.", reopen: "Đã mở lại bài tập." };
    return { data: null, message: msg[input.action] };
  },
);

export const deleteAssignmentAction = createAction({ schema: assignmentIdSchema, roles: [...STAFF] }, async (input, { user }) => {
  await service.deleteAssignment(user, input.assignmentId);
  touch();
  return { data: null, message: "Đã xóa bài tập." };
});

export const duplicateAssignmentAction = createAction({ schema: assignmentIdSchema, roles: [...STAFF] }, async (input, { user }) => {
  const copy = await service.duplicateAssignment(user, input.assignmentId);
  touch();
  return { data: copy, message: "Đã tạo bản sao." };
});

export const releaseAnswersAction = createAction({ schema: assignmentIdSchema, roles: [...STAFF] }, async (input, { user }) => {
  await service.releaseAnswers(user, input.assignmentId);
  touch(input.assignmentId);
  return { data: null, message: "Học viên đã xem được đáp án." };
});

export const saveQuestionAction = createAction({ schema: saveQuestionSchema, roles: [...STAFF] }, async (input, { user }) => {
  const q = await service.saveQuestion(user, input.assignmentId, input.question);
  touch(input.assignmentId);
  return { data: q, message: "Đã lưu câu hỏi." };
});

export const deleteQuestionAction = createAction({ schema: questionRefSchema, roles: [...STAFF] }, async (input, { user }) => {
  await service.deleteQuestion(user, input.assignmentId, input.questionId);
  touch(input.assignmentId);
  return { data: null, message: "Đã xóa câu hỏi." };
});

export const moveQuestionAction = createAction({ schema: moveQuestionSchema, roles: [...STAFF] }, async (input, { user }) => {
  await service.moveQuestion(user, input.assignmentId, input.questionId, input.direction);
  touch(input.assignmentId);
  return { data: null };
});

export const addTargetAction = createAction({ schema: targetSchema, roles: [...STAFF] }, async (input, { user }) => {
  await service.addTarget(user, input);
  touch(input.assignmentId);
  return { data: null, message: "Đã giao bài." };
});

export const removeTargetAction = createAction({ schema: removeTargetSchema, roles: [...STAFF] }, async (input, { user }) => {
  await service.removeTarget(user, input.assignmentId, input.targetId);
  touch(input.assignmentId);
  return { data: null, message: "Đã gỡ đối tượng giao bài." };
});

export const grantExtensionAction = createAction({ schema: extensionSchema, roles: [...STAFF] }, async (input, { user }) => {
  await service.grantExtension(user, input);
  touch(input.assignmentId);
  return { data: null, message: "Đã gia hạn cho học viên." };
});

export const excuseStudentAction = createAction({ schema: excuseSchema, roles: [...STAFF] }, async (input, { user }) => {
  await excuseStudent(user, input);
  touch(input.assignmentId);
  return { data: null, message: "Đã miễn bài cho học viên." };
});

export const createListeningQuizAction = createAction({ schema: listeningQuizSchema, roles: [...STAFF] }, async (input, { user }) => {
  const a = await service.createListeningQuiz(user, input.lessonId, input.audioLessonId);
  revalidatePath(`/app/lessons/${input.lessonId}`, "layout");
  return { data: a };
});

// ── Grading (staff only — students calling this get FORBIDDEN from the wrapper) ──
export const gradeSubmissionAction = createAction({ schema: gradeSchema, roles: [...STAFF] }, async (input, { user }) => {
  const r = await gradeSubmission(user, input);
  touch();
  return { data: r, message: r.status === "NEEDS_REVISION" ? "Đã gửi yêu cầu làm lại cho học viên." : "Đã lưu điểm." };
});

// ── Student ──
export const startAttemptAction = createAction({ schema: startAttemptSchema, roles: ["STUDENT"] }, async (input, { user }) => {
  const r = await startAttempt(user, input.assignmentId);
  return { data: r };
});

export const submitAttemptAction = createAction({ schema: submitSchema, roles: ["STUDENT"] }, async (input, { user }) => {
  const r = await submitAttempt(user, input);
  touch();
  return { data: r, message: "Đã nộp bài." };
});
