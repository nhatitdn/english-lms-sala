import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { StoredQuestion } from "./questions";

type Client = Prisma.TransactionClient | typeof db;

/** Load an assignment's questions in display order, as the pure grader/sanitizer expects them. */
export async function loadQuestions(assignmentId: string, client: Client = db): Promise<StoredQuestion[]> {
  const rows = await client.question.findMany({
    where: { assignmentId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { options: { orderBy: { sortOrder: "asc" } }, media: { select: { kind: true, deletedAt: true } } },
  });
  return rows.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    points: Number(q.points),
    mediaFileId: q.media && !q.media.deletedAt ? q.mediaFileId : null,
    mediaKind: q.media && !q.media.deletedAt ? q.media.kind : null,
    config: (q.config ?? {}) as Record<string, unknown>,
    explanation: q.explanation,
    sortOrder: q.sortOrder,
    options: q.options.map((o) => ({
      id: o.id,
      content: o.content,
      isCorrect: o.isCorrect,
      matchSide: o.matchSide,
      matchKey: o.matchKey,
      correctPosition: o.correctPosition,
      sortOrder: o.sortOrder,
    })),
  }));
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Raw points → the assignment's scale (e.g. 7.5 of 15 points on a 10-point scale = 5). */
export function scaleScore(earned: number, totalPoints: number, maxScore: number): number {
  if (totalPoints <= 0) return 0;
  return round2(Math.min(maxScore, Math.max(0, (earned / totalPoints) * maxScore)));
}
