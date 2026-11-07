import "server-only";
import { headers } from "next/headers";
import { env } from "./env";

/** Read the client IP from the header configured for this deployment. */
export function clientIpFrom(h: Headers): string | null {
  const mode = env().CLIENT_IP_HEADER;
  if (mode === "none") return null;
  const raw = h.get(mode);
  if (!raw) return null;
  return raw.split(",")[0]!.trim() || null;
}

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  return { ip: clientIpFrom(h), userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}
