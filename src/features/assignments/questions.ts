/**
 * Question model shared by the builder (teacher), the attempt screen (student) and the grader.
 * Pure functions only — imported by server and client code and unit-tested.
 *
 * Storage: `questions.prompt` (rich text), `questions.config` (type-specific JSON) and
 * `question_options` rows (choices, matching pairs, ordering items) — see docs/DATABASE.md.
 */
import { z } from "zod";
import type { QuestionType } from "@/generated/prisma/enums";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Trắc nghiệm (1 đáp án)",
  MULTIPLE_SELECT: "Trắc nghiệm (nhiều đáp án)",
  TRUE_FALSE: "Đúng / Sai",
  FILL_BLANK: "Điền vào chỗ trống",
  MATCHING: "Nối cặp",
  ORDERING: "Sắp xếp câu / từ",
  SHORT_ANSWER: "Trả lời ngắn",
  WRITING: "Viết đoạn văn",
  SPEAKING: "Nói (ghi âm)",
  FILE_UPLOAD: "Nộp file / ảnh",
};

export const AUTO_GRADED: QuestionType[] = ["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE", "FILL_BLANK", "MATCHING", "ORDERING"];

// ───────────────────────── Builder (teacher) model ─────────────────────────

const text = (max: number, msg = "Không được để trống.") => z.string().trim().min(1, msg).max(max);
const base = {
  id: z.uuid().optional(),
  prompt: z.string().trim().max(5000).default(""),
  points: z.coerce.number().min(0, "Điểm không âm.").max(100).default(1),
  mediaFileId: z.uuid().nullish(),
  explanation: z.string().trim().max(2000).optional(),
};
const choice = z.object({ text: text(500, "Nhập nội dung lựa chọn."), correct: z.boolean() });

export const questionDraftSchema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("MULTIPLE_CHOICE"), ...base, options: z.array(choice).min(2, "Cần ít nhất 2 lựa chọn.").max(8) })
    .refine((q) => q.options.filter((o) => o.correct).length === 1, { path: ["options"], message: "Chọn đúng 1 đáp án đúng." }),
  z
    .object({ type: z.literal("MULTIPLE_SELECT"), ...base, options: z.array(choice).min(2).max(10), scoring: z.enum(["ALL_OR_NOTHING", "PARTIAL"]).default("PARTIAL") })
    .refine((q) => q.options.some((o) => o.correct), { path: ["options"], message: "Chọn ít nhất 1 đáp án đúng." }),
  z.object({ type: z.literal("TRUE_FALSE"), ...base, correct: z.boolean() }),
  z
    .object({ type: z.literal("FILL_BLANK"), ...base, text: text(3000, "Nhập câu có chỗ trống."), caseSensitive: z.boolean().default(false) })
    .refine((q) => parseFillTemplate(q.text).blanks.length > 0, { path: ["text"], message: "Đánh dấu chỗ trống bằng [[đáp án]], VD: She [[goes]] to school." }),
  z.object({ type: z.literal("MATCHING"), ...base, pairs: z.array(z.object({ left: text(300), right: text(300) })).min(2, "Cần ít nhất 2 cặp.").max(12) }),
  z.object({ type: z.literal("ORDERING"), ...base, items: z.array(text(300)).min(2, "Cần ít nhất 2 phần.").max(15) }),
  z.object({ type: z.literal("SHORT_ANSWER"), ...base, acceptedAnswers: z.array(z.string().trim().min(1).max(300)).max(10).default([]) }),
  z.object({ type: z.literal("WRITING"), ...base, minWords: z.coerce.number().int().min(0).max(5000).optional(), maxWords: z.coerce.number().int().min(0).max(5000).optional() }),
  z.object({ type: z.literal("SPEAKING"), ...base, maxDurationSec: z.coerce.number().int().min(10).max(600).default(120) }),
  z.object({ type: z.literal("FILE_UPLOAD"), ...base, maxFiles: z.coerce.number().int().min(1).max(10).default(3), allow: z.array(z.enum(["IMAGE", "DOCUMENT"])).min(1).default(["IMAGE", "DOCUMENT"]) }),
]);
export type QuestionDraft = z.infer<typeof questionDraftSchema>;

