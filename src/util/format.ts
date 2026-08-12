/** Small formatting helpers shared across the dashboard. */

export function formatInt(n: number): string {
  return n.toLocaleString("ja-JP");
}

export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Signed percentage-point delta between two ratios, e.g. "+6.6pt". */
export function formatDeltaPoints(current: number, previous: number): string {
  const pts = (current - previous) * 100;
  const sign = pts > 0 ? "+" : pts < 0 ? "−" : "±";
  return `${sign}${Math.abs(pts).toFixed(1)}pt`;
}

export function deltaDirection(
  current: number,
  previous: number,
): "up" | "down" | "flat" {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}

/** Format an ISO timestamp as a short JST-ish display string. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** Days elapsed since an ISO date relative to a reference "today". */
export function daysSince(iso: string | null, today = new Date("2026-08-12")): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = today.getTime() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
