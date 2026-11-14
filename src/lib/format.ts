export function formatDate(isoDate: string) {
  // date-only values like "2026-12-23"
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(isoDate));
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka",
  }).format(new Date(iso));
}

export function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}

/** local date → "yyyy-mm-dd" */
export function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 18 → "18 seconds", 340 → "5m 40s", 4100 → "1h 8m" */
export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  return sec ? `${m}m ${sec}s` : `${m}m`;
}
