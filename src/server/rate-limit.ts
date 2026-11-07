import "server-only";
import { db } from "./db";

export type RateLimitResult = { allowed: boolean; count: number; retryAfterSec: number };

/**
 * Fixed-window counter stored in Postgres (enough for a single app instance; see ARCHITECTURE §4.2).
 * Atomic: one UPSERT per call.
 */
export async function consumeRateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; window_start: Date }[]>`
    INSERT INTO rate_limit_buckets (key, count, window_start)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit_buckets.window_start < now() - make_interval(secs => ${windowSec}::int)
                   THEN 1 ELSE rate_limit_buckets.count + 1 END,
      window_start = CASE WHEN rate_limit_buckets.window_start < now() - make_interval(secs => ${windowSec}::int)
                   THEN now() ELSE rate_limit_buckets.window_start END
    RETURNING count, window_start`;
  const row = rows[0]!;
  const elapsed = (Date.now() - new Date(row.window_start).getTime()) / 1000;
  return {
    allowed: row.count <= limit,
    count: row.count,
    retryAfterSec: Math.max(0, Math.ceil(windowSec - elapsed)),
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  await db.rateLimitBucket.deleteMany({ where: { key } });
}
