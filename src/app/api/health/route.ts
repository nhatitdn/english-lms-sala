import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Liveness + DB check for Docker healthcheck / uptime monitors. No sensitive data. */
export async function GET() {
  let database = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }
  const ok = database === "ok";
  return Response.json(
    { status: ok ? "ok" : "degraded", database, time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
