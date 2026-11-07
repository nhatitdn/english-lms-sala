"use server";

import { revalidatePath } from "next/cache";
import { createAction } from "@/server/action";
import { searchUsersByRole } from "./queries";
import { createUserSchema, linkSchema, setStatusSchema, unlinkSchema, updateUserSchema, userIdSchema } from "./schemas";
import { z } from "zod";
import * as service from "./service";

const ADMIN = ["ADMIN"] as const;

export const createUserAction = createAction({ schema: createUserSchema, roles: [...ADMIN] }, async (input, { user }) => {
  const created = await service.createUser(user, input);
  revalidatePath("/app/admin/users");
  return { data: created, message: "Đã tạo tài khoản." };
});

export const updateUserAction = createAction({ schema: updateUserSchema, roles: [...ADMIN] }, async (input, { user }) => {
  await service.updateUser(user, input);
  revalidatePath(`/app/admin/users/${input.id}`);
  revalidatePath("/app/admin/users");
  return { data: null, message: "Đã lưu thay đổi." };
});

export const resetPasswordAction = createAction({ schema: userIdSchema, roles: [...ADMIN] }, async (input, { user }) => {
  const result = await service.resetPassword(user, input.id);
  revalidatePath(`/app/admin/users/${input.id}`);
  return { data: result, message: "Đã tạo mật khẩu tạm mới." };
});

export const setUserStatusAction = createAction({ schema: setStatusSchema, roles: [...ADMIN] }, async (input, { user }) => {
  await service.setUserStatus(user, input.id, input.status);
  revalidatePath(`/app/admin/users/${input.id}`);
  revalidatePath("/app/admin/users");
  const messages = { ACTIVE: "Đã mở khóa tài khoản.", LOCKED: "Đã khóa tài khoản.", DISABLED: "Đã ngừng sử dụng tài khoản." } as const;
  return { data: null, message: messages[input.status] };
});

export const linkParentStudentAction = createAction({ schema: linkSchema, roles: [...ADMIN] }, async (input, { user }) => {
  await service.linkParentStudent(user, input);
  revalidatePath(`/app/admin/users/${input.parentUserId}`);
  revalidatePath(`/app/admin/users/${input.studentUserId}`);
  return { data: null, message: "Đã liên kết phụ huynh và học viên." };
});

export const unlinkParentStudentAction = createAction({ schema: unlinkSchema, roles: [...ADMIN] }, async (input, { user }) => {
  await service.unlinkParentStudent(user, input);
  revalidatePath(`/app/admin/users/${input.parentUserId}`);
  revalidatePath(`/app/admin/users/${input.studentUserId}`);
  return { data: null, message: "Đã bỏ liên kết." };
});

export const searchLinkCandidatesAction = createAction(
  { schema: z.object({ role: z.enum(["PARENT", "STUDENT"]), q: z.string().max(100) }), roles: [...ADMIN] },
  async (input, { user }) => ({ data: await searchUsersByRole(user, input.role, input.q) }),
);
