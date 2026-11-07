import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://sala:sala_dev_password@localhost:5432/sala_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts", "src/**/*.test.ts"],
    globalSetup: ["./tests/support/global-setup.ts"],
    setupFiles: ["./tests/support/setup.ts"],
    fileParallelism: false, // one shared test database
    testTimeout: 20_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_SECRET: "test-secret-test-secret-test-secret-123",
      CLIENT_IP_HEADER: "x-forwarded-for",
      NODE_ENV: "test",
      UPLOAD_DIR: "/tmp/sala-test-uploads",
    },
  },
});
