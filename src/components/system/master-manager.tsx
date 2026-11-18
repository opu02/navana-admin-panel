"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Inbox, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { banglaKeyDown, convertWordBeforeCursor, toBangla } from "@/lib/bangla-typing";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/report-ui";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { apiFetch, ApiError } from "@/lib/client-api";
import { MASTER, type MasterItem, type MasterKey, type MasterListResponse } from "@/lib/master-config";
import { masterSchema, type MasterForm } from "@/lib/master-schema";

const PAGE_SIZES = [10, 25, 50, 100];
const EMPTY: MasterForm = { name: "", extra: "" };

/** Reusable Add/Edit + list page for ERP name lists */
export function MasterManager({ listKey, editId }: { listKey: MasterKey; editId?: string }) {
  const cfg = MASTER[listKey];
  const api = `/api/master/${listKey}`;
  const router = useRouter();
  const isEdit = editId !== undefined;
  const nameRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const nameLabel = cfg.nameLabel ?? "Name";

  const [showInactive, setShowInactive] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<MasterListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState({ n: 0, force: false });
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [original, setOriginal] = useState<MasterForm | null>(null);
  const [loadingItem, setLoadingItem] = useState(isEdit);
  const [toDelete, setToDelete] = useState<MasterItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    register, handleSubmit, reset, setError: setFieldError, watch, setValue, getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<MasterForm>({ resolver: zodResolver(masterSchema), defaultValues: EMPTY, mode: "onTouched" });
  const { ref: rhfRef, ...nameField } = register("name");
  const nameLength = watch("name")?.length ?? 0;
  const { onBlur: extraOnBlur, ...extraField } = register("extra");

  // ---- বাংলা / English typing ----
  const bangla = !!cfg.banglaTyping;
  const [lang, setLang] = useState<"bn" | "en">("bn");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rx-typing-lang");
      if (saved === "en" || saved === "bn") setLang(saved);
    } catch {}
  }, []);
  const chooseLang = useCallback((l: "bn" | "en") => {
    setLang(l);
    try { localStorage.setItem("rx-typing-lang", l); } catch {}
  }, []);
  const typingBn = bangla && lang === "bn";
  const put = (field: "name" | "extra") => (v: string) => setValue(field, v, { shouldDirty: true, shouldValidate: !!errors[field] });
  /** Props that make a box type Bangla. Ctrl+M switches বাংলা / English. */
  const bnProps = (field: "name" | "extra") => ({
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!bangla) return;
      if (e.ctrlKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        chooseLang(lang === "bn" ? "en" : "bn");
        return;
      }
      if (typingBn) banglaKeyDown(e, put(field));
    },
    lang: typingBn ? "bn" : undefined,
  });
  /** On leaving the box, also convert the last word (no space typed after it) */
  const tailOnBlur = (field: "name" | "extra", el: HTMLInputElement | HTMLTextAreaElement) => {
    if (typingBn) {
      el.setSelectionRange(el.value.length, el.value.length);
      if (convertWordBeforeCursor(el)) put(field)(el.value);
    }
  };
  function convertAll() {
    const name = toBangla(getValues("name") ?? "");
    const extra = toBangla(getValues("extra") ?? "");
    setValue("name", name, { shouldDirty: true, shouldValidate: !!errors.name });
    if (cfg.extra) setValue("extra", extra, { shouldDirty: true });
    toast.success("Converted to Bangla");
  }

  useEffect(() => {
    if (!isEdit) return;
    setLoadingItem(true);
    apiFetch<MasterItem>(`${api}/${encodeURIComponent(editId!)}`)
      .then((it) => {
        const f = { name: it.name, extra: it.extra };
        setOriginal(f);
        reset(f);
        setLoadingItem(false);
        setTimeout(() => nameRef.current?.focus(), 0);
      })
      .catch(() => {
        toast.error("Item not found");
        router.replace(cfg.basePath);
      });
  }, [api, cfg.basePath, editId, isEdit, reset, router]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) p.set("search", search);
    if (showInactive) p.set("inactive", "1");
    if (reload.force) p.set("refresh", "1");
    setLoading(true);
    setError("");
    apiFetch<MasterListResponse>(`${api}?${p}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : "Could not load the list."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [api, search, showInactive, page, pageSize, reload]);

  async function onSubmit(values: MasterForm) {
    try {
      const saved = await apiFetch<MasterItem>(isEdit ? `${api}/${encodeURIComponent(editId!)}` : api, {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(values),
      });
      setHighlightId(saved.id);
      setTimeout(() => setHighlightId(null), 3000);
      if (isEdit) {
        toast.success(`${cfg.singular} updated`);
        router.push(cfg.basePath);
      } else {
        toast.success(`${cfg.singular} added`);
        reset(EMPTY);
        setSearchInput("");
        setPage(1);
        setReload((r) => ({ n: r.n + 1, force: false }));
        nameRef.current?.focus();
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Could not save. Please try again.";
      if (e instanceof ApiError && (e.status === 409 || e.status === 400)) setFieldError("name", { message: msg });
      else toast.error(msg);
    }
  }

  const confirmDelete = useCallback(async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await apiFetch(`${api}/${encodeURIComponent(toDelete.id)}`, { method: "DELETE" });
      toast.success(`"${toDelete.name}" deleted`);
      if (toDelete.id === editId) router.push(cfg.basePath);
      setToDelete(null);
      if (data && data.items.length === 1 && page > 1) setPage((p) => p - 1);
      else setReload((r) => ({ n: r.n + 1, force: false }));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not delete. Please try again.");
    } finally {
      setDeleting(false);
    }
  }, [api, cfg.basePath, toDelete, editId, router, data, page]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize;
  const showGroup = cfg.sectionId !== undefined;
  const cols = 4 + (cfg.extra ? 1 : 0) + (showGroup ? 1 : 0);

  return (
    <div className="mx-auto grid max-w-[1600px] gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
      {/* ---------- Form ---------- */}
      <section className="rounded-xl border bg-background shadow-sm lg:sticky lg:top-24">
        <header className="flex items-center gap-3 border-b p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {isEdit ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-semibold">{isEdit ? `Edit ${cfg.singular}` : `Add ${cfg.singular}`}</h3>
            <p className="text-sm text-muted-foreground">
              {cfg.local ? "Saved on this website only (the ERP has no API for this yet)." : "Saved to the ERP. Doctors get it on their next sync."}
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-5 p-5">
            {bangla && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Typing</span>
                  <div role="radiogroup" aria-label="Typing language" className="inline-flex rounded-md border bg-background p-0.5">
                    {(["bn", "en"] as const).map((l) => (
                      <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => chooseLang(l)}
                        className={cn("cursor-pointer rounded px-3 py-1 text-sm font-medium transition-colors",
                          lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                        {l === "bn" ? "বাংলা" : "English"}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {typingBn
                    ? <>Type Banglish, it turns into Bangla after each word. e.g. <span className="font-mono">khawar pore</span> → খাওয়ার পরে. Ctrl+M = English.</>
                    : <>Text stays in English as you type. Ctrl+M = বাংলা.</>}
                </p>
                <button type="button" onClick={convertAll} className="cursor-pointer text-xs font-medium text-primary hover:underline">
                  Convert pasted Banglish to বাংলা
                </button>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="name">{nameLabel}<span className="ml-0.5 text-destructive">*</span></Label>
                <span className="text-xs text-muted-foreground">{nameLength}/300</span>
              </div>
              {loadingItem ? <div className="h-11 animate-pulse rounded-md bg-muted" /> : cfg.nameMultiline ? (
                <Textarea
                  id="name" placeholder={`Write ${nameLabel.toLowerCase()}`} maxLength={300} rows={3}
                  aria-invalid={!!errors.name}
                  className={cn("resize-y", errors.name && "border-destructive")}
                  {...nameField}
                  {...bnProps("name")}
                  onBlur={(e) => { tailOnBlur("name", e.currentTarget); nameField.onBlur(e); }}
                  ref={(el) => { rhfRef(el); nameRef.current = el; }}
                />
              ) : (
                <Input
                  id="name" placeholder={`Write ${nameLabel.toLowerCase()}`} autoComplete="off" maxLength={300}
                  aria-invalid={!!errors.name}
                  className={cn("h-11", errors.name && "border-destructive")}
                  {...nameField}
                  {...bnProps("name")}
                  onBlur={(e) => { tailOnBlur("name", e.currentTarget); nameField.onBlur(e); }}
                  ref={(el) => { rhfRef(el); nameRef.current = el; }}
                />
              )}
              {errors.name && <p className="text-xs text-destructive">{errors.name.message?.replace(/^Name\b/, nameLabel)}</p>}
            </div>

            {cfg.extra && (
              <div className="space-y-2">
                <Label htmlFor="extra">{cfg.extra.label}</Label>
                {loadingItem ? <div className="h-11 animate-pulse rounded-md bg-muted" /> : cfg.extra.multiline ? (
                  <Textarea
                    id="extra" placeholder={cfg.extra.placeholder} maxLength={cfg.extra.max} rows={8}
                    aria-invalid={!!errors.extra}
                    className={cn("resize-y", errors.extra && "border-destructive")}
                    {...extraField}
                    {...bnProps("extra")}
                    onBlur={(e) => { tailOnBlur("extra", e.currentTarget); extraOnBlur(e); }}
                  />
                ) : (
                  <Input
                    id="extra" placeholder={cfg.extra.placeholder} autoComplete="off" maxLength={cfg.extra.max}
                    aria-invalid={!!errors.extra}
                    className={cn("h-11", errors.extra && "border-destructive")}
                    {...extraField}
                    {...bnProps("extra")}
                    onBlur={(e) => { tailOnBlur("extra", e.currentTarget); extraOnBlur(e); }}
                  />
                )}
                {errors.extra && <p className="text-xs text-destructive">{errors.extra.message}</p>}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-between gap-2 rounded-b-xl border-t bg-muted/30 px-5 py-4">
            {isEdit ? (
              <Button type="button" variant="ghost" onClick={() => router.push(cfg.basePath)} disabled={isSubmitting}>
                <X className="mr-1.5 h-4 w-4" /> Cancel
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={isSubmitting || !isDirty}
                onClick={() => { reset(original ?? EMPTY); nameRef.current?.focus(); }}>
                <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
              </Button>
              <Button type="submit" disabled={isSubmitting || loadingItem || (isEdit && !isDirty)}>
                {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                {isEdit ? "Update" : "Save"}
              </Button>
            </div>
          </footer>
        </form>
      </section>

      {/* ---------- List ---------- */}
      <section className="rounded-xl border bg-background shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Show</span>
            <select
              value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="h-10 cursor-pointer rounded-md border bg-background px-2 text-sm text-foreground"
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>entries</span>
            <label className="ml-2 flex cursor-pointer items-center gap-2 text-foreground">
              <input type="checkbox" checked={showInactive} onChange={(e) => { setShowInactive(e.target.checked); setPage(1); }} />
              Show deleted
            </label>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput} onChange={(e) => setSearchInput(e.target.value)} maxLength={100}
                placeholder="Search..." className="h-10 pl-9 pr-8"
              />
              {searchInput && (
                <button type="button" onClick={() => setSearchInput("")} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" title="Reload from the ERP"
              disabled={loading} onClick={() => setReload((r) => ({ n: r.n + 1, force: true }))}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="w-14 px-4 py-3">#</th>
                <th className="px-4 py-3">{nameLabel}</th>
                {cfg.extra && <th className="px-4 py-3">{cfg.extra.label}</th>}
                {showGroup && <th className="px-4 py-3">Group</th>}
                <th className="px-4 py-3">Author</th>
                <th className="w-28 px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={cn(loading && data && "opacity-50 transition-opacity")}>
              {loading && !data ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: cols }).map((__, j) => (
                      <td key={j} className="px-4 py-3.5"><div className="h-4 animate-pulse rounded bg-muted" /></td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={cols} className="px-4 py-16 text-center">
                    <p className="text-destructive">{error}</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setReload((r) => ({ n: r.n + 1, force: false }))}>
                      Try again
                    </Button>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={cols} className="px-4 py-16">
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Inbox className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium">{search ? `Nothing matches "${search}"` : "No items found"}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((it, i) => (
                  <tr key={it.id} className={cn(
                    "border-b align-top transition-colors last:border-0 hover:bg-muted/40",
                    it.id === editId && "bg-primary/5",
                    it.id === highlightId && "bg-emerald-50"
                  )}>
                    <td className="px-4 py-3 text-muted-foreground">{startIndex + i + 1}</td>
                    <td className="px-4 py-3 font-medium whitespace-pre-line">{it.name}</td>
                    {cfg.extra && (
                      <td className="px-4 py-3">
                        {it.extra ? (
                          <p className={cn("whitespace-pre-line", cfg.extra.multiline && "line-clamp-4 max-w-2xl")} title={it.extra}>{it.extra}</p>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    )}
                    {showGroup && <td className="px-4 py-3 text-muted-foreground">{it.group || "—"}</td>}
                    <td className="px-4 py-3">
                      {it.isSystem ? (
                        <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">System</span>
                      ) : (
                        <span className="text-muted-foreground">Doctor #{it.createdBy ?? "?"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {it.isActive ? (
                        <div className="flex justify-end gap-1.5">
                          <Button size="icon" variant="outline" className="h-8 w-8" title="Edit" aria-label={`Edit ${it.name}`}
                            onClick={() => router.push(`${cfg.basePath}/edit/${encodeURIComponent(it.id)}`)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="outline" title="Delete" aria-label={`Delete ${it.name}`}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setToDelete(it)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : <span className="block text-right text-xs text-muted-foreground">Deleted</span>}
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
          title={`Delete ${cfg.singular.toLowerCase()}?`}
          message={<>Delete <b className="text-foreground">{toDelete.name}</b>? It will be marked inactive in the ERP and removed from doctors&apos; apps on their next sync.</>}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
