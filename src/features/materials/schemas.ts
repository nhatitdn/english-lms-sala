import { z } from "zod";

const SKILLS = ["VOCABULARY", "GRAMMAR", "LISTENING", "SPEAKING", "READING", "WRITING", "PRONUNCIATION", "GENERAL"] as const;

export const tagsSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    const list = Array.isArray(v) ? v : (v ?? "").split(",");
    return [...new Set(list.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12).map((t) => t.slice(0, 40));
  });

export const skillSchema = z
  .enum(SKILLS)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const materialFromFileSchema = z.object({
  fileId: z.uuid(),
  title: z.string().trim().max(200).optional(),
  skill: skillSchema,
  tags: tagsSchema,
});

export const materialLinkSchema = z.object({
  url: z.url({ protocol: /^https?$/, message: "Link phải bắt đầu bằng http:// hoặc https://" }).max(2000),
  title: z.string().trim().min(1, "Nhập tiêu đề.").max(200),
  skill: skillSchema,
  tags: tagsSchema,
});

export const materialUpdateSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Nhập tiêu đề.").max(200),
  description: z.string().trim().max(2000).optional(),
  skill: skillSchema,
  tags: tagsSchema,
  sharedWithTeachers: z.union([z.literal("on"), z.literal("true"), z.boolean()]).optional().transform((v) => v === true || v === "on" || v === "true"),
});

export const materialListSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  skill: z.enum(SKILLS).optional().catch(undefined),
  type: z.enum(["DOCUMENT", "AUDIO", "VIDEO", "IMAGE", "YOUTUBE", "LINK"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
});
export type MaterialListQuery = z.infer<typeof materialListSchema>;
