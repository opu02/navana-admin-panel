"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Pencil, RotateCcw, Save, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { Combobox } from "@/components/combobox";
import { cn } from "@/lib/utils";
import { apiFetch, ApiError } from "@/lib/client-api";
import { USER_TYPES, padNpl, userSchema, userUpdateSchema, type UserForm } from "@/lib/user-schema";

const EMPTY: UserForm = {
  name: "", email: "", username: "", password: "", type: "Doctor", specialty: "", designation: "",
  organization: "", chamber: "", address: "", npl: "", bmdc: "",
};

type FieldDef = { key: keyof UserForm; label: string; placeholder: string; required?: boolean; max: number; type?: string };

const FIELDS: FieldDef[][] = [
  [{ key: "name", label: "Name", placeholder: "Write name", required: true, max: 100 },
   { key: "email", label: "Email", placeholder: "Write email (optional)", max: 100, type: "email" }],
  [{ key: "username", label: "Username / Phone", placeholder: "Write username or phone", required: true, max: 50 }],
  [{ key: "designation", label: "Designation", placeholder: "Write designation", max: 150 },
   { key: "organization", label: "Organization", placeholder: "Write organization", max: 200 }],
  [{ key: "chamber", label: "Chamber", placeholder: "Write personal chamber", max: 200 },
   { key: "address", label: "Address", placeholder: "Write address", max: 300 }],
  [{ key: "npl", label: "NPL Number", placeholder: "e.g. BH2771 or 8371 (max 10)", max: 10 },
   { key: "bmdc", label: "BMDC", placeholder: "Write BMDC", max: 30 }],
];

