import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  blue: "bg-sky-100 text-blue-700",
  orange: "bg-orange-50 text-orange-700",
  gold: "bg-petal text-gold-700",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
} as const;

/** Clickable metric tile for dashboards. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  href,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof tones;
  href?: string;
  hint?: string;
}) {
  const body = (
    <>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-md", tones[tone])}>
        <Icon className="size-5" />
      </span>
      <span className="grid min-w-0">
        <span className="text-2xl leading-8 font-semibold text-ink tabular-nums">{value}</span>
        <span className="truncate text-sm text-ink-muted">{label}</span>
        {hint && <span className="truncate text-xs text-ink-muted">{hint}</span>}
      </span>
    </>
  );
  const cls = "flex items-center gap-3 rounded-lg border border-line bg-surface p-4 shadow-card";
  return href ? (
    <Link href={href} className={cn(cls, "transition-shadow hover:shadow-raised")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
