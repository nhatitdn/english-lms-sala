import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  APP_URL: z.url().default("http://localhost:3000"),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  CRON_SECRET: z.string().min(24).optional(),
  /** Which header carries the real client IP: behind Nginx use x-forwarded-for, behind Cloudflare Tunnel use cf-connecting-ip. */
  CLIENT_IP_HEADER: z.enum(["none", "x-forwarded-for", "cf-connecting-ip", "x-real-ip"]).default("x-forwarded-for"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated environment. Throws at first use with a readable message when misconfigured. */
export function env(): Env {
  if (cached) return cached;
  // `KEY=""` in .env means "not set" (e.g. CRON_SECRET before Phase 4), not "set to an empty value"
  const values = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
