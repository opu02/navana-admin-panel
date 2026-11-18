"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Building2, CheckCircle2, Inbox, Loader2, Pencil, RefreshCw, Search, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/report-ui";
import { cn } from "@/lib/utils";
import { apiFetch, ApiError } from "@/lib/client-api";
import { ChamberDialog, type Chamber } from "@/components/users/chamber-dialog";

type User = {
  id: string; name: string; email: string; username: string; type: "Admin" | "Doctor";
  designation: string; organization: string; specialty: string; npl: string; bmdc: string; chamber: string;
  isActive: boolean; createdAt: string; chambers?: Chamber[]; erpStatus?: "pending" | "synced";
};

const PAGE_SIZES = [10, 25, 50, 100];
const fmt = (iso: string) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" }).format(new Date(iso)) : "—";

/** List of Admin users or Doctors saved on the website */
export function UserList({ type }: { type: "Admin" | "Doctor" }) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [chamberOf, setChamberOf] = useState<User | null>(null);

  // refresh = true makes the server read the doctors from the ERP again (instead of its 15-minute copy)
  const load = useCallback(
    (refresh = false) => {
      setLoading(true);
      return apiFetch<User[]>(`/api/users?type=${type}&full=1${refresh ? "&refresh=1" : ""}`)
        .then((list) => {
          setUsers(list);
          if (refresh) toast.success("Doctor list reloaded from the ERP");
        })
        .catch((e) => toast.error(e instanceof ApiError ? e.message : "Could not load users"))
        .finally(() => setLoading(false));
    },
    [type]
  );
  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? users.filter((u) => [u.name, u.email, u.username, u.designation, u.organization, u.npl, u.npl?.replace(/^0+/, ""), u.bmdc, u.specialty, u.chamber, ...(u.chambers ?? []).map((c) => c.chamberName)].some((v) => v?.toLowerCase().includes(q)))
      : users;
  }, [users, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  async function toggleActive(u: User) {
    setBusyId(u.id);
    try {
      const saved = await apiFetch<User>(`/api/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !u.isActive }) });
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, isActive: saved.isActive } : x)));
      toast.success(`${u.name} ${saved.isActive ? "activated" : "deactivated"}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not change status");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/users/${toDelete.id}`, { method: "DELETE" });
      toast.success(`${toDelete.name} deleted`);
      setUsers((list) => list.filter((x) => x.id !== toDelete.id));
      setToDelete(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not delete");
    } finally {
      setDeleting(false);
    }
  }

  const back = type === "Doctor" ? "doctors" : "admins";
  const isDoctor = type === "Doctor";
  const cols = isDoctor ? 10 : 7;
  const dash = <span className="text-muted-foreground">—</span>;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
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
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} maxLength={100}
                placeholder={isDoctor ? "Search name, phone, NPL, BMDC..." : "Search name, email, phone..."} className="h-10 pl-9 pr-8" />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {isDoctor && (
              <Button variant="outline" className="h-10 shrink-0" disabled={loading} onClick={() => load(true)} title="Read the doctors from the ERP again">
                <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
              </Button>
            )}
            <Button className="h-10 shrink-0" onClick={() => router.push("/users/create")}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Add {type === "Admin" ? "Admin" : "Doctor"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={cn("w-full text-sm", isDoctor ? "min-w-[1250px]" : "min-w-[900px]")}>
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">{isDoctor ? "Phone" : "Phone / Username"}</th>
                {isDoctor ? (
                  <>
                    <th className="px-4 py-3">Specialty</th>
                    <th className="px-4 py-3">Chamber</th>
                    <th className="px-4 py-3">NPL</th>
                    <th className="px-4 py-3">BMDC</th>
                  </>
                ) : (
                  <th className="px-4 py-3">Details</th>
                )}
                <th className="px-4 py-3">{isDoctor ? "Register Date" : "Created at"}</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={cols} className="px-4 py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  {isDoctor && <p className="mt-3 text-xs text-muted-foreground">Loading doctors from the ERP. The first load can take up to a minute.</p>}
                </td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={cols} className="px-4 py-16">
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Inbox className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium">{search ? `Nothing matches "${search}"` : `No ${type.toLowerCase()} users yet`}</p>
                    </div>
                  </td>
                </tr>
              ) : items.map((u) => (
                <tr key={u.id} className={cn("border-b align-top last:border-0 hover:bg-muted/40", !u.isActive && "opacity-60")}>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", u.isActive ? "bg-emerald-500" : "bg-muted-foreground")} />
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {u.name}
                    {u.erpStatus === "synced" && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">In ERP</span>}
                    {isDoctor && u.erpStatus === "pending" && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700" title="Saved on this website only, not in the ERP">Website only</span>}
                  </td>
                  <td className="px-4 py-3">{u.email || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">{u.username}</td>
                  {isDoctor ? (
                    <>
                      <td className="px-4 py-3">{u.specialty || dash}</td>
                      <td className="px-4 py-3">
                        {u.chambers?.length ? (
                          <ul className="space-y-0.5">
                            {u.chambers.slice(0, 3).map((c) => <li key={c.chamberId} className="whitespace-nowrap">{c.chamberName}</li>)}
                            {u.chambers.length > 3 && <li className="text-xs text-muted-foreground">+{u.chambers.length - 3} more</li>}
                          </ul>
                        ) : u.chamber || dash}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{u.npl || dash}</td>
                      <td className="px-4 py-3 font-mono text-xs">{u.bmdc || dash}</td>
                    </>
                  ) : (
                    <td className="px-4 py-3 text-muted-foreground">
                      {[u.designation, u.organization].filter(Boolean).join(" · ") || "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmt(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-end gap-1.5">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" disabled={busyId === u.id || u.erpStatus === "synced"} onClick={() => toggleActive(u)}
                        title={u.erpStatus === "synced" ? "The ERP has no API to change this yet" : undefined}
                        className={cn("h-8", u.isActive ? "text-destructive hover:text-destructive" : "text-emerald-700 hover:text-emerald-700")}>
                        {busyId === u.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          : u.isActive ? <Ban className="mr-1 h-3.5 w-3.5" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                        {u.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button size="icon" variant="outline" className="h-8 w-8" disabled={u.erpStatus === "synced"}
                        title={u.erpStatus === "synced" ? "The ERP has no API to edit doctors yet" : "Edit"}
                        onClick={() => router.push(`/users/edit/${u.id}?back=${back}`)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="outline" disabled={u.erpStatus === "synced"} onClick={() => setToDelete(u)}
                        title={u.erpStatus === "synced" ? "The ERP has no API to delete doctors yet" : "Delete"}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {isDoctor && (
                      <Button size="sm" variant="outline" className="h-8 border-primary/40 text-primary hover:text-primary" onClick={() => setChamberOf(u)}>
                        <Building2 className="mr-1 h-3.5 w-3.5" />
                        {u.chambers?.length ? `Chambers (${u.chambers.length}) · Add` : "Add Chamber"}
                      </Button>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
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

      {chamberOf && (
        <ChamberDialog
          doctor={{ id: chamberOf.id, name: chamberOf.name, npl: chamberOf.npl, synced: chamberOf.erpStatus === "synced" }}
          chambers={chamberOf.chambers ?? []}
          onChange={(list) => {
            setChamberOf((d) => (d ? { ...d, chambers: list } : d));
            setUsers((all) => all.map((x) => (x.id === chamberOf.id ? { ...x, chambers: list } : x)));
          }}
          onClose={() => setChamberOf(null)}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete user?"
          message={<>Delete <b className="text-foreground">{toDelete.name}</b> ({toDelete.email || toDelete.username})? This can&apos;t be undone.</>}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
