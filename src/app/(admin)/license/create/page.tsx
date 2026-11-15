"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, BadgeCheck, Check, Copy, Download, KeyRound, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { apiFetch, ApiError } from "@/lib/client-api";
import { licenseSchema, type License, type LicenseForm, type LicenseData } from "@/lib/license-schema";

const EMPTY: LicenseForm = { duration: "" as unknown as number, unit: "Days", quantity: 1, backupPermission: false };

export default function CreateLicensePage() {
  const router = useRouter();
  const [created, setCreated] = useState<License[]>([]);
  const [copied, setCopied] = useState(false);
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<LicenseForm, unknown, LicenseData>({ resolver: zodResolver(licenseSchema), defaultValues: EMPTY, mode: "onTouched" });

  async function onSubmit(values: LicenseData) {
    try {
      const list = await apiFetch<License[]>("/api/licenses", { method: "POST", body: JSON.stringify(values) });
      setCreated(list);
      setCopied(false);
      toast.success(`${list.length} license${list.length > 1 ? "s" : ""} created`);
      reset(EMPTY);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not create licenses");
    }
  }

  async function copyAll() {
    await navigator.clipboard.writeText(created.map((l) => l.key).join("\n"));
    setCopied(true);
    toast.success("Keys copied");
  }

  function downloadCsv() {
    const rows = [["License Key", "Duration", "Backup Permission"], ...created.map((l) => [l.key, `${l.duration} ${l.unit}`, l.backupPermission ? "Yes" : "No"])];
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `licenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          <b>Licenses are saved on this website only for now.</b> The ERP has no license API yet, so the app cannot
          check these keys until the ERP team provides one.
        </p>
      </div>

      <section className="rounded-xl border bg-background shadow-sm">
        <header className="flex items-center gap-3 border-b p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BadgeCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Create License</h3>
            <p className="text-sm text-muted-foreground">Create one or more license keys at once</p>
          </div>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-5 p-5 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration<span className="ml-0.5 text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Input
                  id="duration" type="number" min={1} max={36500} inputMode="numeric" placeholder="e.g. 30"
                  aria-invalid={!!errors.duration}
                  className={cn("h-11", errors.duration && "border-destructive")}
                  {...register("duration")}
                />
                <span className="flex h-11 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">Days</span>
              </div>
              {errors.duration && <p className="text-xs text-destructive">{errors.duration.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity<span className="ml-0.5 text-destructive">*</span></Label>
              <Input
                id="quantity" type="number" min={1} max={500} inputMode="numeric" placeholder="How many keys"
                aria-invalid={!!errors.quantity}
                className={cn("h-11", errors.quantity && "border-destructive")}
                {...register("quantity")}
              />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Backup Permissions</Label>
              <label className="flex h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm hover:bg-muted/40">
                <input type="checkbox" className="h-4 w-4 cursor-pointer accent-[var(--primary)]" {...register("backupPermission")} />
                Allow data backup with this license
              </label>
            </div>
          </div>

          <footer className="flex items-center justify-end gap-2 rounded-b-xl border-t bg-muted/30 px-5 py-4">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => { reset(EMPTY); router.push("/license/list"); }}>
              <X className="mr-1.5 h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1.5 h-4 w-4" />}
              Create License
            </Button>
          </footer>
        </form>
      </section>

      {created.length > 0 && (
        <section className="rounded-xl border border-emerald-200 bg-background shadow-sm">
          <header className="flex flex-col gap-3 border-b bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-emerald-800">{created.length} new license key{created.length > 1 ? "s" : ""}</h3>
              <p className="text-sm text-emerald-700">
                {created[0].duration} {created[0].unit} · Backup {created[0].backupPermission ? "allowed" : "not allowed"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyAll}>
                {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />} Copy all
              </Button>
              <Button variant="outline" size="sm" onClick={downloadCsv}>
                <Download className="mr-1.5 h-4 w-4" /> Download CSV
              </Button>
            </div>
          </header>
          <ul className="grid max-h-80 gap-2 overflow-y-auto p-5 sm:grid-cols-2">
            {created.map((l) => (
              <li key={l.id} className="truncate rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs" title={l.key}>{l.key}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
