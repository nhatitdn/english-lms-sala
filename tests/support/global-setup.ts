/**
 * Recreate the test database schema from the committed migrations (plain SQL),
 * so tests always run against exactly what `prisma migrate deploy` produces.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://sala:sala_dev_password@localhost:5432/sala_test";
  if (!/test/.test(url)) throw new Error(`Refusing to reset a database whose URL does not contain "test": ${url}`);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    const dir = join(process.cwd(), "prisma", "migrations");
    for (const name of readdirSync(dir).filter((n) => /^\d+_/.test(n)).sort()) {
      await client.query(readFileSync(join(dir, name, "migration.sql"), "utf8"));
    }
  } finally {
    await client.end();
  }
}
