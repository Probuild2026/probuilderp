"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";

type SearchResultItem = {
  type: "project" | "client" | "vendor" | "bill" | "invoice" | "payment" | "receipt";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

type SearchResponse = { items: SearchResultItem[] };

type CommandPaletteCtx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  openPalette: () => void;
};

const Ctx = createContext<CommandPaletteCtx | null>(null);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === "k";
      const isCmdK = (e.metaKey || e.ctrlKey) && isK;
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      openPalette: () => setOpen(true),
    }),
    [open],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useCommandPalette() {
  const v = useContext(Ctx);
  if (!v) throw new Error("CommandPaletteProvider missing");
  return v;
}

export function CommandPaletteSearch({
  placeholder = "Search vendors, clients, projects, bills…",
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const { openPalette } = useCommandPalette();
  return (
    <div className={className}>
      <div className="relative">
        <Input
          readOnly
          placeholder={placeholder}
          onFocus={openPalette}
          onClick={openPalette}
          className="pr-16"
        />
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border bg-background px-2 py-1 text-[10px] text-muted-foreground">
          <span className="hidden md:inline">Ctrl</span>
          <span className="md:hidden">⌘</span> K
        </div>
      </div>
    </div>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { open, setOpen } = useCommandPalette();

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setItems([]);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setItems([]);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ac.signal });
        if (!res.ok) throw new Error("Search failed");
        const json = (await res.json()) as SearchResponse;
        setItems(Array.isArray(json.items) ? json.items : []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [open, query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const groups = useMemo(() => {
    const byType = new Map<string, SearchResultItem[]>();
    for (const it of items) {
      const key = it.type;
      byType.set(key, [...(byType.get(key) ?? []), it]);
    }
    return byType;
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <Command>
          <CommandInput placeholder="Search…" value={query} onValueChange={setQuery} />
          <CommandList>
            {loading ? <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div> : null}
            <CommandEmpty>No results.</CommandEmpty>

            {!query.trim() ? (
              <>
                <CommandGroup heading="Create">
                  <CommandItem onSelect={() => go("/app/purchases/bills/new")}>
                    New bill <CommandShortcut>B</CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => go("/app/purchases/payments-made/new")}>
                    New vendor payment <CommandShortcut>P</CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => go("/app/sales/receipts/new")}>
                    New receipt <CommandShortcut>R</CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => go("/app/sales/invoices/new")}>
                    New invoice <CommandShortcut>I</CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => go("/app/expenses/new")}>
                    New expense <CommandShortcut>E</CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => go("/app/wages/new")}>
                    New wage <CommandShortcut>W</CommandShortcut>
                  </CommandItem>
                </CommandGroup>

                <CommandSeparator />
                <CommandGroup heading="Theme">
                  <CommandItem
                    onSelect={() => {
                      setTheme("light");
                      setOpen(false);
                    }}
                  >
                    Light
                  </CommandItem>
                  <CommandItem
                    onSelect={() => {
                      setTheme("dark");
                      setOpen(false);
                    }}
                  >
                    Dark
                  </CommandItem>
                  <CommandItem
                    onSelect={() => {
                      setTheme("system");
                      setOpen(false);
                    }}
                  >
                    System
                  </CommandItem>
                </CommandGroup>

                <CommandSeparator />
                <CommandGroup heading="Settings">
                  <CommandItem onSelect={() => go("/app/settings/business")}>Business settings</CommandItem>
                  <CommandItem onSelect={() => go("/app/settings/account")}>Account</CommandItem>
                </CommandGroup>
              </>
            ) : (
              <>
                {Array.from(groups.entries()).map(([type, arr]) => (
                  <CommandGroup key={type} heading={type.toUpperCase()}>
                    {arr.map((it) => (
                      <CommandItem
                        key={it.type + ":" + it.id}
                        onSelect={() => go(it.href)}
                      >
                        <div className="min-w-0">
                          <div className="truncate">{it.title}</div>
                          {it.subtitle ? <div className="truncate text-xs text-muted-foreground">{it.subtitle}</div> : null}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