/** "She [[goes|is going]] to school." → segments + blanks with accepted answers. */
export function parseFillTemplate(template: string): { segments: (string | { blank: number })[]; blanks: { id: number; accepted: string[] }[] } {
  const segments: (string | { blank: number })[] = [];
  const blanks: { id: number; accepted: string[] }[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) {
    if (m.index > last) segments.push(template.slice(last, m.index));
    const accepted = m[1]!.split("|").map((s) => s.trim()).filter(Boolean);
    if (accepted.length) {
      const id = blanks.length;
      blanks.push({ id, accepted });
      segments.push({ blank: id });
    }
    last = m.index + m[0].length;
  }
  if (last < template.length) segments.push(template.slice(last));
  return { segments, blanks };
}

// ───────────────────────── Stored shape ─────────────────────────

export type StoredOption = {
  id: string;
  content: unknown; // { text }
  isCorrect: boolean;
  matchSide: "LEFT" | "RIGHT" | null;
  matchKey: string | null;
  correctPosition: number | null;
  sortOrder: number;
};
export type StoredQuestion = {
  id: string;
  type: QuestionType;
  prompt: unknown;
  points: number;
  mediaFileId: string | null;
  mediaKind?: string | null;
  config: Record<string, unknown>;
  explanation: unknown;
  sortOrder: number;
  options: StoredOption[];
};

export const optionText = (o: { content: unknown }): string =>
  o.content && typeof o.content === "object" && "text" in (o.content as object) ? String((o.content as { text: unknown }).text ?? "") : "";

/** Draft → rows for questions.config + question_options (ids are created by the DB). */
export function draftToStorage(d: QuestionDraft): {
  config: Record<string, unknown>;
  options: { content: { text: string }; isCorrect: boolean; matchSide: "LEFT" | "RIGHT" | null; matchKey: string | null; correctPosition: number | null; sortOrder: number }[];
} {
  const opt = (t: string, i: number, extra: Partial<{ isCorrect: boolean; matchSide: "LEFT" | "RIGHT"; matchKey: string; correctPosition: number }> = {}) => ({
    content: { text: t },
    isCorrect: extra.isCorrect ?? false,
    matchSide: extra.matchSide ?? null,
    matchKey: extra.matchKey ?? null,
    correctPosition: extra.correctPosition ?? null,
    sortOrder: i,
  });
  switch (d.type) {
    case "MULTIPLE_CHOICE":
      return { config: {}, options: d.options.map((o, i) => opt(o.text, i, { isCorrect: o.correct })) };
    case "MULTIPLE_SELECT":
      return { config: { scoring: d.scoring }, options: d.options.map((o, i) => opt(o.text, i, { isCorrect: o.correct })) };
    case "TRUE_FALSE":
      return { config: {}, options: [opt("True", 0, { isCorrect: d.correct }), opt("False", 1, { isCorrect: !d.correct })] };
    case "FILL_BLANK": {
      const { blanks } = parseFillTemplate(d.text);
      return { config: { template: d.text, blanks, caseSensitive: d.caseSensitive }, options: [] };
    }
    case "MATCHING":
      return {
        config: {},
        options: d.pairs.flatMap((p, i) => [opt(p.left, i, { matchSide: "LEFT", matchKey: String(i) }), opt(p.right, i, { matchSide: "RIGHT", matchKey: String(i) })]),
      };
    case "ORDERING":
      return { config: {}, options: d.items.map((t, i) => opt(t, i, { correctPosition: i })) };
    case "SHORT_ANSWER":
      return { config: { acceptedAnswers: d.acceptedAnswers }, options: [] };
    case "WRITING":
      return { config: { minWords: d.minWords ?? null, maxWords: d.maxWords ?? null }, options: [] };
    case "SPEAKING":
      return { config: { maxDurationSec: d.maxDurationSec }, options: [] };
    case "FILE_UPLOAD":
      return { config: { maxFiles: d.maxFiles, allow: d.allow }, options: [] };
  }
}

/** Prompts/explanations are stored as `{ text }` JSON (plain text, rendered with line breaks). */
export const jsonText = (v: unknown): string => optionText({ content: v });

