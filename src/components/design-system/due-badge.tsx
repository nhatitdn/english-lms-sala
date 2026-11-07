import { Badge } from "@/components/ui/badge";
import { relativeDue } from "@/lib/datetime";

/** Deadline chip: blue (>24h) → orange (<24h) → red (overdue). Always text, never colour alone. */
export function DueBadge({ dueAt }: { dueAt: Date | null }) {
  if (!dueAt) return <Badge tone="neutral">Không hạn</Badge>;
  const { text, overdue, hoursLeft } = relativeDue(dueAt);
  const soon = !overdue && hoursLeft < 24;
  return <Badge tone={overdue ? "danger" : soon ? "orange" : "blue"}>{text}</Badge>;
}
