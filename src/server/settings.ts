import "server-only";
import { cache } from "react";
import { db } from "./db";
import { DEFAULT_SETTINGS, type SettingKey } from "./settings-defaults";

type SettingValue<K extends SettingKey> = (typeof DEFAULT_SETTINGS)[K];

/** Read a system setting (DB value merged over defaults). Memoised per request. */
export const getSetting = cache(async <K extends SettingKey>(key: K): Promise<SettingValue<K>> => {
  const row = await db.systemSetting.findUnique({ where: { key } });
  const value = row?.value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...DEFAULT_SETTINGS[key], ...(value as object) } as SettingValue<K>;
  }
  return DEFAULT_SETTINGS[key];
});
