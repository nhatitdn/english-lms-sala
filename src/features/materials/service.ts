import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { MaterialType, Skill } from "@/generated/prisma/enums";
import { youtubeId } from "@/lib/youtube";
import type { CurrentUser } from "@/server/auth/current-user";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { AppError, forbiddenError, notFoundError } from "@/server/errors";
import type { MaterialListQuery } from "./schemas";

export const MATERIAL_PAGE_SIZE = 24;

function requireStaff(actor: CurrentUser) {
  if (actor.role !== "ADMIN" && actor.role !== "TEACHER") throw forbiddenError();
}

/** Materials a staff member may use: their own + everything shared between teachers (admin: all). */
export function usableMaterialWhere(actor: CurrentUser): Prisma.LearningMaterialWhereInput {
  return actor.role === "ADMIN" ? { deletedAt: null } : { deletedAt: null, OR: [{ ownerId: actor.id }, { sharedWithTeachers: true }] };
}

export async function createMaterialFromFile(actor: CurrentUser, input: { fileId: string; title?: string; skill?: Skill; tags: string[] }) {
  requireStaff(actor);
  const file = await db.file.findFirst({
    where: { id: input.fileId, deletedAt: null, ...(actor.role === "ADMIN" ? {} : { uploadedBy: actor.id }) },
    select: { id: true, kind: true, originalName: true },
  });
  if (!file || file.kind === "RECORDING") throw notFoundError();
  const type = file.kind as MaterialType;
  const material = await db.learningMaterial.create({
    data: {
      title: input.title || file.originalName.replace(/\.[^.]+$/, ""),
      type,
      fileId: file.id,
      skill: input.skill ?? (type === "AUDIO" ? "LISTENING" : null),
      tags: input.tags,
      ownerId: actor.id,
    },
    select: { id: true, title: true, type: true },
  });
  await audit({ actorId: actor.id, action: "material.create", entityType: "material", entityId: material.id });
  return material;
}

export async function createLinkMaterial(actor: CurrentUser, input: { url: string; title: string; skill?: Skill; tags: string[] }) {
  requireStaff(actor);
  const type: MaterialType = youtubeId(input.url) ? "YOUTUBE" : "LINK";
  const material = await db.learningMaterial.create({
    data: { title: input.title, type, url: input.url, skill: input.skill ?? null, tags: input.tags, ownerId: actor.id },
    select: { id: true, title: true, type: true },
  });
  await audit({ actorId: actor.id, action: "material.create", entityType: "material", entityId: material.id });
  return material;
}

async function ownMaterial(actor: CurrentUser, id: string) {
  requireStaff(actor);
  const m = await db.learningMaterial.findFirst({
    where: { id, deletedAt: null, ...(actor.role === "ADMIN" ? {} : { ownerId: actor.id }) },
    select: { id: true },
  });
  if (!m) throw notFoundError();
  return m;
}

export async function updateMaterial(
  actor: CurrentUser,
  input: { id: string; title: string; description?: string; skill?: Skill; tags: string[]; sharedWithTeachers: boolean },
) {
  await ownMaterial(actor, input.id);
  await db.learningMaterial.update({
    where: { id: input.id },
    data: { title: input.title, description: input.description || null, skill: input.skill ?? null, tags: input.tags, sharedWithTeachers: input.sharedWithTeachers },
  });
}

/** Soft delete. Refused while still attached to a lesson, so lessons never lose files silently. */
export async function deleteMaterial(actor: CurrentUser, id: string) {
  await ownMaterial(actor, id);
  const uses = await db.lessonAttachment.count({ where: { materialId: id, lesson: { deletedAt: null } } });
  if (uses > 0) throw new AppError("CONFLICT", `Tài liệu đang dùng trong ${uses} bài giảng. Hãy gỡ khỏi bài giảng trước khi xóa.`);
  await db.learningMaterial.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit({ actorId: actor.id, action: "material.delete", entityType: "material", entityId: id });
}

/** Library listing with accent-insensitive search ("tu vung" finds "Từ vựng"). */
export async function listMaterials(actor: CurrentUser, query: MaterialListQuery) {
  requireStaff(actor);
  let idFilter: Prisma.LearningMaterialWhereInput = {};
  if (query.q) {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM learning_materials
      WHERE deleted_at IS NULL
        AND immutable_unaccent(lower(title || ' ' || coalesce(description, '') || ' ' || array_to_string(tags, ' ')))
            LIKE '%' || immutable_unaccent(lower(${query.q})) || '%'
      LIMIT 500`;
    idFilter = { id: { in: rows.map((r) => r.id) } };
  }
  const where: Prisma.LearningMaterialWhereInput = {
    AND: [usableMaterialWhere(actor), idFilter, query.skill ? { skill: query.skill } : {}, query.type ? { type: query.type } : {}],
  };
  const [total, rows] = await Promise.all([
    db.learningMaterial.count({ where }),
    db.learningMaterial.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * MATERIAL_PAGE_SIZE,
      take: MATERIAL_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        url: true,
        skill: true,
        tags: true,
        sharedWithTeachers: true,
        createdAt: true,
        ownerId: true,
        owner: { select: { fullName: true } },
        file: { select: { id: true, originalName: true, sizeBytes: true, mimeType: true } },
        _count: { select: { attachments: true } },
      },
    }),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / MATERIAL_PAGE_SIZE)) };
}
