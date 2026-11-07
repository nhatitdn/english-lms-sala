export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

/** An error whose message is safe to show to the user (Vietnamese). */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFoundError = () => new AppError("NOT_FOUND", "Không tìm thấy dữ liệu hoặc bạn không có quyền truy cập.");
export const forbiddenError = () => new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
