import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import * as React from "react";
import { cn, initials } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-sky-100/80", className)} aria-hidden {...props} />;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-orange-50 text-sm font-semibold text-orange-700", className)}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

const alertTones = {
  info: { icon: Info, cls: "bg-sky-100/60 text-blue-700 border-sky-100" },
  success: { icon: CheckCircle2, cls: "bg-success/10 text-success border-success/20" },
  warning: { icon: TriangleAlert, cls: "bg-warning/10 text-warning border-warning/20" },
  danger: { icon: AlertCircle, cls: "bg-danger/10 text-danger border-danger/20" },
} as const;

export function Alert({ tone = "info", title, children, className }: { tone?: keyof typeof alertTones; title?: string; children?: React.ReactNode; className?: string }) {
  const { icon: Icon, cls } = alertTones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-md border p-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="grid gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink">{children}</div>}
      </div>
    </div>
  );
}
