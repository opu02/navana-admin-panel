"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Inbox, Loader2, Pencil, Pill, Plus, RefreshCw, RotateCcw, Save, Search, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/combobox";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/report-ui";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { apiFetch, ApiError } from "@/lib/client-api";
import { brandSchema, type BrandForm } from "@/lib/brand-schema";
import type { Brand, BrandListResponse, BrandOptions, BrandView } from "@/lib/brand-types";

const PAGE_SIZES = [25, 50, 100];
const EMPTY: BrandForm = { name: "", formId: "", form: "", strengthId: "", strength: "", genericId: "", companyId: "", npsCode: "" };
const VIEWS: { value: BrandView; label: string }[] = [
  { value: "all", label: "All active" },
  { value: "system", label: "System (Navana)" },
  { value: "doctor", label: "Added by doctors" },
  { value: "inactive", label: "Deleted / inactive" },
];

export function BrandManager({ editId }: { editId?: string }) {
  const router = useRouter();
  const isEdit = editId !== undefined;
  const nameRef = useRef<HTMLInputElement | null>(null);

  // ----- dropdown options -----
  const [opts, setOpts] = useState<BrandOptions | null>(null);
  const [optsLoading, setOptsLoading] = useState(true);

  // ----- list state -----
  const [view, setView] = useState<BrandView>("all");
  const [companyFilter, setCompanyFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<BrandListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState<{ n: number; force: boolean }>({ n: 0, force: false });
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // ----- edit / delete -----
  const [original, setOriginal] = useState<BrandForm | null>(null);
  const [loadingItem, setLoadingItem] = useState(isEdit);
  const [toDelete, setToDelete] = useState<Brand | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    register, handleSubmit, reset, control, setValue, watch, setError: setFieldError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BrandForm>({ resolver: zodResolver(brandSchema), defaultValues: EMPTY, mode: "onTouched" });
  const { ref: rhfNameRef, ...nameField } = register("name");

  // load dropdown lists
  useEffect(() => {
    apiFetch<BrandOptions>("/api/brands/options")
      .then(setOpts)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Could not load lists"))
      .finally(() => setOptsLoading(false));
  }, []);

  // load the brand being edited
  useEffect(() => {
    if (!isEdit) return;
    setLoadingItem(true);
    apiFetch<Brand>(`/api/brands/${encodeURIComponent(editId!)}`)
      .then((b) => {
        const f: BrandForm = {
          name: b.name, formId: b.formId, form: b.form, strengthId: b.strengthId, strength: b.strength,
          genericId: b.genericId, companyId: b.companyId, npsCode: b.npsCode,
        };
        setOriginal(f);
        reset(f);
        setLoadingItem(false);
        setTimeout(() => nameRef.current?.focus(), 0);
      })
      .catch(() => {
        toast.error("Brand not found");
        router.replace("/system/drug-brand");
      });
  }, [editId, isEdit, reset, router]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // load list
  useEffect(() => {
    let cancelled = false;
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize), view });
    if (search) p.set("search", search);
    if (companyFilter) p.set("companyId", companyFilter);
    if (reload.force) p.set("refresh", "1");
    setLoading(true);
    setError("");
    apiFetch<BrandListResponse>(`/api/brands?${p}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : "Could not load brands."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [search, view, companyFilter, page, pageSize, reload]);

  const genericOptions = useMemo(() => (opts?.generics ?? []).map((o) => ({ value: o.id, label: o.name })), [opts]);
  const companyOptions = useMemo(() => (opts?.companies ?? []).map((o) => ({ value: o.id, label: o.name })), [opts]);
  const formOptions = useMemo(() => (opts?.forms ?? []).map((o) => ({ value: o.id, label: o.name })), [opts]);
  const strengthOptions = useMemo(() => (opts?.strengths ?? []).map((o) => ({ value: o.id, label: o.name })), [opts]);

  async function onSubmit(values: BrandForm) {
    try {
      const saved = await apiFetch<Brand>(isEdit ? `/api/brands/${encodeURIComponent(editId!)}` : "/api/brands", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(values),
      });
      setHighlightId(saved.id);
      setTimeout(() => setHighlightId(null), 3000);
      if (isEdit) {
        toast.success("Brand updated");
        router.push("/system/drug-brand");
      } else {
        toast.success("Brand added");
        reset(EMPTY);
        setPage(1);
        setReload((r) => ({ n: r.n + 1, force: false }));
        nameRef.current?.focus();
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Could not save. Please try again.";
      if (e instanceof ApiError && e.status === 409) setFieldError("name", { message: msg });
      else toast.error(msg);
    }
  }

  const confirmDelete = useCallback(async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/brands/${encodeURIComponent(toDelete.id)}`, { method: "DELETE" });
      toast.success(`"${toDelete.name}" deleted`);
      if (toDelete.id === editId) router.push("/system/drug-brand");
      setToDelete(null);
      if (data && data.items.length === 1 && page > 1) setPage((p) => p - 1);
      else setReload((r) => ({ n: r.n + 1, force: false }));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not delete. Please try again.");
    } finally {
      setDeleting(false);
    }
  }, [toDelete, editId, router, data, page]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize;
  const firstLoad = loading && !data;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* ---------- Form ---------- */}
      <section className="rounded-xl border bg-background shadow-sm">
        <header className="flex items-center gap-3 border-b p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {isEdit ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-semibold">{isEdit ? "Edit Drug Brand" : "Add New Drug"}</h3>
            <p className="text-sm text-muted-foreground">
              {isEdit ? "Change the details and update" : "Saved to the ERP. Doctors get it on their next sync."}
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Brand Name" required error={errors.name?.message}>
              {loadingItem ? <Skeleton /> : (
                <Input
                  id="name" placeholder="Write brand name" maxLength={200} autoComplete="off"
                  aria-invalid={!!errors.name}
                  className={cn("h-11", errors.name && "border-destructive")}
                  {...nameField}
                  ref={(el) => { rhfNameRef(el); nameRef.current = el; }}
                />
              )}
            </Field>

            <Field label="Form" hint="Pick or type new" error={errors.form?.message}>
              {loadingItem ? <Skeleton /> : (
                <Controller
                  control={control} name="formId"
                  render={({ field }) => (
                    <Combobox
                      options={formOptions} value={field.value} loading={optsLoading}
                      placeholder="Select form (e.g. Tablet)"
                      selectedLabel={watch("form")}
                      onChange={(v, label) => {
                        field.onChange(v);
                        setValue("form", label, { shouldDirty: true });
                      }}
                      onCreate={(text) => {
                        field.onChange("");
                        setValue("form", text, { shouldDirty: true, shouldValidate: true });
                      }}
                    />
                  )}
                />
              )}
            </Field>

            <Field label="Strength" hint="Pick or type new" error={errors.strength?.message}>
              {loadingItem ? <Skeleton /> : (
                <Controller
                  control={control} name="strengthId"
                  render={({ field }) => (
                    <Combobox
                      options={strengthOptions} value={field.value} loading={optsLoading}
                      placeholder="Select strength (e.g. 500mg)"
                      selectedLabel={watch("strength")}
                      onChange={(v, label) => {
                        field.onChange(v);
                        setValue("strength", label, { shouldDirty: true });
                      }}
                      onCreate={(text) => {
                        field.onChange("");
                        setValue("strength", text, { shouldDirty: true, shouldValidate: true });
                      }}
                    />
                  )}
                />
              )}
            </Field>

            <Field label="Generic Name" required error={errors.genericId?.message}>
              {loadingItem ? <Skeleton /> : (
                <Controller
                  control={control} name="genericId"
                  render={({ field }) => (
                    <Combobox
                      options={genericOptions} value={field.value} loading={optsLoading}
                      placeholder="Select generic name" searchPlaceholder="Search generic..."
                      invalid={!!errors.genericId}
                      onChange={(v) => field.onChange(v)}
                    />
                  )}
                />
              )}
            </Field>

            <Field label="Company Name" required error={errors.companyId?.message}>
              {loadingItem ? <Skeleton /> : (
                <Controller
                  control={control} name="companyId"
                  render={({ field }) => (
                    <Combobox
                      options={companyOptions} value={field.value} loading={optsLoading}
                      placeholder="Select company name" searchPlaceholder="Search company..."
                      invalid={!!errors.companyId}
                      onChange={(v) => field.onChange(v)}
                    />
                  )}
                />
              )}
            </Field>

            <Field label="NPS Code" error={errors.npsCode?.message}>
              {loadingItem ? <Skeleton /> : (
                <Input
                  id="npsCode" placeholder="Write NPS code" maxLength={50} autoComplete="off"
                  aria-invalid={!!errors.npsCode}
                  className={cn("h-11", errors.npsCode && "border-destructive")}
                  {...register("npsCode")}
                />
              )}
            </Field>
          </div>

          <footer className="flex items-center justify-between gap-2 rounded-b-xl border-t bg-muted/30 px-5 py-4">
            {isEdit ? (
              <Button type="button" variant="ghost" onClick={() => router.push("/system/drug-brand")} disabled={isSubmitting}>
                <X className="mr-1.5 h-4 w-4" /> Cancel
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={isSubmitting || !isDirty}
                onClick={() => { reset(original ?? EMPTY); nameRef.current?.focus(); }}>
                <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
              </Button>
              <Button type="submit" disabled={isSubmitting || loadingItem || optsLoading || (isEdit && !isDirty)}>
                {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                {isEdit ? "Update" : "Save"}
              </Button>
            </div>
          </footer>
        </form>
      </section>

      {/* ---------- List ---------- */}
      <section className="rounded-xl border bg-background shadow-sm">
        <div className="grid gap-4 border-b p-4 md:grid-cols-2 xl:grid-cols-[220px_320px_1fr_auto] xl:items-end">
          <div className="space-y-2">
            <Label htmlFor="view">View</Label>
            <select
              id="view" value={view} onChange={(e) => { setView(e.target.value as BrandView); setPage(1); }}
              className="h-10 w-full cursor-pointer rounded-md border bg-background px-3 text-sm"
            >
              {VIEWS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Company</Label>
            <Combobox
              options={companyOptions} value={companyFilter} loading={optsLoading} allLabel="All companies"
              searchPlaceholder="Search company..."
              onChange={(v) => { setCompanyFilter(v); setPage(1); }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} maxLength={100}
                placeholder="Brand, generic, company, NPS code..." className="h-10 pl-9 pr-8"
              />
              {searchInput && (
                <button type="button" onClick={() => setSearchInput("")} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="h-10 cursor-pointer rounded-md border bg-background px-2 text-sm" aria-label="Rows per page"
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
            </select>
            <Button variant="outline" size="icon" className="h-10 w-10" title="Reload everything from the ERP"
              disabled={loading} onClick={() => setReload((r) => ({ n: r.n + 1, force: true }))}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="w-14 px-4 py-3">#</th>
                <th className="px-4 py-3">Brand Name</th>
                <th className="px-4 py-3">Form</th>
                <th className="px-4 py-3">Strength</th>
                <th className="px-4 py-3">Generic Name</th>
                <th className="px-4 py-3">Company Name</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3">NPS Code</th>
                <th className="w-28 px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={cn(loading && data && "opacity-50 transition-opacity")}>
              {firstLoad ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                    Loading drug brands from the ERP…
                    <p className="mt-1 text-xs">The first load can take up to a minute (34,000+ brands).</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <p className="text-destructive">{error}</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setReload((r) => ({ n: r.n + 1, force: false }))}>
                      Try again
                    </Button>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16">
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Inbox className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium">{search ? `No brand matches "${search}"` : "No brands found"}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((b, i) => (
                  <tr key={b.id} className={cn(
                    "border-b align-top transition-colors last:border-0 hover:bg-muted/40",
                    b.id === editId && "bg-primary/5",
                    b.id === highlightId && "bg-emerald-50"
                  )}>
                    <td className="px-4 py-3 text-muted-foreground">{startIndex + i + 1}</td>
                    <td className="px-4 py-3 font-medium">
                      <span className="flex items-center gap-2"><Pill className="h-4 w-4 shrink-0 text-primary/60" />{b.name}</span>
                    </td>
                    <td className="px-4 py-3">{b.form || <Dash />}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{b.strength || <Dash />}</td>
                    <td className="px-4 py-3">{b.generic || <Dash />}</td>
                    <td className="px-4 py-3">{b.company || <Dash />}</td>
                    <td className="px-4 py-3">
                      {b.isSystem ? (
                        <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">System</span>
                      ) : (
                        <span className="text-muted-foreground">Doctor #{b.createdBy ?? "?"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{b.npsCode || <Dash />}</td>
                    <td className="px-4 py-3">
                      {b.isActive ? (
                        <div className="flex justify-end gap-1.5">
                          <Button size="icon" variant="outline" className="h-8 w-8" title="Edit" aria-label={`Edit ${b.name}`}
                            onClick={() => router.push(`/system/drug-brand/edit/${encodeURIComponent(b.id)}`)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="outline" title="Delete" aria-label={`Delete ${b.name}`}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setToDelete(b)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="block text-right text-xs text-muted-foreground">Deleted</span>
                      )}
                    </td>
                  </tr>
                ))
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

      {toDelete && (
        <ConfirmDialog
          title="Delete drug brand?"
          message={<>Delete <b className="text-foreground">{toDelete.name}</b>{toDelete.strength ? ` ${toDelete.strength}` : ""}? It will be marked inactive in the ERP and removed from doctors&apos; apps on their next sync.</>}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

function Field({ label, required, hint, error, children }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Skeleton() {
  return <div className="h-11 animate-pulse rounded-md bg-muted" />;
}

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}
