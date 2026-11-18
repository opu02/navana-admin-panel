"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/client-api";

export type Chamber = { chamberId: number; docCode: string; chamberName: string; chamberAddress: string; erpStatus?: "pending" | "synced" };

type Props = {
  doctor: { id: string; name: string; npl: string; synced?: boolean }; // synced = saved in the ERP: chambers can only be added
  chambers: Chamber[];
  onChange: (list: Chamber[]) => void;
  onClose: () => void;
};

/** Add / edit / delete the chambers of one doctor. The app shows these in its chamber dropdown. */
export function ChamberDialog({ doctor, chambers, onChange, onClose }: Props) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  function startEdit(c: Chamber) {
    setEditId(c.chamberId);
    setName(c.chamberName);
    setAddress(c.chamberAddress);
    setError("");
    nameRef.current?.focus();
  }
  function clearForm() {
    setEditId(null);
    setName("");
    setAddress("");
    setError("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Chamber name is required");
    setSaving(true);
    setError("");
    try {
      const body = JSON.stringify({ chamberName: name, chamberAddress: address });
      if (editId === null) {
        const c = await apiFetch<Chamber>(`/api/users/${doctor.id}/chambers`, { method: "POST", body });
        onChange([...chambers, c]);
        toast.success("Chamber added");
      } else {
        const c = await apiFetch<Chamber>(`/api/users/${doctor.id}/chambers/${editId}`, { method: "PUT", body });
        onChange(chambers.map((x) => (x.chamberId === c.chamberId ? c : x)));
        toast.success("Chamber updated");
      }
      clearForm();
      nameRef.current?.focus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the chamber");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    setDeletingId(id);
    try {
      await apiFetch(`/api/users/${doctor.id}/chambers/${id}`, { method: "DELETE" });
      onChange(chambers.filter((x) => x.chamberId !== id));
      if (editId === id) clearForm();
      toast.success("Chamber deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="chamber-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 id="chamber-title" className="text-lg font-semibold">Chambers of {doctor.name}</h3>
              <p className="text-sm text-muted-foreground">
                NPL <span className="font-mono">{doctor.npl || "—"}</span> · {chambers.length} chamber{chambers.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {doctor.synced && (
            <p className="mb-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              This doctor is saved in the ERP. New chambers are sent to the ERP; existing ones can&apos;t be edited or deleted here yet.
            </p>
          )}
          {chambers.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No chambers yet. Add the first one below.
            </p>
          ) : (
            <ul className="space-y-2">
              {chambers.map((c, i) => (
                <li key={c.chamberId} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${editId === c.chamberId ? "border-primary bg-primary/5" : ""}`}>
                  <div className="min-w-0">
                    <p className="font-medium">
                      {c.chamberName}
                      {i === 0 && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Default in app</span>}
                    </p>
                    {c.chamberAddress && (
                      <p className="mt-0.5 flex items-start gap-1 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{c.chamberAddress}</p>
                    )}
                    {c.erpStatus !== "synced" && <p className="mt-0.5 font-mono text-xs text-muted-foreground">ID {c.chamberId}</p>}
                  </div>
                  {confirmId === c.chamberId ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Delete?</span>
                      <Button size="sm" variant="destructive" className="h-8" disabled={deletingId === c.chamberId} onClick={() => remove(c.chamberId)}>
                        {deletingId === c.chamberId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Yes"}
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setConfirmId(null)}>No</Button>
                    </div>
                  ) : doctor.synced ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">In ERP</span>
                  ) : (
                    <div className="flex shrink-0 gap-1.5">
                      <Button size="icon" variant="outline" className="h-8 w-8" title="Edit" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="outline" title="Delete" onClick={() => setConfirmId(c.chamberId)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={save} className="space-y-3 border-t bg-muted/30 p-5">
          <p className="text-sm font-semibold">{editId === null ? "Add Chamber" : "Edit Chamber"}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ch-name">Chamber Name<span className="ml-0.5 text-destructive">*</span></Label>
              <Input id="ch-name" ref={nameRef} value={name} maxLength={150} placeholder="e.g. Popular Diagnostic, Dhanmondi"
                onChange={(e) => setName(e.target.value)} className="h-10" aria-invalid={!!error} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-addr">Address</Label>
              <Input id="ch-addr" value={address} maxLength={300} placeholder="Write address"
                onChange={(e) => setAddress(e.target.value)} className="h-10" />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            {editId !== null && <Button type="button" variant="outline" onClick={clearForm}>Cancel edit</Button>}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              {editId === null ? "Add Chamber" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
