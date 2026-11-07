import { saveAnswers } from "@/features/assignments/attempt";
import { saveAnswersSchema } from "@/features/assignments/schemas";
import { getCurrentUser } from "@/server/auth/current-user";
import { AppError } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Autosave for the attempt screen. A route handler (not a Server Action) so the browser can send the
 * last answers with `fetch(..., { keepalive: true })` when the page is closed or hidden.
 *   PUT /api/submissions/:id/answers   { version, answers: { [questionId]: answer } }
 * 200 { version, savedAt } · 409 { reason: "version", version } (another tab/device) · 409 { reason: "closed" }
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/submissions/[id]/answers">) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || new URL(origin).host !== host) return json(403, { error: { code: "FORBIDDEN" } });
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return json(401, { error: { code: "UNAUTHENTICATED", message: "Phiên đăng nhập đã hết hạn." } });
  if (user.role !== "STUDENT") return json(403, { error: { code: "FORBIDDEN" } });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = saveAnswersSchema.safeParse({ ...(body ?? {}), submissionId: id });
  if (!parsed.success) return json(422, { error: { code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ." } });
  try {
    const r = await saveAnswers(user, parsed.data);
    return r.ok ? json(200, { version: r.version, savedAt: r.savedAt }) : json(r.status, { reason: r.reason, version: "version" in r ? r.version : undefined });
  } catch (e) {
    if (e instanceof AppError) return json(e.code === "NOT_FOUND" ? 404 : 422, { error: { code: e.code, message: e.message } });
    console.error("[autosave]", e);
    return json(500, { error: { code: "INTERNAL", message: "Không lưu được. Đang thử lại…" } });
  }
}
