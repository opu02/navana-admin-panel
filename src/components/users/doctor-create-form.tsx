"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plus, RotateCcw, Save, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/combobox";
import { cn } from "@/lib/utils";
import { apiFetch, ApiError } from "@/lib/client-api";
import { PasswordInput } from "@/components/password-input";
import { doctorCreateSchema, padNpl, type DoctorCreateForm } from "@/lib/user-schema";

const EMPTY: DoctorCreateForm = {
  type: "Doctor", name: "", email: "", phone: "", password: "", specialty: "", designation: "",
  organization: "", address: "", npl: "", bmdc: "", chambers: [{ name: "", address: "" }],
};

type TextKey = "name" | "email" | "designation" | "organization" | "address" | "bmdc";
type TextField = { key: TextKey; label: string; placeholder: string; max: number; required?: boolean; type?: string };

const F: Record<TextKey, TextField> = {
  name: { key: "name", label: "Name", placeholder: "Write name", max: 100, required: true },
  email: { key: "email", label: "Email", placeholder: "Write email (optional)", max: 100, type: "email" },
  designation: { key: "designation", label: "Designation", placeholder: "Write designation", max: 150 },
  organization: { key: "organization", label: "Organization", placeholder: "Write organization", max: 200 },
  address: { key: "address", label: "Address", placeholder: "Write address", max: 300 },
  bmdc: { key: "bmdc", label: "BMDC", placeholder: "Write BMDC", max: 30 },
};

