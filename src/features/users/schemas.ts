import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants";

export const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_RE, "Chỉ dùng chữ thường không dấu, số và . _ - (3–40 ký tự).");

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`)
  .max(200, "Mật khẩu quá dài.");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.email("Email không hợp lệ.").optional());

const phoneSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/[\s.]/g, "") : undefined))
  .pipe(z.string().regex(/^\+?\d{9,12}$/, "Số điện thoại không hợp lệ.").optional());

const dateSchema = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.iso.date("Ngày không hợp lệ.").optional());

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

const levelSchema = z
  .enum(["STARTER", "BEGINNER", "ELEMENTARY", "PRE_INTERMEDIATE", "INTERMEDIATE", "UPPER_INTERMEDIATE", "ADVANCED"])
  .optional()
  .or(z.literal("").transform(() => undefined));

const baseFields = {
  username: usernameSchema,
  fullName: z.string().trim().min(2, "Vui lòng nhập họ tên.").max(100),
  email: emailSchema,
  phone: phoneSchema,
};

const studentFields = {
  dateOfBirth: dateSchema,
  school: optionalText(150),
  currentLevel: levelSchema,
  isIndependent: checkbox,
  guardianConsent: checkbox,
  privateNotes: optionalText(2000),
};

const teacherFields = {
  displayName: optionalText(100),
  qualifications: optionalText(300),
};

export const createUserSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("ADMIN"), ...baseFields, alsoTeacher: checkbox, password: passwordSchema.optional().or(z.undefined()) }),
  z.object({ role: z.literal("TEACHER"), ...baseFields, ...teacherFields, password: passwordSchema.optional() }),
  z.object({ role: z.literal("STUDENT"), ...baseFields, ...studentFields, password: passwordSchema.optional() }),
  z.object({ role: z.literal("PARENT"), ...baseFields, password: passwordSchema.optional() }),
]);
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  id: z.uuid(),
  ...baseFields,
  ...studentFields,
  ...teacherFields,
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userIdSchema = z.object({ id: z.uuid() });

export const setStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["ACTIVE", "LOCKED", "DISABLED"]),
});

export const linkSchema = z.object({
  parentUserId: z.uuid(),
  studentUserId: z.uuid(),
  relationship: z.enum(["FATHER", "MOTHER", "GUARDIAN", "OTHER"]).default("OTHER"),
});

export const unlinkSchema = z.object({ parentUserId: z.uuid(), studentUserId: z.uuid() });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Mật khẩu nhập lại không khớp." })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Mật khẩu mới phải khác mật khẩu cũ." });

export const userListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT", "PARENT"]).optional().catch(undefined),
  status: z.enum(["ACTIVE", "LOCKED", "DISABLED"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;
