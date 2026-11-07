import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { getCurrentUser, type CurrentUser } from "./auth/current-user";
import { AppError, type ErrorCode } from "./errors";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> } };

export type ActionContext = { user: CurrentUser };

/** Turn FormData into a plain object (repeated keys become arrays, empty strings become undefined). */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const v = typeof value === "string" ? (value.trim() === "" ? undefined : value) : value;
    if (key in out) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, v] : [prev, v];
    } else {
      out[key] = v;
    }
  }
  return out;
}

/**
 * Standard Server Action wrapper: authenticate → role check → validate (Zod) → run → map errors.
 * Resource-level checks (canManageClass …) stay inside the handler/service, close to the data.
 */
export function createAction<S extends z.ZodType, T>(
  options: { schema: S; roles?: Role[]; allowMustChangePassword?: boolean },
  handler: (input: z.infer<S>, ctx: ActionContext) => Promise<{ data: T; message?: string }>,
) {
  return async (input: unknown): Promise<ActionResult<T>> => {
    try {
      const user = await getCurrentUser();
      if (!user) return fail("UNAUTHENTICATED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      if (user.mustChangePassword && !options.allowMustChangePassword) {
        return fail("FORBIDDEN", "Bạn cần đổi mật khẩu trước khi tiếp tục.");
      }
      if (options.roles && !options.roles.includes(user.role)) {
        return fail("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
      }
      const raw = input instanceof FormData ? formDataToObject(input) : input;
      const parsed = options.schema.safeParse(raw);
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Vui lòng kiểm tra lại thông tin đã nhập.",
            fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
          },
        };
      }
      const result = await handler(parsed.data, { user });
      return { ok: true, data: result.data, message: result.message };
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof AppError) {
        return { ok: false, error: { code: error.code, message: error.message, fieldErrors: error.fieldErrors } };
      }
      console.error("[action] unexpected error", error);
      return fail("INTERNAL", "Đã có lỗi xảy ra. Vui lòng thử lại.");
    }
  };
}

function fail(code: ErrorCode, message: string): { ok: false; error: { code: ErrorCode; message: string } } {
  return { ok: false, error: { code, message } };
}
