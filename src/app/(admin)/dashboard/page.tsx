"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowRight, BadgeCheck, ClipboardList, FileText, FlaskConical, KeyRound, Pill, Plus,
  RefreshCw, ShieldCheck, Stethoscope, UserPlus, Users, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { apiFetch } from "@/lib/client-api";
import { useMe } from "@/components/admin/use-me";
import type { Brand, BrandListResponse } from "@/lib/brand-types";

type Dash = {
  master: { key: string; label: string; href: string; total: number | null }[];
  users: { admins: number; doctors: number; active: number };
  licenses: { total: number; used: number; unused: number };
};
type BrandStats = { total: number; system: number; doctor: number; recent: Brand[] };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const me = useMe();
  const [dash, setDash] = useState<Dash | null>(null);
  const [brands, setBrands] = useState<BrandStats | null>(null);
  const [dashError, setDashError] = useState(false);
  const [brandError, setBrandError] = useState(false);
  const [reload, setReload] = useState(0);
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date()));
  }, []);

  useEffect(() => {
    setDashError(false);
    apiFetch<Dash>("/api/dashboard").then(setDash).catch(() => setDashError(true));

    setBrandError(false);
    // brands can take up to a minute the first time (34k+ from the ERP)
    Promise.all([
      apiFetch<BrandListResponse>("/api/brands?view=all&pageSize=6"),
      apiFetch<BrandListResponse>("/api/brands?view=system&pageSize=1"),
      apiFetch<BrandListResponse>("/api/brands?view=doctor&pageSize=1"),
    ])
      .then(([all, sys, doc]) => setBrands({ total: all.total, system: sys.total, doctor: doc.total, recent: all.items }))
      .catch(() => setBrandError(true));
  }, [reload]);

  const ranked = useMemo(
    () => (dash?.master ?? []).filter((m) => m.total !== null).sort((a, b) => (b.total ?? 0) - (a.total ?? 0)),
    [dash]
  );
  const max = Math.max(1, ...ranked.map((m) => m.total ?? 0));
  const failed = (dash?.master ?? []).filter((m) => m.total === null);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* ---------- Welcome ---------- */}
      <section className="relative overflow-hidden rounded-xl bg-primary p-6 text-primary-foreground shadow-sm sm:p-8">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-primary-foreground/70">{today}</p>
            <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">
              {greeting()}{me?.name ? `, ${me.name}` : ""}
            </h2>
            <p className="mt-1 text-primary-foreground/80">Here is what&apos;s happening in Navana Rx today.</p>
          </div>
          <Button variant="secondary" onClick={() => setReload((n) => n + 1)} className="w-fit">
            <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
          </Button>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-white/5" />
      </section>

      {/* ---------- Key numbers ---------- */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          icon={Pill} label="Drug Brands" href="/system/drug-brand"
          value={brands?.total} loading={!brands && !brandError} error={brandError}
          sub={brands ? `${formatNumber(brands.system)} system · ${formatNumber(brands.doctor)} by doctors` : brandError ? "Could not load" : "Loading from the ERP…"}
        />
        <Tile
          icon={FlaskConical} label="Generics" href="/system/generic"
          value={dash?.master.find((m) => m.key === "generic")?.total ?? undefined}
          loading={!dash && !dashError} error={dashError}
          sub="Same list as the app"
        />
        <Tile
          icon={Users} label="Panel Users" href="/users/admins"
          value={dash ? dash.users.admins + dash.users.doctors : undefined} loading={!dash && !dashError} error={dashError}
          sub={dash ? `${dash.users.admins} admin · ${dash.users.doctors} doctor · ${dash.users.active} active` : ""}
        />
        <Tile
          icon={KeyRound} label="Licenses" href="/license/list"
          value={dash?.licenses.total} loading={!dash && !dashError} error={dashError}
          sub={dash ? `${dash.licenses.unused} unused · ${dash.licenses.used} used` : ""}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ---------- Master data chart ---------- */}
        <section className="min-w-0 rounded-xl border bg-background shadow-sm">
          <header className="flex items-center justify-between border-b p-5">
            <div>
              <h3 className="font-semibold">Prescription data in the ERP</h3>
              <p className="text-sm text-muted-foreground">Active items in each list doctors use when writing a prescription</p>
            </div>
          </header>
          <div className="p-5">
            {!dash && !dashError ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-6 animate-pulse rounded bg-muted" />)}
              </div>
            ) : dashError ? (
              <ErrorBox onRetry={() => setReload((n) => n + 1)} />
            ) : (
              <>
                <ul className="space-y-2" aria-label="Items per list">
                  {ranked.map((m) => {
                    const pct = Math.max(((m.total ?? 0) / max) * 100, (m.total ?? 0) > 0 ? 1.5 : 0);
                    return (
                      <li key={m.key}>
                        <Link
                          href={m.href}
                          className="group grid grid-cols-[120px_minmax(0,1fr)_64px] items-center gap-3 rounded-md px-1 py-1 hover:bg-muted/50 sm:grid-cols-[150px_minmax(0,1fr)_72px]"
                          title={`${m.label}: ${formatNumber(m.total ?? 0)} items — open`}
                        >
                          <span className="truncate text-sm text-muted-foreground group-hover:text-foreground">{m.label}</span>
                          <span className="relative h-3.5 rounded-r bg-muted/60">
                            <span
                              className="absolute inset-y-0 left-0 rounded-r-[4px] bg-primary transition-[width] duration-500 group-hover:bg-primary/85"
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                          <span className="text-right text-sm font-semibold tabular-nums">{formatNumber(m.total ?? 0)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {failed.length > 0 && (
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5" /> Could not load: {failed.map((f) => f.label).join(", ")}
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* ---------- Right column ---------- */}
        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border bg-background shadow-sm">
            <header className="border-b p-5">
              <h3 className="font-semibold">Quick actions</h3>
            </header>
            <div className="grid grid-cols-2 gap-3 p-5">
              <Action href="/system/drug-brand" icon={Plus} label="Add Drug" />
              <Action href="/system/generic" icon={FlaskConical} label="Add Generic" />
              <Action href="/users/create" icon={UserPlus} label="Create User" />
              <Action href="/license/create" icon={KeyRound} label="Create License" />
              <Action href="/reports/prescription" icon={FileText} label="Prescriptions" />
              <Action href="/users/roles" icon={ShieldCheck} label="User Roles" />
            </div>
          </section>

          <section className="rounded-xl border bg-background shadow-sm">
            <header className="flex items-center justify-between border-b p-5">
              <h3 className="font-semibold">Latest drug brands</h3>
              <Link href="/system/drug-brand" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </header>
            <ul className="divide-y">
              {!brands && !brandError ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="p-4"><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /></li>
                ))
              ) : brandError ? (
                <li className="p-5"><ErrorBox onRetry={() => setReload((n) => n + 1)} /></li>
              ) : brands!.recent.length === 0 ? (
                <li className="p-5 text-sm text-muted-foreground">No brands yet.</li>
              ) : brands!.recent.map((b) => (
                <li key={b.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Pill className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b.name} {b.strength && <span className="font-normal text-muted-foreground">{b.strength}</span>}</p>
                    <p className="truncate text-xs text-muted-foreground">{[b.form, b.generic, b.company].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    b.isSystem ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {b.isSystem ? "System" : "Doctor"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* ---------- Reports waiting ---------- */}
      <section className="grid gap-4 md:grid-cols-2">
        <Waiting icon={ClipboardList} title="Prescription Report" href="/reports/prescription"
          text="Will show prescriptions from all doctors once the ERP provides a prescription-report API." />
        <Waiting icon={Stethoscope} title="Doctor Report" href="/reports/doctor"
          text="Will show doctor logins and activity once the ERP provides a login-history API." />
      </section>
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub, href, loading, error }: {
  icon: LucideIcon; label: string; value?: number; sub?: string; href: string; loading: boolean; error: boolean;
}) {
  return (
    <Link href={href} className="group flex items-start gap-4 rounded-xl border bg-background p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-8 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-3xl font-bold tracking-tight tabular-nums">{error || value === undefined ? "—" : formatNumber(value)}</p>
        )}
        {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function Action({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-lg border p-3 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary/5">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function Waiting({ icon: Icon, title, text, href }: { icon: LucideIcon; title: string; text: string; href: string }) {
  return (
    <Link href={href} className="flex items-start gap-4 rounded-xl border border-dashed bg-background p-5 hover:bg-muted/30">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="flex items-center gap-2 font-semibold">
          {title}
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Waiting for ERP API</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      </div>
    </Link>
  );
}

function ErrorBox({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center text-sm">
      <p className="flex items-center gap-1.5 text-destructive"><BadgeCheck className="hidden" /><AlertCircle className="h-4 w-4" /> Could not load from the ERP.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}
