import { Inbox, RefreshCw, TriangleAlert } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Empty list / no data yet. Always explain what will appear here and, when possible, offer the next action. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-surface/60 px-6 py-10 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full bg-sky-100 text-blue-700">
        <Icon className="size-6" />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Something failed. Say what happened in plain words and offer a retry. */
export function ErrorState({
  title = "Không tải được dữ liệu",
  description = "Đã có lỗi xảy ra. Vui lòng thử lại sau ít phút.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-2 rounded-lg border border-danger/20 bg-danger/5 px-6 py-10 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full bg-danger/10 text-danger">
        <TriangleAlert className="size-6" />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-sm text-ink-muted">{description}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 inline-flex h-10 items-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-medium hover:bg-sky-50">
          <RefreshCw className="size-4" /> Thử lại
        </button>
      )}
    </div>
  );
}

export function Spinner({ className, label = "Đang tải…" }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-sm text-ink-muted", className)}>
      <span className="size-4 animate-spin rounded-full border-2 border-sky-100 border-t-blue-600" aria-hidden />
      {label}
    </span>
  );
}
