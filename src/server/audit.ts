import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { requestMeta } from "./request";

export type AuditEntry = {
  actorId: string | null;
  action: string; // e.g. "user.create", "auth.login_failed"
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/** Write an activity log row. Never throws: auditing must not break the user's action. */
export async function audit(entry: AuditEntry, tx: Prisma.TransactionClient = db): Promise<void> {
  try {
    let meta: { ip: string | null; userAgent: string | null } = { ip: null, userAgent: null };
    try {
      meta = await requestMeta();
    } catch {
      // outside a request (scripts, tests)
    }
    await tx.activityLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write activity log", error);
  }
}