/** Create (no editId) or edit a user. backTo = where to go after saving an edit. */
export function UserFormCard({ editId, backTo = "/users/admins", fixedType }: { editId?: string; backTo?: string; fixedType?: "Admin" }) {
  const empty: UserForm = { ...EMPTY, type: fixedType ?? EMPTY.type };
  const router = useRouter();
  const isEdit = editId !== undefined;
  const [original, setOriginal] = useState<UserForm>(empty);
  const [loadingItem, setLoadingItem] = useState(isEdit);
  const {
    register, handleSubmit, reset, watch, setError, setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UserForm>({ resolver: zodResolver(isEdit ? userUpdateSchema : userSchema), defaultValues: empty, mode: "onTouched" });
  const isDoctor = watch("type") === "Doctor";
  const specialty = watch("specialty") ?? "";
  const [specialties, setSpecialties] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<{ items: { name: string }[] }>("/api/master/speciality?pageSize=100")
      .then((d) => setSpecialties(d.items.map((x) => x.name)))
      .catch(() => setSpecialties([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    apiFetch<UserForm & { id: string; erpStatus?: string }>(`/api/users/${editId}`)
      .then((u) => {
        if (u.erpStatus === "synced") {
          toast.error("This doctor is saved in the ERP, which has no API to edit doctors yet.");
          router.replace(backTo);
          return;
        }
        const f: UserForm = {
          name: u.name, email: u.email, username: u.username, password: "", type: u.type,
          specialty: u.specialty ?? "", designation: u.designation ?? "", organization: u.organization ?? "",
          chamber: u.chamber ?? "", address: u.address ?? "", npl: u.npl ?? "", bmdc: u.bmdc ?? "",
        };
        setOriginal(f);
        reset(f);
        setLoadingItem(false);
      })
      .catch(() => {
        toast.error("User not found");
        router.replace(backTo);
      });
  }, [backTo, editId, isEdit, reset, router]);

  async function onSubmit(values: UserForm) {
    try {
      await apiFetch(isEdit ? `/api/users/${editId}` : "/api/users", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(values),
      });
      if (isEdit) {
        toast.success("User updated");
        router.push(backTo);
      } else {
        toast.success("Admin saved on the website (not in the ERP)");
        reset(empty);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Could not save the user.";
      if (e instanceof ApiError && e.status === 409) setError(msg.includes("NPL") ? "npl" : msg.includes("email") ? "email" : "username", { message: msg });
      else toast.error(msg);
    }
  }

  const input = (f: FieldDef) => (
    <div key={f.key} className="space-y-2">
      <Label htmlFor={f.key}>
        {f.label}
        {(f.required || (f.key === "npl" && isDoctor)) && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        id={f.key} type={f.type ?? "text"} placeholder={f.placeholder} maxLength={f.max} autoComplete="off"
        aria-invalid={!!errors[f.key]}
        className={cn("h-11", errors[f.key] && "border-destructive")}
        {...(f.key === "npl" ? { inputMode: "numeric" as const } : {})}
        {...register(f.key, f.key === "npl"
          ? { onBlur: (e) => setValue("npl", padNpl(e.target.value.trim()) || e.target.value.trim(), { shouldValidate: true, shouldDirty: true }) }
          : undefined)}
      />
      {errors[f.key] ? <p className="text-xs text-destructive">{errors[f.key]?.message}</p>
             : f.key === "npl" && <p className="text-xs text-muted-foreground">Always 10 characters. With 2 letters, 0s go after the letters (BH2771 → BH00002771). Digits only: 0s go in front (8371 → 0000008371).</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          <b>Admin users (and old doctor records) are saved on this website only.</b> The ERP has no API for them, so they
          are <b>not</b> on the server. Doctors created from the Doctor tab go to the ERP.
        </p>
      </div>

      <section className="rounded-xl border bg-background shadow-sm">
        <header className="flex items-center gap-3 border-b p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {isEdit ? <Pencil className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-semibold">{isEdit ? "Edit User" : "Create User"}</h3>
            <p className="text-sm text-muted-foreground">
              {isEdit ? "Leave the password empty to keep the old one" : "Add a new doctor or admin account"}
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          {loadingItem ? (
            <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
          <div className="grid gap-5 p-5 md:grid-cols-2">
            {FIELDS[0].map(input)}
            {input(FIELDS[1][0])}

            <div className="space-y-2">
              <Label htmlFor="password">{isEdit ? "New Password" : "Password"}{!isEdit && <span className="ml-0.5 text-destructive">*</span>}</Label>
              <PasswordInput
                id="password" placeholder={isEdit ? "Leave empty to keep the old password" : "Write password"} autoComplete="new-password"
                maxLength={100} aria-invalid={!!errors.password}
                className={cn("h-11", errors.password && "border-destructive")}
                {...register("password")}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type<span className="ml-0.5 text-destructive">*</span></Label>
              {fixedType ? (
                <Input id="type" value={fixedType} readOnly className="h-11 bg-muted/40" />
              ) : (
                <select id="type" {...register("type")} className="h-11 w-full cursor-pointer rounded-md border bg-background px-3 text-sm">
                  {USER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty">Specialty</Label>
              <Combobox
                id="specialty"
                options={specialties.map((n) => ({ value: n, label: n }))}
                value={specialty}
                selectedLabel={specialty}
                placeholder="Select specialty"
                searchPlaceholder="Search specialty..."
                onChange={(v) => setValue("specialty", v, { shouldDirty: true, shouldValidate: true })}
                onCreate={(t) => setValue("specialty", t.slice(0, 150), { shouldDirty: true, shouldValidate: true })}
                invalid={!!errors.specialty}
              />
              {errors.specialty && <p className="text-xs text-destructive">{errors.specialty.message}</p>}
            </div>

            {FIELDS.slice(2).flat().map(input)}
          </div>
          )}

          <footer className="flex items-center justify-end gap-2 rounded-b-xl border-t bg-muted/30 px-5 py-4">
            {isEdit && (
              <Button type="button" variant="ghost" className="mr-auto" onClick={() => router.push(backTo)} disabled={isSubmitting}>
                <X className="mr-1.5 h-4 w-4" /> Cancel
              </Button>
            )}
            <Button type="button" variant="outline" disabled={isSubmitting || !isDirty} onClick={() => reset(original)}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
            </Button>
            <Button type="submit" disabled={isSubmitting || loadingItem || (isEdit && !isDirty)}>
              {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              {isEdit ? "Update" : "Save"}
            </Button>
          </footer>
        </form>
      </section>
    </div>
  );
}
