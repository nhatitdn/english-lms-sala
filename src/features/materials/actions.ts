"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction } from "@/server/action";
import { materialFromFileSchema, materialLinkSchema, materialListSchema, materialUpdateSchema } from "./schemas";
import * as service from "./service";

const STAFF = ["ADMIN", "TEACHER"] as const;

export const createMaterialFromFileAction = createAction({ schema: materialFromFileSchema, roles: [...STAFF] }, async (input, { user }) => {
  const m = await service.createMaterialFromFile(user, input);
  revalidatePath("/app/library");
  return { data: m, message: "Đã thêm vào thư viện." };
});

export const createLinkMaterialAction = createAction({ schema: materialLinkSchema, roles: [...STAFF] }, async (input, { user }) => {
  const m = await service.createLinkMaterial(user, input);
  revalidatePath("/app/library");
  return { data: m, message: "Đã thêm link vào thư viện." };
});

export const updateMaterialAction = createAction({ schema: materialUpdateSchema, roles: [...STAFF] }, async (input, { user }) => {
  await service.updateMaterial(user, input);
  revalidatePath("/app/library");
  return { data: null, message: "Đã lưu." };
});

export const deleteMaterialAction = createAction({ schema: z.object({ id: z.uuid() }), roles: [...STAFF] }, async ({ id }, { user }) => {
  await service.deleteMaterial(user, id);
  revalidatePath("/app/library");
  return { data: null, message: "Đã xóa khỏi thư viện." };
});

/** Picker inside the lesson editor. */
export const searchLibraryAction = createAction({ schema: materialListSchema, roles: [...STAFF] }, async (input, { user }) => {
  const r = await service.listMaterials(user, input);
  return {
    data: r.rows.map((m) => ({ id: m.id, title: m.title, type: m.type, skill: m.skill, fileName: m.file?.originalName ?? m.url ?? "" })),
  };
});
