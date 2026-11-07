import { test as base } from "@playwright/test";
import { Client } from "pg";

/**
 * Login is rate-limited per IP (20 / 15 min). E2E runs log in far more often from one IP,
 * so each test starts with empty rate-limit counters. Only runs against a local/dev database.
 */
export const test = base.extend<{ resetRateLimits: void }>({
  resetRateLimits: [
    async ({}, use) => {
      const url = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
      if (url && /localhost|127\.0\.0\.1/.test(url)) {
        const client = new Client({ connectionString: url });
        await client.connect();
        await client.query("DELETE FROM rate_limit_buckets");
        await client.query("UPDATE users SET failed_login_count = 0, locked_until = NULL");
        await client.end();
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
