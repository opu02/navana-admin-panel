"use client";

import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true); // desktop
  const [mobileOpen, setMobileOpen] = useState(false); // mobile

  function toggleMenu() {
    if (window.matchMedia("(min-width: 1024px)").matches) setOpen((o) => !o);
    else setMobileOpen((o) => !o);
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <Sidebar open={open} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className={cn("min-w-0 transition-[padding] duration-200", open && "lg:pl-64")}>
        <Topbar onMenuClick={toggleMenu} />
        <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
