"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Clock, FileDown, FileSpreadsheet, FileText, Inbox, LogIn, Printer, RefreshCw, RotateCcw,
  Search, Stethoscope, UserCheck, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/combobox";
import { ExportBtn, PERIODS, Pagination, StatCard, periodRange, type Period } from "@/components/report-ui";
import { cn } from "@/lib/utils";
import { formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import { csvOf, excelOf, pdfOf, printOf, type TableExport } from "@/lib/export";
import {
  EMPTY_SESSION_STATS, type Doctor, type DoctorSession, type DoctorSessionListResponse, type PrescriptionFilters,
} from "@/lib/types";

type Draft = { doctorId: string; period: Period; from: string; to: string };
const EMPTY_DRAFT: Draft = { doctorId: "", period: "all", from: "", to: "" };
const PAGE_SIZES = [10, 25, 50, 100];
const AUTO_REFRESH_MS = 60 * 1000; // refresh every minute (to see who is online)

function stayOf(s: DoctorSession): { text: string; kind: "never" | "active" | "done" } {
  if (!s.loginAt) return { text: "Never logged in", kind: "never" };
  if (!s.logoutAt) return { text: "Online now", kind: "active" };
  return { text: formatDuration((Date.parse(s.logoutAt) - Date.parse(s.loginAt)) / 1000), kind: "done" };
}

export default function DoctorReportPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [applied, setApplied] = useState<PrescriptionFilters>({});
  const [dateError, setDateError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [data, setData] = useState<DoctorSessionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/doctors", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Doctor[]) => setDoctors(d))
      .catch((e) => e?.name !== "AbortError" && toast.error("Could not load doctors"))
      .finally(() => setDoctorsLoading(false));
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (applied.doctorId) params.set("doctorId", applied.doctorId);
    if (applied.from) params.set("from", applied.from);
    if (applied.to) params.set("to", applied.to);
    if (search) params.set("search", search);

    setLoading(true);
    setError("");
    fetch(`/api/doctor-sessions?${params}`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: DoctorSessionListResponse) => {
        setData(d);
        setLastUpdated(new Date());
        setLoading(false);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setError("Could not load the doctor report. Please try again.");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [applied, search, page, pageSize, reloadKey]);

  useEffect(() => {
    const t = setInterval(() => setReloadKey((k) => k + 1), AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  function onPeriodChange(p: Period) {
    const r = periodRange(p);
    setDateError("");
    setDraft((d) => ({ ...d, period: p, from: r.from ?? (p === "custom" ? d.from : ""), to: r.to ?? (p === "custom" ? d.to : "") }));
  }

  function onSearch() {
    if (draft.period === "custom") {
      if (!draft.from || !draft.to) return setDateError("Please choose both From and To dates.");
      if (draft.from > draft.to) return setDateError("From date can't be after To date.");
    }
    setDateError("");
    setApplied({ doctorId: draft.doctorId || undefined, from: draft.from || undefined, to: draft.to || undefined });
    setPage(1);
  }

  function onReset() {
    setDraft(EMPTY_DRAFT);
    setApplied({});
    setDateError("");
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const stats = data?.stats ?? EMPTY_SESSION_STATS;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize;
  const filtersChanged =
    draft.doctorId !== (applied.doctorId ?? "") || draft.from !== (applied.from ?? "") || draft.to !== (applied.to ?? "");

  const runExport = useCallback(
    async (kind: "print" | "excel" | "pdf" | "csv") => {
      if (items.length === 0) return;
      const t: TableExport = {
        title: "Doctor Report — Navana Pharmaceuticals PLC",
        fileBase: "doctor-report",
        headers: ["SL", "Doctor Name", "NPL", "Login Time", "Logout Time", "Stay"],
        rows: items.map((s, i) => [
          String(startIndex + i + 1),
          s.doctorName,
          s.npl,
          s.loginAt ? formatDateTime(s.loginAt) : "—",
          s.logoutAt ? formatDateTime(s.logoutAt) : "—",
          stayOf(s).text,
        ]),
        page,
        widths: [6, 32, 14, 24, 24, 18],
      };
      setExporting(kind);
      try {
        if (kind === "print") {
          if (!printOf(t)) toast.error("Please allow pop-ups to print.");
        } else if (kind === "excel") await excelOf(t);
        else if (kind === "pdf") await pdfOf(t);
        else csvOf(t);
        if (kind !== "print") toast.success(`${kind.toUpperCase()} downloaded`);
      } catch {
        toast.error("Export failed. Please try again.");
      } finally {
        setExporting(null);
      }
    },
    [items, page, startIndex]
  );

  const doctorOptions = useMemo(() => doctors.map((d) => ({ value: d.id, label: d.name, hint: d.npl })), [doctors]);
  const firstLoad = loading && !data;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* ---------- Filters ---------- */}
      <section className="rounded-xl border bg-background p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1.3fr_1fr_1fr_auto]">
          <div className="space-y-2">
            <Label htmlFor="doctor">Doctor</Label>
            <Combobox
              id="doctor"
              options={doctorOptions}
              value={draft.doctorId}
              onChange={(v) => setDraft((d) => ({ ...d, doctorId: v }))}
              allLabel="All doctors"
              searchPlaceholder="Search doctor name or NPL..."
              emptyText={doctors.length === 0 ? "No doctors yet" : "No doctor found"}
              loading={doctorsLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period">Period</Label>
            <select
              id="period" value={draft.period} onChange={(e) => onPeriodChange(e.target.value as Period)}
              className="h-11 w-full cursor-pointer rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input
              id="from" type="date" value={draft.from} max={draft.to || undefined}
              onChange={(e) => setDraft((d) => ({ ...d, period: "custom", from: e.target.value }))}
              className={cn("h-11", dateError && "border-destructive")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to" type="date" value={draft.to} min={draft.from || undefined}
              onChange={(e) => setDraft((d) => ({ ...d, period: "custom", to: e.target.value }))}
              className={cn("h-11", dateError && "border-destructive")}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={onReset}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
            </Button>
            <Button type="button" className="h-11 min-w-28" onClick={onSearch}>
              <Search className="mr-1.5 h-4 w-4" /> Search
              {filtersChanged && <span className="ml-1.5 h-2 w-2 rounded-full bg-amber-300" title="Filters changed" />}
            </Button>
          </div>
        </div>
        {dateError && <p className="mt-3 text-sm text-destructive">{dateError}</p>}
      </section>

      {/* ---------- Stats ---------- */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Stethoscope} label="Total Doctor" value={stats.totalDoctor} loading={firstLoad} />
        <StatCard icon={UserCheck} label="Online Now" value={stats.activeNow} loading={firstLoad} />
        <StatCard icon={LogIn} label="Total Logins" value={stats.totalLogins} loading={firstLoad} />
        <StatCard
          icon={Clock} label="Average Stay" loading={firstLoad}
          value={stats.avgStaySeconds ? formatDuration(stats.avgStaySeconds) : "0"}
        />
      </section>

      {/* ---------- Table ---------- */}
      <section className="rounded-xl border bg-background shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput} onChange={(e) => setSearchInput(e.target.value)} maxLength={100}
                placeholder="Search doctor or NPL..." className="h-10 pl-9 pr-8"
              />
              {searchInput && (
                <button
                  type="button" onClick={() => setSearchInput("")} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Show</span>
              <select
                value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="h-10 cursor-pointer rounded-md border bg-background px-2 text-sm text-foreground"
              >
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span>entries</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 hidden text-xs text-muted-foreground xl:inline">
              {lastUpdated && `Updated ${lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setReloadKey((k) => k + 1)} disabled={loading} title="Refresh">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <div className="inline-flex overflow-hidden rounded-md border">
              <ExportBtn icon={Printer} label="Print" busy={exporting === "print"} disabled={!items.length || !!exporting} onClick={() => runExport("print")} />
              <ExportBtn icon={FileSpreadsheet} label="Excel" busy={exporting === "excel"} disabled={!items.length || !!exporting} onClick={() => runExport("excel")} />
              <ExportBtn icon={FileDown} label="PDF" busy={exporting === "pdf"} disabled={!items.length || !!exporting} onClick={() => runExport("pdf")} />
              <ExportBtn icon={FileText} label="CSV" busy={exporting === "csv"} disabled={!items.length || !!exporting} onClick={() => runExport("csv")} last />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="w-12 px-4 py-3">#</th>
                <th className="px-4 py-3">Doctor Name</th>
                <th className="px-4 py-3">NPL</th>
                <th className="px-4 py-3">Login Time</th>
                <th className="px-4 py-3">Logout Time</th>
                <th className="px-4 py-3">Stay</th>
              </tr>
            </thead>
            <tbody className={cn(loading && data && "opacity-50 transition-opacity")}>
              {firstLoad ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 animate-pulse rounded bg-muted" /></td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <p className="text-destructive">{error}</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setReloadKey((k) => k + 1)}>
                      Try again
                    </Button>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16">
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Inbox className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium">No doctor activity found</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Doctor logins from the app will show up here automatically.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((s, i) => {
                  const stay = stayOf(s);
                  return (
                    <tr key={s.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-3.5 text-muted-foreground">{startIndex + i + 1}</td>
                      <td className="px-4 py-3.5 font-medium">{s.doctorName}</td>
                      <td className="px-4 py-3.5 font-mono text-xs">{s.npl}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">{s.loginAt ? formatDateTime(s.loginAt) : <Dash />}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">{s.logoutAt ? formatDateTime(s.logoutAt) : <Dash />}</td>
                      <td className="px-4 py-3.5">
                        {stay.kind === "active" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Online now
                          </span>
                        ) : stay.kind === "never" ? (
                          <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            Never logged in
                          </span>
                        ) : (
                          stay.text
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t p-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            {total === 0
              ? "Showing 0 entries"
              : `Showing ${formatNumber(startIndex + 1)}–${formatNumber(Math.min(startIndex + pageSize, total))} of ${formatNumber(total)} entries`}
          </p>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} disabled={loading || total === 0} />
        </div>
      </section>
    </div>
  );
}

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}