/** Stored question → draft (builder re-opens it). */
export function storageToDraft(q: StoredQuestion): QuestionDraft {
  const b = { id: q.id, prompt: jsonText(q.prompt), points: q.points, mediaFileId: q.mediaFileId, explanation: jsonText(q.explanation) || undefined };
  const opts = [...q.options].sort((a, z2) => a.sortOrder - z2.sortOrder);
  const c = q.config;
  switch (q.type) {
    case "MULTIPLE_CHOICE":
      return { ...b, type: q.type, options: opts.map((o) => ({ text: optionText(o), correct: o.isCorrect })) };
    case "MULTIPLE_SELECT":
      return { ...b, type: q.type, options: opts.map((o) => ({ text: optionText(o), correct: o.isCorrect })), scoring: c.scoring === "ALL_OR_NOTHING" ? "ALL_OR_NOTHING" : "PARTIAL" };
    case "TRUE_FALSE":
      return { ...b, type: q.type, correct: opts.find((o) => optionText(o) === "True")?.isCorrect ?? true };
    case "FILL_BLANK":
      return { ...b, type: q.type, text: String(c.template ?? ""), caseSensitive: !!c.caseSensitive };
    case "MATCHING": {
      const lefts = opts.filter((o) => o.matchSide === "LEFT");
      return { ...b, type: q.type, pairs: lefts.map((l) => ({ left: optionText(l), right: optionText(opts.find((r) => r.matchSide === "RIGHT" && r.matchKey === l.matchKey) ?? { content: null }) })) };
    }
    case "ORDERING":
      return { ...b, type: q.type, items: [...opts].sort((a, z2) => (a.correctPosition ?? 0) - (z2.correctPosition ?? 0)).map(optionText) };
    case "SHORT_ANSWER":
      return { ...b, type: q.type, acceptedAnswers: Array.isArray(c.acceptedAnswers) ? (c.acceptedAnswers as string[]) : [] };
    case "WRITING":
      return { ...b, type: q.type, minWords: (c.minWords as number) ?? undefined, maxWords: (c.maxWords as number) ?? undefined };
    case "SPEAKING":
      return { ...b, type: q.type, maxDurationSec: Number(c.maxDurationSec ?? 120) };
    case "FILE_UPLOAD":
      return { ...b, type: q.type, maxFiles: Number(c.maxFiles ?? 3), allow: (c.allow as ("IMAGE" | "DOCUMENT")[]) ?? ["IMAGE", "DOCUMENT"] };
  }
}

// ───────────────────────── Student view (no answers!) ─────────────────────────

export type StudentQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  mediaFileId: string | null;
  mediaKind?: string | null;
  options?: { id: string; text: string }[];
  segments?: (string | { blank: number })[];
  blankCount?: number;
  left?: { id: string; text: string }[];
  right?: { id: string; text: string }[];
  items?: { id: string; text: string }[];
  minWords?: number | null;
  maxWords?: number | null;
  maxDurationSec?: number;
  maxFiles?: number;
  allow?: ("IMAGE" | "DOCUMENT")[];
};

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministic shuffle (same order every time the same student reopens the same attempt). */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const out = [...items];
  let s = hash(seed) || 1;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The only shape that leaves the server while a student works. It contains no `isCorrect`,
 * `matchKey`, `correctPosition`, accepted answers or explanations.
 */
