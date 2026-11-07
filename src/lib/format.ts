const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export function formatVnd(amount: number): string {
  return vnd.format(amount);
}

/** Score like 8,5 (Vietnamese decimal comma). Accepts Prisma Decimal-like values. */
export function formatScore(value: { toString(): string } | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return decimal.format(Number(value.toString()));
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "—";
  return `${Math.round(ratio * 100)}%`;
}
