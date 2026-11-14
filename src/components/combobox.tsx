"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label: string; hint?: string };

type Props = {
  id?: string;
  options: ComboOption[];
  value: string; // "" = nothing selected / all
  onChange: (value: string, label: string) => void;
  /** Label of the "all" option (filters). Leave out for form fields. */
  allLabel?: string;
  placeholder?: string;
  /** Text to show when the value is not in options (e.g. a new typed value) */
  selectedLabel?: string;
  /** Allow typing a new value that is not in the list */
  onCreate?: (text: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  invalid?: boolean;
  disabled?: boolean;
};

const MAX_SHOWN = 200;

/** Searchable dropdown (good for long lists like doctors, generics, companies) */
export function Combobox({
  id, options, value, onChange, allLabel, placeholder = "Select...", selectedLabel, onCreate,
  searchPlaceholder = "Search...", emptyText = "No results found", loading, invalid, disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const shownLabel = selected?.label ?? selectedLabel ?? "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q))
      : options;
    return list.slice(0, MAX_SHOWN);
  }, [options, query]);

  const trimmed = query.trim();
  const exact = trimmed && options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(v: string, label: string) {
    onChange(v, label);
    setOpen(false);
    setQuery("");
  }

  function create() {
    if (!trimmed || !onCreate) return;
    onCreate(trimmed);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid}
        className={cn(
          "flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-3 text-left text-sm shadow-xs outline-none transition-colors hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-destructive"
        )}
      >
        <span className={cn("truncate", !shownLabel && "text-muted-foreground")}>
          {shownLabel || allLabel || placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full min-w-64 overflow-hidden rounded-md border bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              maxLength={200}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered.length === 1) pick(filtered[0].value, filtered[0].label);
                  else if (onCreate && trimmed && !exact) create();
                }
              }}
              placeholder={onCreate ? "Search or type a new one..." : searchPlaceholder}
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto p-1">
            {allLabel !== undefined && <Item active={value === ""} onClick={() => pick("", "")} label={allLabel} />}
            {onCreate && trimmed && !exact && (
              <li
                role="option"
                aria-selected={false}
                onClick={create}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
              >
                <Plus className="h-4 w-4 shrink-0" /> Use &ldquo;{trimmed}&rdquo; (new)
              </li>
            )}
            {loading ? (
              <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </li>
            ) : filtered.length === 0 ? (
              !onCreate && <li className="px-3 py-3 text-sm text-muted-foreground">{emptyText}</li>
            ) : (
              filtered.map((o) => (
                <Item key={o.value} active={o.value === value} onClick={() => pick(o.value, o.label)} label={o.label} hint={o.hint} />
              ))
            )}
            {!loading && options.length > MAX_SHOWN && filtered.length === MAX_SHOWN && (
              <li className="px-3 py-2 text-xs text-muted-foreground">Type to search more…</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Item({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <li
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-muted",
        active && "bg-primary/5 font-medium text-primary"
      )}
    >
      <Check className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-0")} />
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </li>
  );
}
