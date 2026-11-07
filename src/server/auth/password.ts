// No "server-only" marker: also used by CLI scripts (create-admin, seed). Native module, never bundled to the client.
import { hash, verify } from "@node-rs/argon2";
import { randomInt } from "node:crypto";

// OWASP recommended Argon2id parameters (m=19 MiB, t=2, p=1). Algorithm 2 = Argon2id.
const OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

import { PASSWORD_MIN_LENGTH } from "../../lib/constants";
export { PASSWORD_MIN_LENGTH };

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

/** A dummy hash used to keep login timing similar when the username does not exist. */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("timing-safe-dummy-password");
  return dummyHash;
}

/**
 * Temporary password that is easy to read aloud / type on a phone:
 * no ambiguous characters (0/O, 1/l/I). Example: "hoa-7k4m-92".
 */
export function generateTempPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string, n: number) => Array.from({ length: n }, () => set[randomInt(set.length)]).join("");
  const words = ["sala", "hoa", "sao", "nang", "may", "gio", "bien", "song"];
  return `${words[randomInt(words.length)]}-${pick(letters + digits, 4)}-${pick(digits, 2)}`;
}
