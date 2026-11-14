"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ---------- Validation rules ----------
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email")
    .max(100, "Email is too long"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(100, "Password is too long"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched", // check when the user leaves a field
  });

  async function onSubmit(data: LoginForm) {
  setServerError("");
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.email, password: data.password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.message ?? "Incorrect email or password. Please try again.");
      return;
    }

    router.replace("/profile");
  } catch {
    setServerError("Something went wrong. Please try again later.");
  }
}
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ---------- Left: brand side ---------- */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="w-fit rounded-lg bg-white px-4 py-2">
          <Image src="/navana-logo.png" alt="Navana Pharma" width={180} height={30} priority />
        </div>

        <div className="relative z-10 space-y-4">
          <h1 className="text-4xl font-bold leading-tight">
            Rx Support <br /> Admin Panel
          </h1>
          <p className="max-w-md text-primary-foreground/80">
            Manage prescriptions, doctors, users and licenses — all in one place.
          </p>
        </div>

        <p className="text-sm italic text-primary-foreground/70">
          For a healthier tomorrow
        </p>

        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-32 right-16 h-80 w-80 rounded-full bg-white/5" />
      </div>

      {/* ---------- Right: form side ---------- */}
      <div className="flex items-center justify-center bg-muted/40 p-6">
        <div className="w-full max-w-sm space-y-8 rounded-2xl bg-background p-8 shadow-sm ring-1 ring-border">
          <div className="flex justify-center lg:hidden">
            <Image src="/navana-logo.png" alt="Navana Pharma" width={180} height={30} />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to your account
            </p>
          </div>

          {serverError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@navanapharma.com"
                  aria-invalid={!!errors.email}
                  className={cn(
                    "h-11 pl-9",
                    errors.email && "border-destructive focus-visible:ring-destructive/30"
                  )}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <span className="text-xs text-muted-foreground">
                  Forgot? Contact the system admin
                </span>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  className={cn(
                    "h-11 pl-9 pr-10",
                    errors.password && "border-destructive focus-visible:ring-destructive/30"
                  )}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="h-11 w-full text-base" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Navana Pharmaceuticals PLC
          </p>
        </div>
      </div>
    </div>
  );
}