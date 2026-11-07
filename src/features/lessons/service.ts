import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Skill, TranscriptMode } from "@/generated/prisma/enums";
import { createLinkMaterial, createMaterialFromFile, usableMaterialWhere } from "@/features/materials/service";
import { plainToRichText, sanitizeRichText } from "@/features/rich-text/sanitize";
import type { CurrentUser } from "@/server/auth/current-user";
import { canEditLesson, canManageClass, canViewLesson } from "@/server/authz/policies";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError, forbiddenError, notFoundError } from "@/server/errors";

const MAX_CONTENT_BYTES = 300_000;
const asJson = (v: unknown) => v as Prisma.InputJsonValue;

function requireStaff(actor: CurrentUser) {
  if (actor.role !== "ADMIN" && actor.role !== "TEACHER") throw forbiddenError();
}

async function assertEditable(actor: CurrentUser, lessonId: string) {
  if (!(await canEditLesson(actor, lessonId))) throw notFoundError();
}

export async function createLesson(actor: CurrentUser, input: { title: string; skill: Skill; classId?: string }) {
  requireStaff(actor);
  if (input.classId && !(await canManageClass(actor, input.classId))) throw notFoundError();
  const lesson = await db.lesson.create({
    data: {
      title: input.title,
      skill: input.skill,
      authorId: actor.id,
      ...(input.classId ? { classes: { create: { classId: input.classId } } } : {}),
    },
    select: { id: true },
  });
  await audit({ actorId: actor.id, action: "lesson.create", entityType: "lesson", entityId: lesson.id });
  return lesson;
}

export async function updateLesson(
  actor: CurrentUser,
  input: { id: string; title: string; description?: string; skill: Skill; tags: string[]; content: unknown },
) {
  await assertEditable(actor, input.id);
  const { doc, fileIds } = sanitizeRichText(input.content);
  if (JSON.stringify(doc).length > MAX_CONTENT_BYTES) throw new AppError("VALIDATION_ERROR", "Nội dung bài giảng quá dài.");
  // embedded images must be files the editor uploaded (or any file for admins)
  const allowed = fileIds.length
    ? await db.file.findMany({
        where: { id: { in: fileIds }, deletedAt: null, kind: "IMAGE", ...(actor.role === "ADMIN" ? {} : { uploadedBy: actor.id }) },
        select: { id: true },
      })
    : [];
  const allowedIds = new Set(allowed.map((f) => f.id));
  const existing = await db.lesson.findUniqueOrThrow({ where: { id: input.id }, select: { contentFileIds: true } });
  // keep previously-approved images (e.g. lesson duplicated from a colleague)
  const keep = fileIds.filter((id) => allowedIds.has(id) || existing.contentFileIds.includes(id));
  await db.lesson.update({
    where: { id: input.id },
    data: { title: input.title, description: input.description ?? null, skill: input.skill, tags: input.tags, content: asJson(doc), contentFileIds: keep },
  });
}

/** Choose which classes see the lesson. Only classes the actor manages can be added or removed. */
export async function setLessonClasses(actor: CurrentUser, lessonId: string, classIds: string[], visibleFrom?: string) {
  await assertEditable(actor, lessonId);
  for (const id of classIds) if (!(await canManageClass(actor, id))) throw notFoundError();
  const current = await db.lessonClass.findMany({ where: { lessonId }, select: { classId: true } });
  const removable: string[] = [];
  for (const c of current) if (!classIds.includes(c.classId) && (await canManageClass(actor, c.classId))) removable.push(c.classId);
  const when = visibleFrom ? new Date(visibleFrom) : null;
  await db.$transaction(async (tx) => {
    await tx.lessonClass.deleteMany({ where: { lessonId, classId: { in: removable } } });
    for (const classId of classIds) {
      await tx.lessonClass.upsert({
        where: { lessonId_classId: { lessonId, classId } },
        create: { lessonId, classId, visibleFrom: when },
        update: { visibleFrom: when },
      });
    }
  });
  await audit({ actorId: actor.id, action: "lesson.set_classes", entityType: "lesson", entityId: lessonId, metadata: { classIds, visibleFrom: visibleFrom ?? null } });
}

export async function setLessonStatus(actor: CurrentUser, lessonId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  await assertEditable(actor, lessonId);
  await db.lesson.update({
    where: { id: lessonId },
    data: { status, ...(status === "PUBLISHED" ? { publishedAt: new Date() } : {}) },
  });
  await audit({ actorId: actor.id, action: `lesson.${status.toLowerCase()}`, entityType: "lesson", entityId: lessonId });
}

export async function deleteLesson(actor: CurrentUser, lessonId: string) {
  await assertEditable(actor, lessonId);
  await db.lesson.update({ where: { id: lessonId }, data: { deletedAt: new Date() } });
  await audit({ actorId: actor.id, action: "lesson.delete", entityType: "lesson", entityId: lessonId });
}

