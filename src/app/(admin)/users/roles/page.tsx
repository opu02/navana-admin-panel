"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2, Pencil, Plus, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/combobox";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { apiFetch, ApiError } from "@/lib/client-api";
import { ACTIONS, ACTION_LABEL, type Action, type Permissions, type Role, type UserOption } from "@/lib/role-types";

export default function UserRolePage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  // ----- add / edit role -----
  const [editing, setEditing] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [formError, setFormError] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const [toDelete, setToDelete] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ----- set user role -----
  const [userId, setUserId] = useState("");
  const [perms, setPerms] = useState<Permissions>({});
  const [savedPerms, setSavedPerms] = useState<string>("{}");
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  const loadRoles = useCallback(() => apiFetch<Role[]>("/api/roles").then(setRoles), []);

  useEffect(() => {
    Promise.all([loadRoles(), apiFetch<UserOption[]>("/api/users").then(setUsers)])
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Could not load roles"))
      .finally(() => setLoading(false));
  }, [loadRoles]);

  useEffect(() => {
    if (!userId) {
      setPerms({});
      setSavedPerms("{}");
      return;
    }
    setLoadingPerms(true);
    apiFetch<Permissions>(`/api/roles/permissions?userId=${encodeURIComponent(userId)}`)
      .then((p) => {
        setPerms(p);
        setSavedPerms(JSON.stringify(p));
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Could not load permissions"))
      .finally(() => setLoadingPerms(false));
  }, [userId]);

  // ----- role form -----
  function startEdit(r: Role) {
    setEditing(r);
    setName(r.name);
    setActions(r.actions);
    setFormError("");
  }
  function clearForm() {
    setEditing(null);
    setName("");
    setActions([]);
    setFormError("");
  }
  function toggleAction(a: Action) {
    setActions((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]));
  }

  async function saveRole() {
    if (!name.trim()) return setFormError("Role name is required");
    if (actions.length === 0) return setFormError("Please select at least one role type");
    setSavingRole(true);
    try {
      const body = JSON.stringify({ name: name.trim(), actions: ACTIONS.filter((a) => actions.includes(a)) });
      await apiFetch(editing ? `/api/roles/${editing.id}` : "/api/roles", { method: editing ? "PUT" : "POST", body });
      toast.success(editing ? "Role updated" : "Role added");
      clearForm();
      await loadRoles();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Could not save the role");
    } finally {
      setSavingRole(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/roles/${toDelete.id}`, { method: "DELETE" });
      toast.success(`"${toDelete.name}" deleted`);
      if (editing?.id === toDelete.id) clearForm();
      setToDelete(null);
      await loadRoles();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not delete");
    } finally {
      setDeleting(false);
    }
  }

  // ----- permission matrix -----
  const isOn = (roleId: string, a: Action) => perms[roleId]?.[a] === true;
  function setOne(roleId: string, a: Action, value: boolean) {
    setPerms((p) => ({ ...p, [roleId]: { ...p[roleId], [a]: value } }));
  }
  const columnAllOn = (a: Action) => {
    const rs = roles.filter((r) => r.actions.includes(a));
    return rs.length > 0 && rs.every((r) => isOn(r.id, a));
  };
  function setColumn(a: Action, value: boolean) {
    setPerms((p) => {
      const next = { ...p };
      for (const r of roles) if (r.actions.includes(a)) next[r.id] = { ...next[r.id], [a]: value };
      return next;
    });
  }
  const allOn = roles.length > 0 && roles.every((r) => r.actions.every((a) => isOn(r.id, a)));
  function setAll(value: boolean) {
    const next: Permissions = {};
    for (const r of roles) next[r.id] = Object.fromEntries(r.actions.map((a) => [a, value]));
    setPerms(next);
  }

  const dirty = useMemo(() => JSON.stringify(perms) !== savedPerms, [perms, savedPerms]);

  async function savePermissions() {
    if (!userId) return toast.error("Please select a user first");
    setSavingPerms(true);
    try {
      const saved = await apiFetch<Permissions>("/api/roles/permissions", {
        method: "PUT",
        body: JSON.stringify({ userId, permissions: perms }),
      });
      setPerms(saved);
      setSavedPerms(JSON.stringify(saved));
      toast.success("User role saved");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSavingPerms(false);
    }
  }

  const userOptions = users.map((u) => ({ value: u.id, label: u.name, hint: u.type }));

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          <b>Roles are saved on this website only for now.</b> The ERP has no API for roles or users yet, so the
          user list shows users created on this website, and these permissions are not used by the app yet.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start">
        {/* ================= Left: add role + role list ================= */}
        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border bg-background shadow-sm">
            <header className="flex items-center gap-3 border-b p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {editing ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </div>
              <h3 className="font-semibold">{editing ? "Edit Role" : "Add Role Name"}</h3>
            </header>
            <div className="space-y-5 p-5">
              <div className="space-y-2">
                <Label htmlFor="roleName">Role Name<span className="ml-0.5 text-destructive">*</span></Label>
                <Input
                  id="roleName" value={name} maxLength={100} placeholder="Write role name"
                  onChange={(e) => { setName(e.target.value); setFormError(""); }}
                  className={cn("h-11", formError && !name.trim() && "border-destructive")}
                />
              </div>
              <div className="space-y-2">
                <Label>Role Type<span className="ml-0.5 text-destructive">*</span></Label>
                <div className="flex flex-wrap gap-2">
                  {ACTIONS.map((a) => {
                    const on = actions.includes(a);
                    return (
                      <button
                        key={a} type="button" onClick={() => { toggleAction(a); setFormError(""); }}
                        className={cn(
                          "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                          on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                        {ACTION_LABEL[a]}
                      </button>
                    );
                  })}
                </div>
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>
            <footer className="flex justify-end gap-2 rounded-b-xl border-t bg-muted/30 px-5 py-4">
              {editing && (
                <Button variant="ghost" onClick={clearForm} disabled={savingRole}>
                  <X className="mr-1.5 h-4 w-4" /> Cancel
                </Button>
              )}
              <Button onClick={saveRole} disabled={savingRole}>
                {savingRole ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                {editing ? "Update Role" : "Add New Role"}
              </Button>
            </footer>
          </section>

          <section className="rounded-xl border bg-background shadow-sm">
            <header className="border-b p-5">
              <h3 className="font-semibold">Role List</h3>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="w-12 px-4 py-3">#</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role Type</th>
                    <th className="w-24 px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="px-4 py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
                  ) : roles.map((r, i) => (
                    <tr key={r.id} className={cn("border-b align-top last:border-0 hover:bg-muted/40", editing?.id === r.id && "bg-primary/5")}>
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {r.actions.map((a) => (
                            <span key={a} className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                              {ACTION_LABEL[a]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button size="icon" variant="outline" className="h-8 w-8" title="Edit" onClick={() => startEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="outline" title="Delete" onClick={() => setToDelete(r)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* ================= Right: set user role ================= */}
        <section className="min-w-0 overflow-hidden rounded-xl border bg-background shadow-sm">
          <header className="flex items-center gap-3 border-b bg-primary p-5 text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
            <h3 className="font-semibold">Set User Role</h3>
          </header>

          <div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-end md:justify-between">
            <Toggle
              big on={allOn} disabled={!userId || loadingPerms}
              onChange={(v) => setAll(v)} label={allOn ? "All Enabled" : "All Disabled"}
            />
            <div className="w-full space-y-2 md:w-80">
              <Label>Role Set User</Label>
              <Combobox
                options={userOptions} value={userId} placeholder="Select user" searchPlaceholder="Search user..."
                emptyText="No users yet — create one in Create User" onChange={(v) => setUserId(v)}
              />
            </div>
          </div>

          {!userId && (
            <div className="border-b bg-sky-50 px-5 py-3 text-sm text-sky-900">
              {users.length === 0 ? (
                <>No users yet. First add a user in{" "}
                  <a href="/users/create" className="font-semibold underline">Create User</a>, then select them here to turn switches on/off.</>
              ) : (
                <>Select a user in <b>Role Set User</b> to turn the switches on or off.</>
              )}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-44 px-4 py-3 text-right font-semibold">Segment</th>
                  {ACTIONS.map((a) => (
                    <th key={a} className="px-2 py-3 text-left">
                      <Toggle
                        small on={columnAllOn(a)} disabled={!userId || loadingPerms}
                        onChange={(v) => setColumn(a, v)}
                        label={`All ${ACTION_LABEL[a].replace("Only ", "")}`}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={cn(loadingPerms && "opacity-50")}>
                {roles.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-right font-medium">{r.name}</td>
                    {ACTIONS.map((a) => (
                      <td key={a} className="px-2 py-2.5">
                        {r.actions.includes(a) && (
                          <Toggle
                            on={isOn(r.id, a)} disabled={!userId || loadingPerms}
                            onChange={(v) => setOne(r.id, a, v)}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="flex items-center justify-between gap-3 rounded-b-xl border-t bg-muted/30 px-5 py-4">
            <p className="text-sm text-muted-foreground">
              {!userId ? "Select a user to set permissions." : dirty ? "You have unsaved changes." : "All changes saved."}
            </p>
            <Button onClick={savePermissions} disabled={!userId || !dirty || savingPerms}>
              {savingPerms ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Save &amp; Change
            </Button>
          </footer>
        </section>
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Delete role?"
          message={<>Delete <b className="text-foreground">{toDelete.name}</b>? It will also be removed from every user&apos;s permissions.</>}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

/** On/Off switch */
function Toggle({ on, onChange, disabled, label, small, big }: {
  on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string; small?: boolean; big?: boolean;
}) {
  return (
    <button
      type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        big ? "px-4 py-2 text-sm" : small ? "px-2.5 py-1 text-xs" : "px-1 py-1 text-xs",
        on ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "bg-background text-muted-foreground hover:bg-muted"
      )}
    >
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-emerald-500" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
      </span>
      <span className={cn(!label && "pr-1.5")}>{label ?? (on ? "On" : "Off")}</span>
    </button>
  );
}
