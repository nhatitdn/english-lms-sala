"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction } from "@/server/action";
import { audioStats } from "./queries";
import {
  attachFileSchema,
  attachLinkSchema,
  attachSchema,
  audioDeleteSchema,
  audioLessonSchema,
  createLessonSchema,
  lessonClassesSchema,
  lessonIdSchema,
  updateLessonSchema,
} from "./schemas";
import * as service from "./service";

const STAFF = ["ADMIN", "TEACHER"] as const;
const touch = (lessonId: string) => {
  revalidatePath(`/app/lessons/${lessonId}`, "layout");
  revalidatePath("/app/classes", "layout");
};

export const createLessonAction = createAction({ schema: createLessonSchema, roles: [...STAFF] }, async (input, { user }) => {
  const lesson = await service.createLesson(user, input);
  revalidatePath("/app/lessons");
  return { data: lesson };
});

export const updateLessonAction = createAction({ schema: updateLessonSchema, roles: [...STAFF] }, async (input, { user }) => {
  await service.updateLesson(user, input);
  touch(input.id);
  return { data: null, message: "Đã lưu bài giảng." };
});

export const setLessonClassesAction = createAction({ schema: lessonClassesSchema, roles: [...STAFF] }, async (input, { user }) => {
  await service.setLessonClasses(user, input.lessonId, input.classIds, input.visibleFrom);
  touch(input.lessonId);
  return { data: null, message: "Đã cập nhật lớp được xem." };
});

export const publishLessonAction = createAction({ schema: lessonIdSchema, roles: [...STAFF] }, async ({ lessonId }, { user }) => {
  await service.setLessonStatus(user, lessonId, "PUBLISHED");
  touch(lessonId);
  return { data: null, message: "Đã xuất bản bài giảng." };
});

export const unpublishLessonAction = createAction({ schema: lessonIdSchema, roles: [...STAFF] }, async ({ lessonId }, { user }) => {
  await service.setLessonStatus(user, lessonId, "DRAFT");
  touch(lessonId);
  return { data: null, message: "Đã chuyển về bản nháp. Học viên không còn thấy bài này." };
});

export const deleteLessonAction = createAction({ schema: lessonIdSchema, roles: [...STAFF] }, async ({ lessonId }, { user }) => {
  await service.deleteLesson(user, lessonId);
  revalidatePath("/app/lessons");
  return { data: null, message: "Đã xóa bài giảng." };
});

export const duplicateLessonAction = createAction({ schema: lessonIdSchema, roles: [...STAFF] }, async ({ lessonId }, { user }) => {
  const copy = await service.duplicateLesson(user, lessonId);
  revalidatePath("/app/lessons");
  return { data: copy, message: "Đã tạo bản sao." };
});

export const attachMaterialAction = createAction({ schema: attachSchema, roles: [...STAFF] }, async (input, { user }) => {
  await service.attachMaterial(user, input.lessonId, input.materialId);
  touch(input.lessonId);
  return { data: null, message: "Đã đính kèm." };
});

export const attachFileAction = createAction({ schema: attachFileSchema, roles: [...STAFF] }, async (input, { user }) => {
  const m = await service.attachUploadedFile(user, input.lessonId, input.fileId);
  touch(input.lessonId);
  return { data: m, message: "Đã đính kèm file." };
});

export const attachLinkAction = createAction({ schema: attachLinkSchema, roles: [...STAFF] }, async (input, { user }) => {
  const m = await service.attachLink(user, input.lessonId, input.url, input.title);
  touch(input.lessonId);
  return { data: m, message: "Đã thêm link." };
});

export const detachMaterialAction = createAction({ schema: attachSchema, roles: [...STAFF] }, async (input, { user }) => {
  await service.detachMaterial(user, input.lessonId, input.materialId);
  touch(input.lessonId);
  return { data: null, message: "Đã gỡ khỏi bài giảng (tài liệu vẫn còn trong thư viện)." };
});

export const upsertAudioLessonAction = createAction({ schema: audioLessonSchema, roles: [...STAFF] }, async (input, { user }) => {
  const a = await service.upsertAudioLesson(user, input);
  touch(input.lessonId);
  return { data: a, message: "Đã lưu bài nghe." };
});

export const deleteAudioLessonAction = createAction({ schema: audioDeleteSchema, roles: [...STAFF] }, async (input, { user }) => {
  await service.deleteAudioLesson(user, input.lessonId, input.audioLessonId);
  touch(input.lessonId);
  return { data: null, message: "Đã xóa bài nghe." };
});

export const audioStatsAction = createAction({ schema: z.object({ audioLessonId: z.uuid() }), roles: [...STAFF] }, async (input, { user }) => ({
  data: await audioStats(user, input.audioLessonId),
}));