export function toStudentQuestion(q: StoredQuestion, seed: string, shuffleOptions: boolean): StudentQuestion {
  const view: StudentQuestion = { id: q.id, type: q.type, prompt: jsonText(q.prompt), points: q.points, mediaFileId: q.mediaFileId, mediaKind: q.mediaKind ?? null };
  const opts = [...q.options].sort((a, b) => a.sortOrder - b.sortOrder);
  const plain = (o: StoredOption) => ({ id: o.id, text: optionText(o) });
  switch (q.type) {
    case "MULTIPLE_CHOICE":
    case "MULTIPLE_SELECT":
      view.options = (shuffleOptions ? seededShuffle(opts, `${seed}:${q.id}`) : opts).map(plain);
      break;
    case "TRUE_FALSE":
      view.options = opts.map((o) => ({ id: o.id, text: optionText(o) === "True" ? "Đúng (True)" : "Sai (False)" }));
      break;
    case "FILL_BLANK": {
      const parsed = parseFillTemplate(String(q.config.template ?? ""));
      view.segments = parsed.segments;
      view.blankCount = parsed.blanks.length;
      break;
    }
    case "MATCHING":
      view.left = opts.filter((o) => o.matchSide === "LEFT").map(plain);
      view.right = seededShuffle(opts.filter((o) => o.matchSide === "RIGHT"), `${seed}:${q.id}:r`).map(plain);
      break;
    case "ORDERING": {
      let items = seededShuffle(opts, `${seed}:${q.id}`);
      // never show the items already in the right order
      if (items.length > 1 && items.every((o, i) => o.correctPosition === i)) items = [...items.slice(1), items[0]!];
      view.items = items.map(plain);
      break;
    }
    case "WRITING":
      view.minWords = (q.config.minWords as number) ?? null;
      view.maxWords = (q.config.maxWords as number) ?? null;
      break;
    case "SPEAKING":
      view.maxDurationSec = Number(q.config.maxDurationSec ?? 120);
      break;
    case "FILE_UPLOAD":
      view.maxFiles = Number(q.config.maxFiles ?? 3);
      view.allow = (q.config.allow as ("IMAGE" | "DOCUMENT")[]) ?? ["IMAGE", "DOCUMENT"];
      break;
  }
  return view;
}

// ───────────────────────── Answers ─────────────────────────

const id = z.uuid();
export const answerSchemas = {
  MULTIPLE_CHOICE: z.object({ optionId: id }),
  TRUE_FALSE: z.object({ optionId: id }),
  MULTIPLE_SELECT: z.object({ optionIds: z.array(id).max(20) }),
  FILL_BLANK: z.object({ blanks: z.record(z.string().regex(/^\d{1,2}$/), z.string().max(200)) }),
  MATCHING: z.object({ pairs: z.record(id, id) }),
  ORDERING: z.object({ order: z.array(id).max(30) }),
  SHORT_ANSWER: z.object({ text: z.string().max(2000) }),
  WRITING: z.object({ text: z.string().max(20_000) }),
  SPEAKING: z.object({ fileId: id }),
  FILE_UPLOAD: z.object({ fileIds: z.array(id).max(10) }),
} satisfies Record<QuestionType, z.ZodType>;

/** Validate an answer for its question type; invalid → null (stored as "no answer"). */
export function parseAnswer(type: QuestionType, raw: unknown): unknown | null {
  const r = answerSchemas[type].safeParse(raw);
  return r.success ? r.data : null;
}

export function isAnswered(type: QuestionType, answer: unknown): boolean {
  const a = parseAnswer(type, answer) as Record<string, unknown> | null;
  if (!a) return false;
  switch (type) {
    case "MULTIPLE_SELECT":
      return (a.optionIds as string[]).length > 0;
    case "FILL_BLANK":
      return Object.values(a.blanks as Record<string, string>).some((v) => v.trim() !== "");
    case "MATCHING":
      return Object.keys(a.pairs as object).length > 0;
    case "SHORT_ANSWER":
    case "WRITING":
      return (a.text as string).trim() !== "";
    case "FILE_UPLOAD":
      return (a.fileIds as string[]).length > 0;
    default:
      return true;
  }
}

