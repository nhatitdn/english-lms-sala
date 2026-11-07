import { z } from "zod";
import { getCurrentUser } from "@/server/auth/current-user";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { consumeRateLimit } from "@/server/rate-limit";
import { PURPOSE_KINDS } from "@/server/storage/rules";
import { storeUpload } from "@/server/storage/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  purpose: z.enum(Object.keys(PURPOSE_KINDS) as [keyof typeof PURPOSE_KINDS, ...(keyof typeof PURPOSE_KINDS)[]]),
  name: z.string().min(1).max(255),
});

const UPLOADS_PER_HOUR = 120;

function json(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Raw-body upload (streamed to disk, not buffered in memory):
 *   POST /api/uploads?purpose=material&name=<file name>   body = file bytes
 * Returns { id, kind, originalName, sizeBytes }. Never returns a storage path.
 */
export async function POST(request: Request) {
  // CSRF: only same-origin browsers may upload
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || new URL(origin).host !== host) return json(403, { error: { code: "FORBIDDEN", message: "Yêu cầu không hợp lệ." } });

  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return json(401, { error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập lại." } });
  // Phase 2: only staff upload teaching material (student uploads arrive with assignments in Phase 3)
  if (user.role !== "ADMIN" && user.role !== "TEACHER") return json(403, { error: { code: "FORBIDDEN", message: "Bạn không có quyền tải file lên." } });

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ purpose: url.searchParams.get("purpose"), name: url.searchParams.get("name") });
  if (!parsed.success || !request.body) return json(422, { error: { code: "VALIDATION_ERROR", message: "Thiếu thông tin file." } });

  const limit = await consumeRateLimit(`upload:user:${user.id}`, UPLOADS_PER_HOUR, 3600);
  if (!limit.allowed) return json(429, { error: { code: "RATE_LIMITED", message: "Bạn tải lên quá nhiều file. Vui lòng thử lại sau." } });

  try {
    const declared = Number(request.headers.get("content-length") ?? 0) || undefined;
    const file = await storeUpload({ body: request.body, originalName: parsed.data.name, purpose: parsed.data.purpose, uploadedBy: user.id, declaredSize: declared });
    await audit({ actorId: user.id, action: "file.upload", entityType: "file", entityId: file.id, metadata: { kind: file.kind, size: file.sizeBytes } });
    return json(201, file);
  } catch (e) {
    if (e instanceof AppError) {
      const status = e.message.startsWith("File quá lớn") ? 413 : e.message.includes("không được phép") ? 415 : 422;
      return json(status, { error: { code: e.code, message: e.message } });
    }
    console.error("[upload]", e);
    return json(500, { error: { code: "INTERNAL", message: "Tải lên thất bại. Vui lòng thử lại." } });
  }
}
