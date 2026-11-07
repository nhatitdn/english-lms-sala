import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./input";

/** Label + control + hint + error, wired with aria attributes. */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | string[];
  required?: boolean;
  className?: string;
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  const describedBy = [hint ? `${id}-hint` : null, message ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </Label>
      {React.cloneElement(children, { id, "aria-invalid": message ? true : undefined, "aria-describedby": describedBy })}
      {hint && !message && (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} className="text-sm text-danger" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