export function countWords(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

// ───────────────────────── Auto-grading ─────────────────────────

/** Lenient comparison for typed answers: trims, collapses spaces, unifies quotes, ignores case and final punctuation. */
export function normalizeTyped(s: string, caseSensitive = false): string {
  const t = s
    .normalize("NFC")
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
  return caseSensitive ? t : t.toLowerCase();
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export type GradeOutcome = { auto: true; points: number; isCorrect: boolean } | { auto: false; points: null; isCorrect: null };
const MANUAL: GradeOutcome = { auto: false, points: null, isCorrect: null };

/** Grade one answer. Returns `auto: false` for question types (or answers) that need a teacher. */
export function gradeAnswer(q: StoredQuestion, raw: unknown): GradeOutcome {
  const full = q.points;
  const answer = parseAnswer(q.type, raw) as Record<string, unknown> | null;
  const result = (fraction: number): GradeOutcome => ({ auto: true, points: round2(full * Math.max(0, Math.min(1, fraction))), isCorrect: fraction >= 1 });
  switch (q.type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE": {
      const chosen = q.options.find((o) => o.id === answer?.optionId);
      return result(chosen?.isCorrect ? 1 : 0);
    }
    case "MULTIPLE_SELECT": {
      const picked = new Set((answer?.optionIds as string[] | undefined) ?? []);
      const correct = q.options.filter((o) => o.isCorrect);
      const right = correct.filter((o) => picked.has(o.id)).length;
      const wrong = q.options.filter((o) => !o.isCorrect && picked.has(o.id)).length;
      if (q.config.scoring === "ALL_OR_NOTHING") return result(right === correct.length && wrong === 0 ? 1 : 0);
      return result(correct.length ? (right - wrong) / correct.length : 0);
    }
    case "FILL_BLANK": {
      const blanks = (q.config.blanks as { id: number; accepted: string[] }[] | undefined) ?? [];
      const typed = (answer?.blanks as Record<string, string> | undefined) ?? {};
      const cs = !!q.config.caseSensitive;
      const ok = blanks.filter((b) => b.accepted.some((acc) => normalizeTyped(acc, cs) === normalizeTyped(typed[String(b.id)] ?? "", cs))).length;
      return result(blanks.length ? ok / blanks.length : 0);
    }
    case "MATCHING": {
      const lefts = q.options.filter((o) => o.matchSide === "LEFT");
      const pairs = (answer?.pairs as Record<string, string> | undefined) ?? {};
      const ok = lefts.filter((l) => q.options.find((r) => r.id === pairs[l.id])?.matchKey === l.matchKey && q.options.find((r) => r.id === pairs[l.id])?.matchSide === "RIGHT").length;
      return result(lefts.length ? ok / lefts.length : 0);
    }
    case "ORDERING": {
      const expected = [...q.options].sort((a, b) => (a.correctPosition ?? 0) - (b.correctPosition ?? 0)).map((o) => o.id);
      const given = (answer?.order as string[] | undefined) ?? [];
      return result(given.length === expected.length && given.every((g, i) => g === expected[i]) ? 1 : 0);
    }
    case "SHORT_ANSWER": {
      const accepted = (q.config.acceptedAnswers as string[] | undefined) ?? [];
      const typed = normalizeTyped(String(answer?.text ?? ""));
      if (accepted.length && typed && accepted.some((a) => normalizeTyped(a) === typed)) return result(1);
      return MANUAL; // teacher decides
    }
    default:
      return MANUAL;
  }
}

/** What the correct answer looks like, for the result screen once answers are released. */
export function correctAnswerText(q: StoredQuestion): string {
  const opts = [...q.options].sort((a, b) => a.sortOrder - b.sortOrder);
  switch (q.type) {
    case "MULTIPLE_CHOICE":
    case "MULTIPLE_SELECT":
      return opts.filter((o) => o.isCorrect).map(optionText).join(" · ");
    case "TRUE_FALSE":
      return opts.find((o) => o.isCorrect && optionText(o) === "True") ? "Đúng (True)" : "Sai (False)";
    case "FILL_BLANK":
      return ((q.config.blanks as { accepted: string[] }[]) ?? []).map((b, i) => `(${i + 1}) ${b.accepted.join(" / ")}`).join("  ");
    case "MATCHING":
      return opts
        .filter((o) => o.matchSide === "LEFT")
        .map((l) => `${optionText(l)} → ${optionText(opts.find((r) => r.matchSide === "RIGHT" && r.matchKey === l.matchKey) ?? { content: null })}`)
        .join(" · ");
    case "ORDERING":
      return [...opts].sort((a, b) => (a.correctPosition ?? 0) - (b.correctPosition ?? 0)).map(optionText).join(" ");
    case "SHORT_ANSWER":
      return ((q.config.acceptedAnswers as string[]) ?? []).join(" / ");
    default:
      return "";
  }
}
