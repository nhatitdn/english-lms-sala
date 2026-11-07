import { describe, expect, it } from "vitest";
import { authenticate, IP_LOGIN_LIMIT, MAX_FAILED_LOGINS } from "@/server/auth/login";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { makeUser, TEST_PASSWORD } from "../support/factories";

describe("password hashing", () => {
  it("stores an Argon2id hash, never the plain password", async () => {
    const hash = await hashPassword("my-secret-pass");
    expect(hash).not.toContain("my-secret-pass");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "my-secret-pass")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  it("users created through the app never keep plain passwords", async () => {
    const u = await makeUser("STUDENT");
    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.passwordHash).not.toBe(TEST_PASSWORD);
    expect(row.passwordHash.startsWith("$argon2id$")).toBe(true);
  });
});

describe("authenticate()", () => {
  it("accepts the right password, case-insensitive username, and resets the failure counter", async () => {
    const u = await makeUser("STUDENT", { username: "minhanh" });
    await db.user.update({ where: { id: u.id }, data: { failedLoginCount: 3 } });
    const r = await authenticate("MinhAnh", TEST_PASSWORD, "10.0.0.1");
    expect(r).toMatchObject({ ok: true, user: { id: u.id, role: "STUDENT" } });
    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.failedLoginCount).toBe(0);
    expect(row.lastLoginAt).not.toBeNull();
  });

  it("accepts login by email", async () => {
    const u = await makeUser("PARENT");
    await db.user.update({ where: { id: u.id }, data: { email: "me@example.com" } });
    expect((await authenticate("ME@example.com", TEST_PASSWORD, null)).ok).toBe(true);
  });

  it("rejects unknown users and wrong passwords with the same generic code", async () => {
    await makeUser("STUDENT", { username: "real" });
    expect(await authenticate("ghost", TEST_PASSWORD, null)).toEqual({ ok: false, code: "invalid" });
    expect(await authenticate("real", "nope", null)).toEqual({ ok: false, code: "invalid" });
  });

  it(`locks the account after ${MAX_FAILED_LOGINS} wrong passwords, even for the right password afterwards`, async () => {
    await makeUser("STUDENT", { username: "victim" });
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      expect((await authenticate("victim", "bad", null)).ok).toBe(false);
    }
    expect(await authenticate("victim", "bad", null)).toEqual({ ok: false, code: "locked" });
    expect(await authenticate("victim", TEST_PASSWORD, null)).toEqual({ ok: false, code: "locked" });
    const logs = await db.activityLog.count({ where: { action: "auth.account_locked" } });
    expect(logs).toBe(1);
  });

  it("rejects disabled and admin-locked accounts", async () => {
    const a = await makeUser("STUDENT", { username: "disabled1" });
    const b = await makeUser("STUDENT", { username: "locked1" });
    await db.user.update({ where: { id: a.id }, data: { status: "DISABLED" } });
    await db.user.update({ where: { id: b.id }, data: { status: "LOCKED" } });
    expect(await authenticate("disabled1", TEST_PASSWORD, null)).toEqual({ ok: false, code: "disabled" });
    expect(await authenticate("locked1", TEST_PASSWORD, null)).toEqual({ ok: false, code: "locked" });
  });

  it("rejects soft-deleted accounts", async () => {
    const u = await makeUser("STUDENT", { username: "gone" });
    await db.user.update({ where: { id: u.id }, data: { deletedAt: new Date() } });
    expect((await authenticate("gone", TEST_PASSWORD, null)).ok).toBe(false);
  });

  it(`rate-limits a single IP after ${IP_LOGIN_LIMIT} attempts`, async () => {
    await makeUser("STUDENT", { username: "someone" });
    for (let i = 0; i < IP_LOGIN_LIMIT; i++) await authenticate(`nobody${i}`, "x", "203.0.113.9");
    expect(await authenticate("someone", TEST_PASSWORD, "203.0.113.9")).toEqual({ ok: false, code: "rate_limited" });
    // another IP is unaffected
    expect((await authenticate("someone", TEST_PASSWORD, "203.0.113.10")).ok).toBe(true);
  });
});
