"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PasswordInput } from "@/components/password-input";
import { logout } from "@/components/admin/topbar";
import { clearMe, initials, useMe } from "@/components/admin/use-me";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

// ---------------- Validation rules ----------------
const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .regex(/^01[3-9]\d{8}$/, "Enter a valid phone number (e.g. 01712345678)"),
  email: z.string().trim().min(1, "Email is required").email("Please enter a valid email").max(100),
  details: z.string().max(500, "Details can be at most 500 characters"),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z
      .string()
      .min(1, "New password is required")
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password is too long")
      .regex(/[A-Z]/, "Add at least one uppercase letter (A–Z)")
      .regex(/[a-z]/, "Add at least one lowercase letter (a–z)")
      .regex(/\d/, "Add at least one number (0–9)")
      .regex(/[^A-Za-z0-9]/, "Add at least one special character (!@#$...)"),
    confirmPassword: z.string().min(1, "Please type the new password again"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((d) => d.newPassword !== d.oldPassword, {
    path: ["newPassword"],
    message: "New password must be different from the old one",
  });
type PasswordForm = z.infer<typeof passwordSchema>;

// ---------------- Page ----------------
export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard />
        <PasswordCard />
      </div>
    </div>
  );
}

// ---------------- Profile card ----------------
function ProfileCard() {
  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", phone: "", email: "", details: "" },
    mode: "onTouched",
  });

  const detailsLength = watch("details")?.length ?? 0;

  // Fill the form with the logged-in ERP user's real data
  const me = useMe();
  useEffect(() => {
    if (me) reset({ name: me.name ?? "", phone: me.phone ?? "", email: me.email ?? "", details: "" });
  }, [me, reset]);

  async function onSubmit(data: ProfileForm) {
    try {
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.message ?? "Could not update profile. Please try again.");
        return;
      }
      reset(data); // new saved values become the baseline
      toast.success("Profile updated successfully");
      clearMe(); // show the new name in the sidebar / top bar
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast.error("Could not update profile. Please try again.");
    }
  }

  return (
    <section className="flex flex-col rounded-xl border bg-background shadow-sm">
      <header className="flex items-center gap-4 border-b p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          {initials(me?.name)}
        </div>
        <div>
          <h3 className="font-semibold">Personal information</h3>
          <p className="text-sm text-muted-foreground">Your name and contact details</p>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col">
        <div className="flex-1 space-y-5 p-6">
          <Field label="Name" htmlFor="name" error={errors.name?.message}>
            <IconInput icon={UserRound}>
              <Input id="name" placeholder="Your full name" aria-invalid={!!errors.name}
                className={inputCls(!!errors.name, "pl-9")} {...register("name")} />
            </IconInput>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
              <IconInput icon={Phone}>
                <Input id="phone" inputMode="numeric" maxLength={11} placeholder="01XXXXXXXXX"
                  aria-invalid={!!errors.phone} className={inputCls(!!errors.phone, "pl-9")}
                  {...register("phone")} />
              </IconInput>
            </Field>

            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <IconInput icon={Mail}>
                <Input id="email" type="email" placeholder="name@example.com"
                  aria-invalid={!!errors.email} className={inputCls(!!errors.email, "pl-9")}
                  {...register("email")} />
              </IconInput>
            </Field>
          </div>

          <Field label="Details" htmlFor="details" error={errors.details?.message}
            hint={`${detailsLength}/500`}>
            <Textarea id="details" rows={5} placeholder="Write something about this account (optional)"
              aria-invalid={!!errors.details} className={inputCls(!!errors.details, "resize-none")}
              {...register("details")} />
          </Field>
        </div>

        <footer className="flex items-center justify-end gap-3 rounded-b-xl border-t bg-muted/30 px-6 py-4">
          <Button type="button" variant="outline" disabled={!isDirty || isSubmitting}
            onClick={() => reset()}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </footer>
      </form>
    </section>
  );
}

// ---------------- Password card ----------------
function PasswordCard() {
  const router = useRouter();
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
    mode: "onTouched",
  });

  async function onSubmit(values: PasswordForm) {
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: values.oldPassword, newPassword: values.newPassword }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.message ?? "Could not change password. Please try again.");
        return;
      }
      reset();
      toast.success("Password changed. Please sign in again.");
      // For security, log out after a password change
      setTimeout(() => logout(router), 1500);
    } catch {
      toast.error("Could not change password. Please try again.");
    }
  }

  return (
    <section className="flex flex-col rounded-xl border bg-background shadow-sm">
      <header className="flex items-center gap-4 border-b p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-semibold">Change password</h3>
          <p className="text-sm text-muted-foreground">You will be signed out after changing it</p>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col">
        <div className="flex-1 space-y-5 p-6">
          <Field label="Old password" htmlFor="oldPassword" error={errors.oldPassword?.message}>
            <PasswordInput id="oldPassword" autoComplete="current-password" placeholder="Enter old password"
              aria-invalid={!!errors.oldPassword} className={inputCls(!!errors.oldPassword)}
              {...register("oldPassword")} />
          </Field>

          <Field label="New password" htmlFor="newPassword" error={errors.newPassword?.message}>
            <PasswordInput id="newPassword" autoComplete="new-password" placeholder="Enter new password"
              aria-invalid={!!errors.newPassword} className={inputCls(!!errors.newPassword)}
              {...register("newPassword")} />
          </Field>

          <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
            <PasswordInput id="confirmPassword" autoComplete="new-password" placeholder="Type new password again"
              aria-invalid={!!errors.confirmPassword} className={inputCls(!!errors.confirmPassword)}
              {...register("confirmPassword")} />
          </Field>
        </div>

        <footer className="flex items-center justify-end gap-3 rounded-b-xl border-t bg-muted/30 px-6 py-4">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => reset()}>
            Clear
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Updating..." : "Update password"}
          </Button>
        </footer>
      </form>
    </section>
  );
}

// ---------------- Small helpers ----------------
function inputCls(hasError: boolean, extra = "") {
  return cn("h-11", extra, hasError && "border-destructive focus-visible:ring-destructive/30");
}

function Field({ label, htmlFor, error, hint, children }: {
  label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function IconInput({ icon: Icon, children }: {
  icon: React.ComponentType<{ className?: string }>; children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {children}
    </div>
  );
}
