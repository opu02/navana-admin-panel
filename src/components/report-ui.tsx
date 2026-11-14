"use client";

// Shared pieces for all report pages
import { ChevronLeft, ChevronRight, Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNumber, toInputDate } from "@/lib/format";

// ---------------- Period presets ----------------
export type Period = "all" | "today" | "7d" | "thisMonth" | "lastMonth" | "thisYear" | "custom";

export const PERIODS: { value: Period; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisYear", label: "This year" },
  { value: "custom", label: "Custom range" },
];

export function periodRange(p: Period): { from?: string; to?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (p) {
    case "today": return { from: toInputDate(now), to: toInputDate(now) };
    case "7d": return { from: toInputDate(new Date(y, m, now.getDate() - 6)), to: toInputDate(now) };
    case "thisMonth": return { from: toInputDate(new Date(y, m, 1)), to: toInputDate(now) };
    case "lastMonth": return { from: toInputDate(new Date(y, m - 1, 1)), to: toInputDate(new Date(y, m, 0)) };
    case "thisYear": return { from: toInputDate(new Date(y, 0, 1)), to: toInputDate(now) };
    default: return {};
  }
}

export function StatCard({ icon: Icon, label, value, loading }: { icon: LucideIcon; label: string; value: number | string; loading: boolean }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-background p-5 shadow-sm">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-7 w-20 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-2xl font-bold tracking-tight">{typeof value === "number" ? formatNumber(value) : value}</p>
        )}
      </div>
    </div>
  );
}

export function ExportBtn({ icon: Icon, label, onClick, disabled, busy, last }: {
  icon: LucideIcon; label: string; onClick: () => void; disabled: boolean; busy: boolean; last?: boolean;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={cn(
        "flex h-9 cursor-pointer items-center gap-1.5 px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
        !last && "border-r"
      )}
      title={disabled && !busy ? "No data to export" : `Export this page as ${label}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

function pageList(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

export function Pagination({ page, totalPages, onChange, disabled }: {
  page: number; totalPages: number; onChange: (p: number) => void; disabled: boolean;
}) {
  return (
    <nav className="flex items-center gap-1" aria-label="Pagination">
      <Button variant="outline" size="sm" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" /> Prev
      </Button>
      {pageList(page, totalPages).map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="px-2 text-muted-foreground">…</span>
        ) : (
          <Button
            key={n} size="sm" variant={n === page ? "default" : "ghost"} disabled={disabled}
            onClick={() => onChange(n)} className="min-w-9"
          >
            {n}
          </Button>
        )
      )}
      <Button variant="outline" size="sm" disabled={disabled || page >= totalPages} onClick={() => onChange(page + 1)}>
        Next <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}

