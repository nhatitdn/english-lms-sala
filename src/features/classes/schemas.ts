import { z } from "zod";

const LEVELS = ["STARTER", "BEGINNER", "ELEMENTARY", "PRE_INTERMEDIATE", "INTERMEDIATE", "UPPER_INTERMEDIATE", "ADVANCED"] as const;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
const optionalInt = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
    .pipe(z.number().int().min(min).max(max).optional());

export const classSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/, "Mã lớp gồm chữ in hoa, số và dấu gạch ngang, 2–20 ký tự (VD: STA-2611)."),
    name: z.string().trim().min(2, "Vui lòng nhập tên lớp.").max(100),
    description: optionalText(2000),
    level: z.enum(LEVELS, { message: "Vui lòng chọn trình độ." }),
    ageMin: optionalInt(3, 99),
    ageMax: optionalInt(3, 99),
    startDate: z.iso.date("Vui lòng chọn ngày bắt đầu."),
    endDate: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .pipe(z.iso.date().optional()),
    status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"]).default("PLANNED"),
    maxStudents: optionalInt(1, 500),
    location: optionalText(200),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "Ngày kết thúc phải sau ngày bắt đầu." })
  .refine((v) => !v.ageMin || !v.ageMax || v.ageMax >= v.ageMin, { path: ["ageMax"], message: "Độ tuổi không hợp lệ." });
export type ClassInput = z.infer<typeof classSchema>;

export const updateClassSchema = z.intersection(z.object({ id: z.uuid() }), classSchema);

const uuidList = z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(z.uuid()));

export const classIdSchema = z.object({ classId: z.uuid() });
export const teacherAssignSchema = z.object({ classId: z.uuid(), teacherUserId: z.uuid(), role: z.enum(["MAIN", "ASSISTANT"]).default("MAIN") });
export const teacherRemoveSchema = z.object({ classId: z.uuid(), teacherUserId: z.uuid() });
export const addStudentsSchema = z.object({ classId: z.uuid(), studentIds: uuidList.pipe(z.array(z.uuid()).min(1, "Chọn ít nhất một học viên.")) });
export const removeStudentSchema = z.object({ classId: z.uuid(), studentId: z.uuid(), note: optionalText(300) });
export const transferSchema = z.object({ fromClassId: z.uuid(), toClassId: z.uuid(), studentId: z.uuid(), note: optionalText(300) });

export const groupSchema = z.object({ classId: z.uuid(), name: z.string().trim().min(1, "Nhập tên nhóm.").max(60) });
export const groupMembersSchema = z.object({ classId: z.uuid(), groupId: z.uuid(), studentIds: uuidList });
export const groupDeleteSchema = z.object({ classId: z.uuid(), groupId: z.uuid() });

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ không hợp lệ (HH:MM).");
export const scheduleSchema = z
  .object({
    classId: z.uuid(),
    scheduleId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
    weekday: z.coerce.number().int().min(1).max(7),
    startTime: timeSchema,
    endTime: timeSchema,
    location: optionalText(200),
  })
  .refine((v) => v.endTime > v.startTime, { path: ["endTime"], message: "Giờ kết thúc phải sau giờ bắt đầu." });
export const scheduleDeleteSchema = z.object({ classId: z.uuid(), scheduleId: z.uuid() });

export const csvImportSchema = z.object({
  classId: z.uuid(),
  csv: z.string().trim().min(1, "Dán danh sách học viên.").max(100_000),
});

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Thứ Hai",
  2: "Thứ Ba",
  3: "Thứ Tư",
  4: "Thứ Năm",
  5: "Thứ Sáu",
  6: "Thứ Bảy",
  7: "Chủ Nhật",
};