/** Copy a lesson (content, attachments and listening items reuse the same files) as a new draft. */
export async function duplicateLesson(actor: CurrentUser, lessonId: string): Promise<{ id: string }> {
  requireStaff(actor);
  if (!(await canViewLesson(actor, lessonId))) throw notFoundError();
  const src = await db.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: { attachments: true, audioLessons: true },
  });
  const copy = await db.lesson.create({
    data: {
      title: `${src.title} (bản sao)`,
      description: src.description,
      content: src.content ?? undefined,
      contentFileIds: src.contentFileIds,
      skill: src.skill,
      tags: src.tags,
      authorId: actor.id,
      copiedFromId: src.id,
      attachments: { create: src.attachments.map((a) => ({ materialId: a.materialId, sortOrder: a.sortOrder })) },
      audioLessons: {
        create: src.audioLessons.map((a) => ({
          title: a.title,
          instructions: a.instructions ?? undefined,
          audioFileId: a.audioFileId,
          coverFileId: a.coverFileId,
          transcript: a.transcript ?? undefined,
          transcriptMode: a.transcriptMode,
          completeThreshold: a.completeThreshold,
          sortOrder: a.sortOrder,
        })),
      },
    },
    select: { id: true },
  });
  await audit({ actorId: actor.id, action: "lesson.duplicate", entityType: "lesson", entityId: copy.id, metadata: { from: lessonId } });
  return copy;
}

// ───────────────────────── Attachments (reusable materials) ─────────────────────────

export async function attachMaterial(actor: CurrentUser, lessonId: string, materialId: string) {
  await assertEditable(actor, lessonId);
  const material = await db.learningMaterial.findFirst({ where: { AND: [{ id: materialId }, usableMaterialWhere(actor)] }, select: { id: true } });
  if (!material) throw notFoundError();
  const max = await db.lessonAttachment.aggregate({ where: { lessonId }, _max: { sortOrder: true } });
  await db.lessonAttachment.upsert({
    where: { lessonId_materialId: { lessonId, materialId } },
    create: { lessonId, materialId, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    update: {},
  });
}

/** Upload → library material → attached, in one step. */
export async function attachUploadedFile(actor: CurrentUser, lessonId: string, fileId: string) {
  await assertEditable(actor, lessonId);
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { skill: true } });
  const material = await createMaterialFromFile(actor, { fileId, tags: [], skill: lesson.skill });
  await attachMaterial(actor, lessonId, material.id);
  return material;
}

export async function attachLink(actor: CurrentUser, lessonId: string, url: string, title: string) {
  await assertEditable(actor, lessonId);
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { skill: true } });
  const material = await createLinkMaterial(actor, { url, title, tags: [], skill: lesson.skill });
  await attachMaterial(actor, lessonId, material.id);
  return material;
}

export async function detachMaterial(actor: CurrentUser, lessonId: string, materialId: string) {
  await assertEditable(actor, lessonId);
  await db.lessonAttachment.deleteMany({ where: { lessonId, materialId } });
}

// ───────────────────────── Listening items ─────────────────────────

export async function upsertAudioLesson(
  actor: CurrentUser,
  input: {
    lessonId: string;
    audioLessonId?: string;
    title: string;
    audioFileId: string;
    coverFileId?: string;
    instructions?: string;
    transcript?: string;
    transcriptMode: TranscriptMode;
    completeThreshold: number;
  },
) {
  await assertEditable(actor, input.lessonId);
  const ownFile = (id: string, kind: "AUDIO" | "IMAGE") =>
    db.file.findFirst({
      where: {
        id,
        kind,
        deletedAt: null,
        // own upload, or a file already used by a listening item / material this staff member may use
        OR: [
          ...(actor.role === "ADMIN" ? [{}] : []),
          { uploadedBy: actor.id },
          { audioLessons: { some: { lesson: { authorId: actor.id } } } },
          { materials: { some: usableMaterialWhere(actor) } },
        ],
      },
      select: { id: true },
    });
  if (!(await ownFile(input.audioFileId, "AUDIO"))) throw new AppError("VALIDATION_ERROR", "File âm thanh không hợp lệ.");
  if (input.coverFileId && !(await ownFile(input.coverFileId, "IMAGE"))) throw new AppError("VALIDATION_ERROR", "Ảnh minh họa không hợp lệ.");

  const data = {
    title: input.title,
    audioFileId: input.audioFileId,
    coverFileId: input.coverFileId ?? null,
    instructions: input.instructions?.trim() ? asJson(plainToRichText(input.instructions.trim())) : undefined,
    transcript: input.transcript?.trim() ? asJson(plainToRichText(input.transcript.trim())) : undefined,
    transcriptMode: input.transcriptMode,
    completeThreshold: input.completeThreshold,
  };
  if (input.audioLessonId) {
    const res = await db.audioLesson.updateMany({
      where: { id: input.audioLessonId, lessonId: input.lessonId },
      data: { ...data, instructions: data.instructions ?? Prisma.DbNull, transcript: data.transcript ?? Prisma.DbNull },
    });
    if (res.count === 0) throw notFoundError();
    return { id: input.audioLessonId };
  }
  const max = await db.audioLesson.aggregate({ where: { lessonId: input.lessonId }, _max: { sortOrder: true } });
  const created = await db.audioLesson.create({ data: { ...data, lessonId: input.lessonId, sortOrder: (max._max.sortOrder ?? 0) + 1 }, select: { id: true } });
  await audit({ actorId: actor.id, action: "audio.create", entityType: "audio_lesson", entityId: created.id });
  return created;
}

export async function deleteAudioLesson(actor: CurrentUser, lessonId: string, audioLessonId: string) {
  await assertEditable(actor, lessonId);
  const res = await db.audioLesson.deleteMany({ where: { id: audioLessonId, lessonId } });
  if (res.count === 0) throw notFoundError();
}
