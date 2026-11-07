import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a running app whose database contains the demo seed:
 *   SEED_DEMO=true npm run db:seed:demo && npm run build && npm run test:e2e
 * Set E2E_BASE_URL to test another server; set E2E_CHROME_PATH to use a system Chrome.
 */
const chromePath = process.env.E2E_CHROME_PATH;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    ...(chromePath ? { launchOptions: { executablePath: chromePath } } : {}),
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], ...(chromePath ? { launchOptions: { executablePath: chromePath } } : {}) } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 }, ...(chromePath ? { launchOptions: { executablePath: chromePath } } : {}) } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run start", url: "http://localhost:3000/api/health", reuseExistingServer: true, timeout: 120_000 },
});
