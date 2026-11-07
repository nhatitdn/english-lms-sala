import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // Force UTC for the DB session: Prisma's pg adapter sends timestamps without an offset,
  // so a non-UTC server/session timezone would shift every stored time.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, options: "-c TimeZone=UTC" });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/** Single Prisma client per process (re-used across hot reloads in dev). */
export const db: PrismaClient = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Filter for soft-deleted rows. Every query on a soft-delete table must include it. */
export const notDeleted = { deletedAt: null } as const;