/** Create User → Doctor. Saved in the ERP (user-create + rx-doctor-chamber); the extra fields are kept on this website. */
export function DoctorCreateCard() {
  const router = useRouter();
  const {
    register, handleSubmit, reset, control, setError, setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DoctorCreateForm>({ resolver: zodResolver(doctorCreateSchema), defaultValues: EMPTY, mode: "onTouched" });
  const { fields, append, remove } = useFieldArray({ control, name: "chambers" });
  const specialty = useWatch({ control, name: "specialty" }) ?? "";
  const [specialties, setSpecialties] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<{ items: { name: string }[] }>("/api/master/speciality?pageSize=100")
      .then((d) => setSpecialties(d.items.map((x) => x.name)))
      .catch(() => setSpecialties([]));
  }, []);

  async function onSubmit(values: DoctorCreateForm) {
    try {
      const res = await apiFetch<{ name: string; warnings?: string[] }>("/api/users", {
        method: "POST",
        body: JSON.stringify(values),
      });
      if (res.warnings?.length) {
        toast.warning(`${res.name} was created in the ERP, but something needs your attention`, { description: res.warnings.join("\n"), duration: 12000 });
      } else {
        toast.success(`${res.name} was created in the ERP`);
      }
      reset(EMPTY);
      router.refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Could not create the doctor.";
      if (e instanceof ApiError && e.status === 409) setError(/npl/i.test(msg) ? "npl" : /email/i.test(msg) ? "email" : "phone", { message: msg });
      else toast.error(msg);
    }
  }

  const chambersError =
    errors.chambers?.root?.message ?? (errors.chambers as { message?: string } | undefined)?.message;

  const text = (f: TextField, wrap = "") => (
    <div key={f.key} className={cn("space-y-2", wrap)}>
      <Label htmlFor={f.key}>
        {f.label}
        {f.required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input id={f.key} type={f.type ?? "text"} placeholder={f.placeholder} maxLength={f.max} autoComplete="off"
        aria-invalid={!!errors[f.key]} className={cn("h-11", errors[f.key] && "border-destructive")} {...register(f.key)} />
      {errors[f.key] && <p className="text-xs text-destructive">{errors[f.key]?.message}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          <b>Doctors are saved in the ERP.</b> The ERP takes only the name, phone, NPL number and chambers. Email,
          specialty, designation, organization, address and BMDC are saved on this website next to the ERP doctor. A doctor can&apos;t be edited or deleted from here (the ERP has no API for that yet),
          but more chambers can be added from the Doctor List.
        </p>
      </div>

      <section className="rounded-xl border bg-background shadow-sm">
        <header className="flex items-center gap-3 border-b p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Create Doctor</h3>
            <p className="text-sm text-muted-foreground">A doctor can have as many chambers as he needs</p>
          </div>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <div className="grid gap-5 p-5 md:grid-cols-2">
            {text(F.name)}
            {text(F.email)}

            <div className="space-y-2">
              <Label htmlFor="phone">Username / Phone<span className="ml-0.5 text-destructive">*</span></Label>
              <Input id="phone" type="tel" inputMode="numeric" placeholder="e.g. 01712345678" maxLength={11} autoComplete="off"
                aria-invalid={!!errors.phone} className={cn("h-11", errors.phone && "border-destructive")} {...register("phone")} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password<span className="ml-0.5 text-destructive">*</span></Label>
              <PasswordInput id="password" placeholder="Write password" autoComplete="new-password" maxLength={100}
                aria-invalid={!!errors.password} className={cn("h-11", errors.password && "border-destructive")} {...register("password")} />
              {errors.password
                ? <p className="text-xs text-destructive">{errors.password.message}</p>
                : <p className="text-xs text-muted-foreground">For now the app login password is the phone number, until the ERP saves this password.</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type<span className="ml-0.5 text-destructive">*</span></Label>
              <Input id="type" value="Doctor" readOnly className="h-11 bg-muted/40" />
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

            {text(F.designation)}
            {text(F.organization)}
            {text(F.address, "md:col-span-2")}

            <div className="space-y-2">
              <Label htmlFor="npl">NPL Number<span className="ml-0.5 text-destructive">*</span></Label>
              <Input id="npl" placeholder="e.g. BH2771 or 8371 (max 10)" maxLength={10} autoComplete="off" inputMode="text"
                aria-invalid={!!errors.npl} className={cn("h-11", errors.npl && "border-destructive")}
                {...register("npl", {
                  onBlur: (e) => setValue("npl", padNpl(e.target.value.trim()) || e.target.value.trim(), { shouldValidate: true, shouldDirty: true }),
                })} />
              {errors.npl ? <p className="text-xs text-destructive">{errors.npl.message}</p>
                : <p className="text-xs text-muted-foreground">Always 10 characters. With 2 letters, 0s go after the letters (BH2771 → BH00002771). Digits only: 0s go in front (8371 → 0000008371).</p>}
            </div>
            {text(F.bmdc)}
          </div>

          <div className="space-y-3 border-t p-5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Chambers <span className="font-normal text-muted-foreground">({fields.length})</span></h4>
              <Button type="button" variant="outline" size="sm" disabled={isSubmitting}
                onClick={() => append({ name: "", address: "" })}>
                <Plus className="mr-1.5 h-4 w-4" /> Add another chamber
              </Button>
            </div>

            {fields.map((f, i) => (
              <div key={f.id} className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor={`chambers.${i}.name`}>Chamber name<span className="ml-0.5 text-destructive">*</span></Label>
                  <Input id={`chambers.${i}.name`} placeholder="e.g. Prime Hospital & Diagnostic Center" maxLength={150} autoComplete="off"
                    aria-invalid={!!errors.chambers?.[i]?.name}
                    className={cn("h-11", errors.chambers?.[i]?.name && "border-destructive")} {...register(`chambers.${i}.name`)} />
                  {errors.chambers?.[i]?.name && <p className="text-xs text-destructive">{errors.chambers[i]?.name?.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`chambers.${i}.address`}>Chamber address</Label>
                  <Input id={`chambers.${i}.address`} placeholder="e.g. Madhabpur, Habiganj" maxLength={300} autoComplete="off"
                    aria-invalid={!!errors.chambers?.[i]?.address}
                    className={cn("h-11", errors.chambers?.[i]?.address && "border-destructive")} {...register(`chambers.${i}.address`)} />
                  {errors.chambers?.[i]?.address && <p className="text-xs text-destructive">{errors.chambers[i]?.address?.message}</p>}
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-destructive"
                    disabled={fields.length === 1 || isSubmitting} onClick={() => remove(i)} aria-label={`Remove chamber ${i + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {chambersError && <p className="text-xs text-destructive">{chambersError}</p>}
          </div>

          <footer className="flex items-center justify-end gap-2 rounded-b-xl border-t bg-muted/30 px-5 py-4">
            <Button type="button" variant="outline" disabled={isSubmitting || !isDirty} onClick={() => reset(EMPTY)}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              {isSubmitting ? "Saving to ERP..." : "Save"}
            </Button>
          </footer>
        </form>
      </section>
    </div>
  );
}