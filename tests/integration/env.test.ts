import { afterEach, describe, expect, it, vi } from "vitest";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  vi.resetModules();
});

describe("env()", () => {
  it('treats KEY="" as not set (CRON_SECRET is empty in .env.example until Phase 4)', async () => {
    process.env.CRON_SECRET = "";
    process.env.CLIENT_IP_HEADER = "";
    const { env } = await import("@/server/env");
    expect(env().CRON_SECRET).toBeUndefined();
    expect(env().CLIENT_IP_HEADER).toBe("x-forwarded-for");
  });

  it("still rejects a CRON_SECRET that is set but too short", async () => {
    process.env.CRON_SECRET = "short";
    const { env } = await import("@/server/env");
    expect(() => env()).toThrow(/CRON_SECRET/);
  });
});
