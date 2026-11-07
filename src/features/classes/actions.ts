"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction } from "@/server/action";
import { searchStudentsToAdd } from "./queries";
import {
  addStudentsSchema,
  classIdSchema,
  classSchema,
  csvImportSchema,
  groupDeleteSchema,
  groupMembersSchema,
  groupSchema,
  removeStudentSchema,
  scheduleDeleteSchema,
  scheduleSchema,
  teacherAssignSchema,
  teacherRemoveSchema,
  transferSchema,
  updateClassSchema,
} from "./schemas";
import * as service from "./service";

const MANAGERS = ["ADMIN", "TEACHER"] as const;
const path = (classId: string) => `/app/classes/${classId}`;

export const createClassAction = createAction({ schema: classSchema, roles: ["ADMIN"] }, async (input, { user }) => {
  const created = await service.createClass(user, input);
  revalidatePath("/app/classes");
  return { data: created, message: "Đã tạo lớp." };
});

export const updateClassAction = createAction({ schema: updateClassSchema, roles: ["ADMIN"] }, async (input, { user }) => {
  const { id, ...rest } = input;
  await service.updateClass(user, id, rest);
  revalidatePath(path(id), "layout");
  return { data: null, message: "Đã lưu thông tin lớp." };
});

export const archiveClassAction = createAction({ schema: classIdSchema, roles: ["ADMIN"] }, async ({ classId }, { user }) => {
  await service.archiveClass(user, classId);
  revalidatePath("/app/classes");
  return { data: null, message: "Đã lưu trữ lớp." };
});

export const assignTeacherAction = createAction({ schema: teacherAssignSchema, roles: ["ADMIN"] }, async (input, { user }) => {
  await service.assignTeacher(user, input.classId, input.teacherUserId, input.role);
  revalidatePath(path(input.classId), "layout");
  return { data: null, message: "Đã phân công giáo viên." };
});

export const removeTeacherAction = createAction({ schema: teacherRemoveSchema, roles: ["ADMIN"] }, async (input, { user }) => {
  await service.removeTeacher(user, input.classId, input.teacherUserId);
  revalidatePath(path(input.classId), "layout");
  return { data: null, message: "Đã bỏ phân công." };
});

export const addStudentsAction = createAction({ schema: addStudentsSchema, roles: [...MANAGERS] }, async (input, { user }) => {
  const r = await service.addStudents(user, input.classId, input.studentIds);
  revalidatePath(path(input.classId), "layout");
  return { data: r, message: r.added ? `Đã thêm ${r.added} học viên.` : "Học viên đã có trong lớp." };
});

export const removeStudentAction = createAction({ schema: removeStudentSchema, roles: [...MANAGERS] }, async (input, { user }) => {
  await service.removeStudent(user, input.classId, input.studentId, input.note);
  revalidatePath(path(input.classId), "layout");
  return { data: null, message: "Đã cho học viên rời lớp. Lịch sử học tập được giữ lại." };
});

export const transferStudentAction = createAction({ schema: transferSchema, roles: [...MANAGERS] }, async (input, { user }) => {
  await service.transferStudent(user, input.fromClassId, input.toClassId, input.studentId, input.note);
  revalidatePath(path(input.fromClassId), "layout");
  revalidatePath(path(input.toClassId), "layout");
  return { data: null, message: "Đã chuyển lớp. Lịch sử học tập được giữ lại." };
});

export const createGroupAction = createAction({ schema: groupSchema, roles: [...MANAGERS] }, async (input, { user }) => {
  const g = await service.createGroup(user, input.classId, input.name);
  revalidatePath(`${path(input.classId)}/members`);
  return { data: g, message: "Đã tạo nhóm." };
});

export const deleteGroupAction = createAction({ schema: groupDeleteSchema, roles: [...MANAGERS] }, async (input, { user }) => {
  await service.deleteGroup(user, input.classId, input.groupId);
  revalidatePath(`${path(input.classId)}/members`);
  return { data: null, message: "Đã xóa nhóm." };
});

export const setGroupMembersAction = createAction({ schema: groupMembersSchema, roles: [...MANAGERS] }, async (input, { user }) => {
  await service.setGroupMembers(user, input.classId, input.groupId, input.studentIds);
  revalidatePath(`${path(input.classId)}/members`);
  return { data: null, message: "Đã cập nhật nhóm." };
});

export const upsertScheduleAction = createAction({ schema: scheduleSchema, roles: [...MANAGERS] }, async (input, { user }) => {
  await service.upsertSchedule(user, input);
  revalidatePath(path(input.classId), "layout");
  return { data: null, message: "Đã lưu lịch học." };
});

export const deleteScheduleAction = createAction({ schema: scheduleDeleteSchema, roles: [...MANAGERS] }, async (input, { user }) => {
  await service.deleteSchedule(user, input.classId, input.scheduleId);
  revalidatePath(path(input.classId), "layout");
  return { data: null, message: "Đã xóa lịch học. Các buổi đã học được giữ lại." };
});

export const importStudentsAction = createAction({ schema: csvImportSchema, roles: ["ADMIN"] }, async (input, { user }) => {
  const rows = await service.importStudentsCsv(user, input.classId, input.csv);
  revalidatePath(path(input.classId), "layout");
  const ok = rows.filter((r) => !r.error).length;
  return { data: rows, message: `Đã tạo ${ok}/${rows.length} học viên.` };
});

export const searchStudentsToAddAction = createAction(
  { schema: z.object({ classId: z.uuid(), q: z.string().max(100) }), roles: [...MANAGERS] },
  async (input, { user }) => ({ data: await searchStudentsToAdd(user, input.classId, input.q) }),
);
