import { z } from "zod";
import { skillSchema, tagsSchema } from "@/features/materials/schemas";

const SKILLS = ["VOCABULARY", "GRAMMAR", "LISTENING", "SPEAKING", "READING", "WRITING", "PRONUNCIATION", "GENERAL"] as const;

export const createLessonSchema = z.object({
  title: z.string().trim().min(2, "Nhập tiêu đề bài giảng.").max(200),
  skill: z.enum(SKILLS).default("GENERAL"),
  classId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
});

export const updateLessonSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(2, "Nhập tiêu đề bài giảng.").max(200),
  description: z.string().trim().max(500).optional().transform((v) => v || undefined),
  skill: z.enum(SKILLS),
  tags: tagsSchema,
  content: z.unknown(),
});

const uuidList = z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(z.uuid()));

export const lessonClassesSchema = z.object({
  lessonId: z.uuid(),
  classIds: uuidList,
  visibleFrom: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.iso.datetime({ offset: true, message: "Thời điểm không hợp lệ." }).optional()),
});

export const lessonIdSchema = z.object({ lessonId: z.uuid() });
export const attachSchema = z.object({ lessonId: z.uuid(), materialId: z.uuid() });
export const attachLinkSchema = z.object({
  lessonId: z.uuid(),
  url: z.url({ protocol: /^https?$/, message: "Link phải bắt đầu bằng http:// hoặc https://" }).max(2000),
  title: z.string().trim().min(1, "Nhập tiêu đề.").max(200),
});
export const attachFileSchema = z.object({ lessonId: z.uuid(), fileId: z.uuid() });

export const audioLessonSchema = z.object({
  lessonId: z.uuid(),
  audioLessonId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  title: z.string().trim().min(1, "Nhập tên bài nghe.").max(200),
  audioFileId: z.uuid({ message: "Hãy tải file âm thanh lên." }),
  coverFileId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  instructions: z.string().max(5000).optional(),
  transcript: z.string().max(50_000).optional(),
  transcriptMode: z.enum(["ALWAYS", "AFTER_COMPLETE", "AFTER_SUBMIT", "HIDDEN"]).default("AFTER_COMPLETE"),
  completeThreshold: z.coerce.number().int().min(10).max(100).default(90),
});

export const audioDeleteSchema = z.object({ lessonId: z.uuid(), audioLessonId: z.uuid() });

export const lessonListSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  skill: z.enum(SKILLS).optional().catch(undefined),
  scope: z.enum(["mine", "all"]).default("mine").catch("mine"),
});

export { skillSchema };
