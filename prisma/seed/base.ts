/**
 * Base seed — safe for every environment (including production).
 * Only inserts default system settings that do not exist yet; never overwrites admin changes.
 */
import { DEFAULT_SETTINGS } from "../../src/server/settings-defaults";
import { createScriptClient } from "./client";

async function main() {
  const db = createScriptClient();
  try {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = await db.systemSetting.findUnique({ where: { key } });
      if (!existing) {
        await db.systemSetting.create({ data: { key, value } });
        console.log(`  + setting ${key}`);
      }
    }
    console.log("Base seed done.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
