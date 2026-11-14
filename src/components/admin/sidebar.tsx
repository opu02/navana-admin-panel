"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV, type NavItem } from "./nav";
import { initials, useMe } from "./use-me";

type Props = { open: boolean; mobileOpen: boolean; onClose: () => void };

export function Sidebar({ open, mobileOpen, onClose }: Props) {
  const me = useMe();
  return (
    <>
      {/* dark background behind the menu on mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-primary text-primary-foreground transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          open ? "lg:translate-x-0" : "lg:-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="p-4">
          <Link
            href="/profile"
            onClick={onClose}
            title="Profile Update"
            className="flex h-14 items-center justify-center rounded-lg bg-white px-3 transition-opacity hover:opacity-90"
          >
            <Image src="/navana-logo.png" alt="Navana Pharma" width={180} height={30} priority />
          </Link>
        </div>

        {/* User */}
        <div className="mx-4 mb-2 flex items-center gap-3 rounded-lg bg-white/10 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white font-semibold text-primary">
            {initials(me?.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{me?.name ?? "…"}</p>
            <p className="flex items-center gap-1.5 text-xs text-primary-foreground/70">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> {me?.roleName || "Administrator"}
            </p>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
          {NAV.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/50">
                {group.title}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <MenuItem item={item} onNavigate={onClose} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <p className="px-6 py-5 text-sm italic text-primary-foreground/60">
          For a healthier tomorrow
        </p>
      </aside>
    </>
  );
}

function MenuItem({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const pathname = usePathname();
  const childActive = item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href + "/")) ?? false;
  const [expanded, setExpanded] = useState(childActive);
  const Icon = item.icon;

  const base =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors";

  if (!item.children) {
    const active = pathname === item.href;
    return (
      <Link
        href={item.href!}
        onClick={onNavigate}
        className={cn(
          base,
          active
            ? "bg-white text-primary shadow-sm"
            : "text-primary-foreground/85 hover:bg-white/10 hover:text-primary-foreground"
        )}
      >
        <Icon className="h-4.5 w-4.5" />
        {item.label}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className={cn(
          base,
          "cursor-pointer",
          childActive ? "bg-white/10 text-primary-foreground" : "text-primary-foreground/85 hover:bg-white/10"
        )}
      >
        <Icon className="h-4.5 w-4.5" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <ul className="mt-1 ml-5 space-y-1 border-l border-white/15 pl-3">
          {item.children.map((c) => {
            const active = pathname === c.href || pathname.startsWith(c.href + "/");
            return (
              <li key={c.href}>
                <Link
                  href={c.href}
                  onClick={onNavigate}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-white text-primary font-medium"
                      : "text-primary-foreground/75 hover:bg-white/10 hover:text-primary-foreground"
                  )}
                >
                  {c.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
