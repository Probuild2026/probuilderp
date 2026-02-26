"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { createFinanceAccount, createTransaction, createTxnCategory } from "../actions";

type ProjectOption = { id: string; name: string };
type AccountOption = { id: string; name: string; type: "CASH" | "BANK" | "UPI" | "CARD" | "OTHER" };
type CategoryOption = { id: string; name: string; type: "INCOME" | "EXPENSE" | "TRANSFER" };

function groupLabel(t: AccountOption["type"]) {
  if (t === "CASH") return "Cash";
  if (t === "BANK") return "Bank Accounts";
  if (t === "UPI") return "UPI";
  if (t === "CARD") return "Card";
  return "Other";
}

export function TransactionForm({
  today,
  projects,
  accounts,
  categories,
}: {
  today: string;
  projects: ProjectOption[];
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const [type, setType] = useState<"INCOME" | "EXPENSE" | "TRANSFER">("EXPENSE");
  const [projectId, setProjectId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");

  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string>("");

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  );

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedFrom = accounts.find((a) => a.id === fromAccountId);
  const selectedTo = accounts.find((a) => a.id === toAccountId);

  const accountsByType = useMemo(() => {
    const groups: Record<AccountOption["type"], AccountOption[]> = {
      CASH: [],
      BANK: [],
      UPI: [],
      CARD: [],
      OTHER: [],
    };
    for (const a of accounts) groups[a.type].push(a);
    return groups;
  }, [accounts]);

  function resetTypeDefaults(next: typeof type) {
    setType(next);
    setErr("");
    setCategoryId("");
    if (next === "INCOME") {
      setFromAccountId("");
    }
    if (next === "EXPENSE") {
      setToAccountId("");
    }
    if (next === "TRANSFER") {
      setCategoryId("");
    }
  }

  async function onCreateCategory(formData: FormData) {
    setErr("");
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return setErr("Category name is required.");

    startTransition(async () => {
      try {
        await createTxnCategory({ name, type });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to create category.");
      }
    });
  }

  async function onCreateAccount(formData: FormData) {
    setErr("");
    const name = String(formData.get("name") ?? "").trim();
    const accType = String(formData.get("type") ?? "") as AccountOption["type"];
    if (!name) return setErr("Account name is required.");

    startTransition(async () => {
      try {
        await createFinanceAccount({ name, type: accType });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to create account.");
      }
    });
  }

  return (
    <form
      action={async (fd) => {
        setErr("");
        startTransition(async () => {
          try {
            await createTransaction(fd);
            window.location.href = "/app/transactions";
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed to save transaction.");
          }
        });
      }}
      className="space-y-4 rounded-md border p-4 md:p-6"
    >
      <div className="space-y-2">
        <Tabs value={type} onValueChange={(v) => resetTypeDefaults(v as typeof type)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="INCOME">Income</TabsTrigger>
            <TabsTrigger value="EXPENSE">Expense</TabsTrigger>
            <TabsTrigger value="TRANSFER">Transfer</TabsTrigger>
          </TabsList>
        </Tabs>
        <input type="hidden" name="type" value={type} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Date</div>
          <Input type="date" name="date" defaultValue={today} required />
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Project (optional)</div>
          <select
            name="projectId"
            className="h-10 w-full rounded-md border bg-background px-3"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-2 text-sm">
        <div className="text-muted-foreground">Amount</div>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          name="amount"
          placeholder="0.00"
          className="h-12 text-lg"
          required
        />
      </label>

      {type !== "TRANSFER" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 text-sm">
            <div className="text-muted-foreground">Category</div>
            <input type="hidden" name="categoryId" value={categoryId} />
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("h-10 w-full justify-start", !selectedCategory && "text-muted-foreground")}
                >
                  {selectedCategory?.name ?? "Select category"}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-auto">
                <SheetHeader>
                  <SheetTitle>Category</SheetTitle>
                </SheetHeader>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {visibleCategories.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant={c.id === categoryId ? "default" : "outline"}
                      className="h-12 justify-start"
                      onClick={() => setCategoryId(c.id)}
                    >
                      {c.name}
                    </Button>
                  ))}
                </div>
                <Separator className="my-4" />
                <Dialog>
                  <DialogTrigger asChild>
                    <Button type="button" variant="secondary" className="w-full">
                      Add category
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>New category</DialogTitle>
                    </DialogHeader>
                    <form action={onCreateCategory} className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="cat-name">Name</Label>
                        <Input id="cat-name" name="name" placeholder="e.g. Material Purchase" />
                      </div>
                      <Button type="submit" disabled={pending} className="w-full">
                        Save
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </SheetContent>
            </Sheet>
          </div>

          <div className="space-y-2 text-sm">
            <div className="text-muted-foreground">Account</div>
            <input type="hidden" name={type === "INCOME" ? "toAccountId" : "fromAccountId"} value={type === "INCOME" ? toAccountId : fromAccountId} />
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-10 w-full justify-start",
                    !(type === "INCOME" ? selectedTo : selectedFrom) && "text-muted-foreground",
                  )}
                >
                  {(type === "INCOME" ? selectedTo?.name : selectedFrom?.name) ?? "Select account"}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-auto">
                <SheetHeader>
                  <SheetTitle>Account</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                  {(["CASH", "BANK", "UPI", "CARD", "OTHER"] as const).map((t) => (
                    <div key={t} className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">{groupLabel(t)}</div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {accountsByType[t].map((a) => {
                          const active = (type === "INCOME" ? toAccountId : fromAccountId) === a.id;
                          return (
                            <Button
                              key={a.id}
                              type="button"
                              variant={active ? "default" : "outline"}
                              className="h-12 justify-start"
                              onClick={() => (type === "INCOME" ? setToAccountId(a.id) : setFromAccountId(a.id))}
                            >
                              {a.name}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <Dialog>
                  <DialogTrigger asChild>
                    <Button type="button" variant="secondary" className="w-full">
                      Add account
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>New account</DialogTitle>
                    </DialogHeader>
                    <form action={onCreateAccount} className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="acc-name">Name</Label>
                        <Input id="acc-name" name="name" placeholder="e.g. HDFC Bank" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="acc-type">Type</Label>
                        <select
                          id="acc-type"
                          name="type"
                          className="h-10 w-full rounded-md border bg-background px-3"
                          defaultValue="BANK"
                          required
                        >
                          <option value="CASH">Cash</option>
                          <option value="BANK">Bank</option>
                          <option value="UPI">UPI</option>
                          <option value="CARD">Card</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <Button type="submit" disabled={pending} className="w-full">
                        Save
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 text-sm">
            <div className="text-muted-foreground">From</div>
            <input type="hidden" name="fromAccountId" value={fromAccountId} />
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("h-10 w-full justify-start", !selectedFrom && "text-muted-foreground")}
                >
                  {selectedFrom?.name ?? "Select account"}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-auto">
                <SheetHeader>
                  <SheetTitle>From account</SheetTitle>
                </SheetHeader>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {accounts.map((a) => (
                    <Button
                      key={a.id}
                      type="button"
                      variant={a.id === fromAccountId ? "default" : "outline"}
                      className="h-12 justify-start"
                      onClick={() => setFromAccountId(a.id)}
                    >
                      {a.name}
                    </Button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="space-y-2 text-sm">
            <div className="text-muted-foreground">To</div>
            <input type="hidden" name="toAccountId" value={toAccountId} />
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("h-10 w-full justify-start", !selectedTo && "text-muted-foreground")}
                >
                  {selectedTo?.name ?? "Select account"}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-auto">
                <SheetHeader>
                  <SheetTitle>To account</SheetTitle>
                </SheetHeader>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {accounts.map((a) => (
                    <Button
                      key={a.id}
                      type="button"
                      variant={a.id === toAccountId ? "default" : "outline"}
                      className="h-12 justify-start"
                      onClick={() => setToAccountId(a.id)}
                    >
                      {a.name}
                    </Button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}

      <Separator />

      <div className="space-y-3">
        <label className="block space-y-2 text-sm">
          <div className="text-muted-foreground">Note (optional)</div>
          <Input name="note" placeholder="Short note" />
        </label>

        <label className="block space-y-2 text-sm">
          <div className="text-muted-foreground">Description (optional)</div>
          <Textarea name="description" placeholder="Details / narration" rows={3} />
        </label>

        <label className="block space-y-2 text-sm">
          <div className="text-muted-foreground">Attachment (optional)</div>
          <Input type="file" name="attachment" accept="image/*,application/pdf" />
        </label>
      </div>

      {err ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{err}</div> : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
