import "server-only";
import { z } from "zod";
import type { CurrentUser } from "@/server/auth/current-user";
import { canViewLesson } from "@/server/authz/policies";
import { db } from "@/server/db";

export const progressSchema = z.object({
  audioLessonId: z.uuid(),
  positionSec: z.number().min(0).max(4 * 3600),
  /** seconds of audio actually played since the last report (client-measured) */
  listenedDeltaSec: z.number().min(0).max(600),
  durationSec: z.number().min(0).max(4 * 3600).optional(),
  started: z.boolean().optional(),
  ended: z.boolean().optional(),
});
export type ProgressInput = z.infer<typeof progressSchema>;

/**
 * Save a student's listening position and progress. Completion = listened ≥ threshold % of the
 * duration, or reached the end. Completion is sticky (re-listening never "uncompletes").
 */
export async function saveAudioProgress(user: CurrentUser, input: ProgressInput) {
  if (user.role !== "STUDENT" || !user.studentId) return { ok: false as const, status: 403 };
  const audio = await db.audioLesson.findUnique({
    where: { id: input.audioLessonId },
    select: { lessonId: true, completeThreshold: true, audioFileId: true, audioFile: { select: { durationSec: true } } },
  });
  if (!audio || !(await canViewLesson(user, audio.lessonId))) return { ok: false as const, status: 404 };

  const duration = audio.audioFile.durationSec ?? (input.durationSec ? Math.round(input.durationSec) : null);
  if (!audio.audioFile.durationSec && duration) {
    await db.file.update({ where: { id: audio.audioFileId }, data: { durationSec: duration } });
  }
  const delta = Math.min(input.listenedDeltaSec, 120); // a report covers at most a couple of minutes
  const key = { audioLessonId_studentId: { audioLessonId: input.audioLessonId, studentId: user.studentId } };
  const current = await db.audioProgress.findUnique({ where: key });
  const listened = (current?.listenedSec ?? 0) + Math.round(delta);
  const reachedThreshold = duration ? listened >= (duration * audio.completeThreshold) / 100 : false;
  const completedAt = current?.completedAt ?? (input.ended || reachedThreshold ? new Date() : null);
  const position = input.ended ? 0 : Math.round(input.positionSec);

  const saved = await db.audioProgress.upsert({
    where: key,
    create: { audioLessonId: input.audioLessonId, studentId: user.studentId, positionSec: position, listenedSec: listened, playCount: input.started ? 1 : 0, completedAt },
    update: { positionSec: position, listenedSec: listened, completedAt, ...(input.started ? { playCount: { increment: 1 } } : {}) },
    select: { positionSec: true, listenedSec: true, completedAt: true, playCount: true },
  });
  return { ok: true as const, progress: saved };
}
