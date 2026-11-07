import { saveAudioProgress, progressSchema } from "@/features/audio/progress";
import { getCurrentUser } from "@/server/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Called by the audio player every ~10 s, on pause and when the page is hidden (keepalive). */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || new URL(origin).host !== host) return new Response(null, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const parsed = progressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 422 });
  const result = await saveAudioProgress(user, parsed.data);
  if (!result.ok) return new Response(null, { status: result.status });
  return Response.json(result.progress, { headers: { "Cache-Control": "no-store" } });
}
