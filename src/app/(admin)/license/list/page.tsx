"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Inbox, Loader2, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/report-ui";
import { Combobox } from "@/components/combobox";
import { cn } from "@/lib/utils";
import { apiFetch, ApiError } from "@/lib/client-api";
import type { License } from "@/lib/license-schema";

type Filters = { identifier: string; phone: string; email: string; validTill: string; duration: string; used: "all" | "used" | "unused" };
const EMPTY: Filters = { identifier: "", phone: "", email: "", validTill: "", duration: "", used: "unused" };
const PAGE_SIZES = [10, 25, 50, 100];
const fmtDate = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date(iso)) : null;

export default function ListLicensePage() {
  const [all, setAll] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [quick, setQuick] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<License[]>("/api/licenses")
      .then(setAll)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Could not load licenses"))
      .finally(() => setLoading(false));
  }, []);

  const durations = useMemo(() => [...new Set(all.map((l) => l.duration))].sort((a, b) => a - b), [all]);

  const filtered = useMemo(() => {
    const f = applied;
    const q = quick.trim().toLowerCase();
    return all.filter((l) => {
      const used = l.status === "used" || !!l.usedBy;
      if (f.used === "used" && !used) return false;
      if (f.used === "unused" && used) return false;
      if (f.identifier && !(l.key.toLowerCase().includes(f.identifier.toLowerCase()) || l.usedBy?.name.toLowerCase().includes(f.identifier.toLowerCase()))) return false;
      if (f.phone && !l.usedBy?.phone.includes(f.phone.trim())) return false;
      if (f.email && !l.usedBy?.email.toLowerCase().includes(f.email.trim().toLowerCase())) return false;
      if (f.validTill && (l.validTill ?? "").slice(0, 10) !== f.validTill) return false;
      if (f.duration && String(l.duration) !== f.duration) return false;
      if (q && ![l.key, l.usedBy?.name, l.usedBy?.phone, l.usedBy?.email, `${l.duration} days`].some((v) => v?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [all, applied, quick]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  function onSearch() {
    setApplied(draft);
    setPage(1);
  }
  function onReset() {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setQuick("");
    setPage(1);
  }
  async function copy(l: License) {
    try {
      await navigator.clipboard.writeText(l.key);
      setCopiedId(l.id);
      setTimeout(() => setCopiedId((c) => (c === l.id ? null : c)), 1500);
    } catch {
      toast.error("Could not copy");
    }
  }

  const field = (key: keyof Filters, label: string, placeholder: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} type={type} placeholder={placeholder} maxLength={100} value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        onKeyDown={(e) => e.key === "Enter" && onSearch()} className="h-11" />
    </div>
  );
  const dash = <span className="text-muted-foreground">—</span>;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* ---------- Filters ---------- */}
      <section className="rounded-xl border bg-background p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {field("identifier", "Identifier", "License key or name")}
          {field("phone", "Phone", "Search by phone")}
          {field("email", "Email", "Search by email")}
          {field("validTill", "Valid Till", "", "date")}
          <div className="space-y-2">
            <Label htmlFor="duration">Duration</Label>
            <Combobox id="duration" allLabel="Select Duration" placeholder="Select Duration"
              searchPlaceholder="Type days, e.g. 30"
              options={durations.map((d) => ({ value: String(d), label: `${d} Days` }))}
              value={draft.duration}
              selectedLabel={draft.duration ? `${draft.duration} Days` : undefined}
              onChange={(v) => setDraft((d) => ({ ...d, duration: v }))}
              onCreate={(t) => { const n = t.replace(/\D/g, ""); if (n) setDraft((d) => ({ ...d, duration: String(Number(n)) })); }}
              emptyText="No duration found" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="used">Used / Unused</Label>
            <select id="used" value={draft.used} onChange={(e) => setDraft((d) => ({ ...d, used: e.target.value as Filters["used"] }))}
              className="h-11 w-full cursor-pointer rounded-md border bg-background px-3 text-sm">
              <option value="all">All</option>
              <option value="unused">Unused</option>
              <option value="used">Used</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" className="h-11" onClick={onReset}><RotateCcw className="mr-1.5 h-4 w-4" /> Reset</Button>
          <Button className="h-11 min-w-28" onClick={onSearch}><Search className="mr-1.5 h-4 w-4" /> Search</Button>
        </div>
      </section>

      {/* ---------- Table ---------- */}
      <section className="rounded-xl border bg-background shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="h-10 cursor-pointer rounded-md border bg-background px-2 text-sm text-foreground">
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>entries</span>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={quick} onChange={(e) => { setQuick(e.target.value); setPage(1); }} maxLength={100}
              placeholder="Quick search..." className="h-10 pl-9 pr-8" />
            {quick && (
              <button type="button" onClick={() => setQuick("")} aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Reg Date</th>
                <th className="px-4 py-3">Valid Till</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3" title="Backup Permission">BP</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16">
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Inbox className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium">No licenses found</p>
                      <p className="mt-1 text-sm text-muted-foreground">Try other filters, or create licenses in Create License.</p>
                    </div>
                  </td>
                </tr>
              ) : items.map((l) => {
                const used = l.status === "used" || !!l.usedBy;
                const expired = l.validTill && new Date(l.validTill) < new Date();
                return (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      {l.usedBy ? (
                        <div>
                          <p className="font-medium">{l.usedBy.name}</p>
                          <p className="text-xs text-muted-foreground">{[l.usedBy.phone, l.usedBy.email].filter(Boolean).join(" · ")}</p>
                        </div>
                      ) : dash}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => copy(l)}>
                          {copiedId === l.id ? <Check className="mr-1 h-3.5 w-3.5 text-emerald-600" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                          {copiedId === l.id ? "Copied" : "Copy"}
                        </Button>
                        <span className="font-mono text-xs">{l.key}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(l.regDate) ?? dash}</td>
                    <td className={cn("px-4 py-3 whitespace-nowrap", expired && "font-medium text-destructive")}>{fmtDate(l.validTill) ?? dash}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{l.duration} Days</td>
                    <td className="px-4 py-3">{l.backupPermission ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        used ? "bg-primary/10 text-primary" : "bg-emerald-100 text-emerald-700"
                      )}>
                        {used ? "Used" : "Unused"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t p-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            {filtered.length === 0 ? "Showing 0 entries" : `Showing ${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length} entries`}
          </p>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading || filtered.length === 0} />
        </div>
      </section>
    </div>
  );
}
