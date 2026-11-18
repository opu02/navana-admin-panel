"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { UserFormCard } from "@/components/users/user-form";
import { DoctorCreateCard } from "@/components/users/doctor-create-form";

/** Create User page: Doctor → saved in the ERP; Admin → still saved on this website only */
export function CreateUser() {
  const [type, setType] = useState<"Doctor" | "Admin">("Doctor");
  return (
    <div className="space-y-4">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <span className="text-sm font-medium">Type</span>
        <div role="tablist" aria-label="User type" className="inline-flex rounded-lg border bg-muted/40 p-1">
          {(["Doctor", "Admin"] as const).map((t) => (
            <button
              key={t} type="button" role="tab" aria-selected={type === t} onClick={() => setType(t)}
              className={cn("cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                type === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {type === "Doctor" ? <DoctorCreateCard /> : <UserFormCard fixedType="Admin" />}
    </div>
  );
}
