"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FlaskConical, Inbox, Loader2, Pencil, Plus, RotateCcw, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/report-ui";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { genericSchema, type GenericForm } from "@/lib/generic-schema";

type Generic = { id: number; name: string };
type ListResponse = { items: Generic[]; total: number; page: number; pageSize: number };

const PAGE_SIZES = [10, 25, 50, 100];

export function GenericManager({ editId }: { editId?: number }) {
  const router = useRouter();
  const isEdit = editId !== undefined;
  const nameRef = useRef<HTMLInputElement | null>(null);

  // ----- list state -----
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  // ----- edit / delete state -----
  const [original, setOriginal] = useState<Generic | null>(null);
  const [loadingItem, setLoadingItem] = useState(isEdit);
  const [toDelete, setToDelete] = useState<Generic | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    register, handleSubmit, reset, setError: setFieldError, watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<GenericForm>({
    resolver: zodResolver(genericSchema),
    defaultValues: { name: "" },
    mode: "onTouched",
  });
  const { ref: rhfRef, ...nameField } = register("name");
  const nameLength = watch("name")?.length ?? 0;

  // load the item being edited
  useEffect(() => {
    if (!isEdit) return;
    const ctrl = new AbortController();
    setLoadingItem(true);
    fetch(`/api/generics/${editId}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((g: Generic) => {
        setOriginal(g);
        reset({ name: g.name });
        setLoadingItem(false);
        setTimeout(() => nameRef.current?.focus(), 0);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        toast.error("Generic not found");
        router.replace("/system/generic");
      });
    return () => ctrl.abort();
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
    const ctrl = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set("search", search);
    setLoading(true);
    setError("");
    fetch(`/api/generics?${params}`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ListResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setError("Could not load generics. Please try again.");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [search, page, pageSize, reloadKey]);

  async function onSubmit(values: GenericForm) {
    const res = await fetch(isEdit ? `/api/generics/${editId}` : "/api/generics", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null);

    if (!res) return toast.error("Network error. Please try again.");
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const message = body?.message ?? "Could not save. Please try again.";
      if (res.status === 400 || res.status === 409) setFieldError("name", { message });
      else toast.error(message);
      return;
    }

    const saved = body as Generic;
    setHighlightId(saved.id);
    setTimeout(() => setHighlightId(null), 3000);

    if (isEdit) {
      toast.success("Generic updated");
      router.push("/system/generic");
    } else {
      toast.success("Generic added");
      reset({ name: "" });
      setSearchInput("");
      setSearch("");
      setPage(1);
      setReloadKey((k) => k + 1);
      nameRef.current?.focus();
    }
  }

  function onReset() {
    reset({ name: original?.name ?? "" });
    nameRef.current?.focus();
  }

  const confirmDelete = useCallback(async () => {
    if (!toDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/generics/${toDelete.id}`, { method: "DELETE" }).catch(() => null);
    setDeleting(false);
    if (!res?.ok) return toast.error("Could not delete. Please try again.");
    toast.success(`"${toDelete.name}" deleted`);
    const wasEditing = toDelete.id === editId;
    setToDelete(null);
    if (wasEditing) router.push("/system/generic");
    // go back a page if we removed the last row of this page
    if (data && data.items.length === 1 && page > 1) setPage((p) => p - 1);
    else setReloadKey((k) => k + 1);
  }, [toDelete, editId, router, data, page]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize;

  return (
    <div className="mx-auto grid max-w-[1600px] gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
      {/* ---------- Form ---------- */}
      <section className="rounded-xl border bg-background shadow-sm lg:sticky lg:top-24">
        <header className="flex items-center gap-3 border-b p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {isEdit ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-semibold">{isEdit ? "Edit Generic" : "Add Generic"}</h3>
            <p className="text-sm text-muted-foreground">
              {isEdit ? "Change the name and save" : "Add a new generic name"}
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <Label htmlFor="name">Name</Label>
              <span className="text-xs text-muted-foreground">{nameLength}/300</span>
            </div>
            {loadingItem ? (
              <div className="h-11 animate-pulse rounded-md bg-muted" />
            ) : (
              <Input
                id="name"
                placeholder="Write generic name"
                autoComplete="off"
                maxLength={300}
                aria-invalid={!!errors.name}
                className={cn("h-11", errors.name && "border-destructive focus-visible:ring-destructive/30")}
                {...nameField}
                ref={(el) => {
                  rhfRef(el);
                  nameRef.current = el;
                }}
              />
            )}
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <footer className="flex items-center justify-between gap-2 rounded-b-xl border-t bg-muted/30 px-5 py-4">
            {isEdit ? (
              <Button type="button" variant="ghost" onClick={() => router.push("/system/generic")} disabled={isSubmitting}>
                <X className="mr-1.5 h-4 w-4" /> Cancel
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onReset} disabled={isSubmitting || !isDirty}>
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
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="h-10 cursor-pointer rounded-md border bg-background px-2 text-sm text-foreground"
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>entries</span>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              maxLength={100}
              placeholder="Search generic..."
              className="h-10 pl-9 pr-8"
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="w-16 px-4 py-3">#</th>
                <th className="px-4 py-3">Name</th>
                <th className="w-32 px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={cn(loading && data && "opacity-50 transition-opacity")}>
              {loading && !data ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3.5"><div className="h-4 w-6 animate-pulse rounded bg-muted" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /></td>
                    <td className="px-4 py-3.5"><div className="ml-auto h-8 w-20 animate-pulse rounded bg-muted" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={3} className="px-4 py-16 text-center">
                    <p className="text-destructive">{error}</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setReloadKey((k) => k + 1)}>
                      Try again
                    </Button>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-16">
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        {search ? <Inbox className="h-6 w-6 text-muted-foreground" /> : <FlaskConical className="h-6 w-6 text-muted-foreground" />}
                      </div>
                      <p className="font-medium">{search ? `No generic matches "${search}"` : "No generics yet"}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((g, i) => (
                  <tr
                    key={g.id}
                    className={cn(
                      "border-b transition-colors last:border-0 hover:bg-muted/40",
                      g.id === editId && "bg-primary/5",
                      g.id === highlightId && "bg-emerald-50"
                    )}
                  >
                    <td className="px-4 py-3 text-muted-foreground">{startIndex + i + 1}</td>
                    <td className="px-4 py-3 font-medium">{g.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="icon" variant="outline" className="h-8 w-8" title="Edit" aria-label={`Edit ${g.name}`}
                          onClick={() => router.push(`/system/generic/edit/${g.id}`)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="outline"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          title="Delete" aria-label={`Delete ${g.name}`}
                          onClick={() => setToDelete(g)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
          title="Delete generic?"
          message={<>Are you sure you want to delete <b className="text-foreground">{toDelete.name}</b>? This can&apos;t be undone.</>}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
