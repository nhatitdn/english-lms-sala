import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { CurrentUser } from "@/server/auth/current-user";

const state = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock("@/server/auth/current-user", () => ({ getCurrentUser: async () => state.user }));

const { createAction } = await import("@/server/action");

const user = (role: CurrentUser["role"], mustChangePassword = false): CurrentUser => ({
  id: "00000000-0000-4000-8000-000000000001",
  username: "u",
  fullName: "U",
  role,
  mustChangePassword,
  studentId: null,
  teacherId: null,
  parentId: null,
});

const adminOnly = createAction({ schema: z.object({ n: z.coerce.number().int().min(1) }), roles: ["ADMIN"] }, async (input) => ({ data: input.n * 2 }));

describe("createAction (backend authorization, not just hidden buttons)", () => {
  beforeEach(() => {
    state.user = null;
  });

  it("rejects anonymous calls", async () => {
    expect(await adminOnly({ n: 1 })).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("rejects users with the wrong role even if they call the action directly", async () => {
    for (const role of ["TEACHER", "STUDENT", "PARENT"] as const) {
      state.user = user(role);
      expect(await adminOnly({ n: 1 })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
  });

  it("blocks everything until a temporary password is changed", async () => {
    state.user = user("ADMIN", true);
    expect(await adminOnly({ n: 1 })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("validates input and returns field errors", async () => {
    state.user = user("ADMIN");
    const r = await adminOnly({ n: 0 });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    if (!r.ok) expect(r.error.fieldErrors?.n).toBeDefined();
  });

  it("runs the handler for an authorised, valid call (FormData supported)", async () => {
    state.user = user("ADMIN");
    const fd = new FormData();
    fd.set("n", "21");
    expect(await adminOnly(fd)).toEqual({ ok: true, data: 42, message: undefined });
  });

  it("hides unexpected internal errors from the user", async () => {
    state.user = user("ADMIN");
    const boom = createAction({ schema: z.object({}) }, async () => {
      throw new Error("db password is hunter2");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await boom({});
    spy.mockRestore();
    expect(r).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    expect(JSON.stringify(r)).not.toContain("hunter2");
  });
});
