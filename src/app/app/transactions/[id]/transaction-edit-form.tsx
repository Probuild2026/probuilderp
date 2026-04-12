"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateTransaction } from "@/app/actions/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ProjectOption = { id: string; name: string };
type AccountOption = { id: string; name: string; type: "CASH" | "BANK" | "UPI" | "CARD" | "OTHER" };
type CategoryOption = { id: string; name: string; type: "INCOME" | "EXPENSE" | "TRANSFER" };

type TransactionInitial = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  date: string;
  amount: string;
  projectId: string;
  categoryId: string;
  fromAccountId: string;
  toAccountId: string;
  note: string;
  description: string;
};

export function TransactionEditForm({
  transaction,
  projects,
  accounts,
  categories,
}: {
  transaction: TransactionInitial;
  projects: ProjectOption[];
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<TransactionInitial["type"]>(transaction.type);
  const [projectId, setProjectId] = useState(transaction.projectId);
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [fromAccountId, setFromAccountId] = useState(transaction.fromAccountId);
  const [toAccountId, setToAccountId] = useState(transaction.toAccountId);
  const [date, setDate] = useState(transaction.date);
  const [amount, setAmount] = useState(transaction.amount);
  const [note, setNote] = useState(transaction.note);
  const [description, setDescription] = useState(transaction.description);

  const visibleCategories = useMemo(() => categories.filter((category) => category.type === type), [categories, type]);

  function switchType(nextType: TransactionInitial["type"]) {
    setType(nextType);
    setCategoryId("");
    if (nextType === "INCOME") {
      setFromAccountId("");
    } else if (nextType === "EXPENSE") {
      setToAccountId("");
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await updateTransaction({
            id: transaction.id,
            type,
            date,
            amount: Number(amount || 0),
            projectId: projectId || undefined,
            categoryId: type === "TRANSFER" ? undefined : categoryId || undefined,
            fromAccountId: type === "INCOME" ? undefined : fromAccountId || undefined,
            toAccountId: type === "EXPENSE" ? undefined : toAccountId || undefined,
            note: note.trim() || undefined,
            description: description.trim() || undefined,
          });

          if (!result.ok) {
            toast.error(result.error.message);
            return;
          }

          toast.success("Transaction updated.");
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-3 gap-2 rounded-[18px] border border-border/60 bg-background/70 p-1">
        {(["INCOME", "EXPENSE", "TRANSFER"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`rounded-[14px] px-3 py-2 text-sm font-medium transition ${
              type === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/70"
            }`}
            onClick={() => switchType(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Date</div>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Amount</div>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>

        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">Project</div>
          <select
            className="h-10 w-full rounded-xl border border-border/80 bg-background px-3"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        {type !== "TRANSFER" ? (
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">Category</div>
            <select
              className="h-10 w-full rounded-xl border border-border/80 bg-background px-3"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
            >
              <option value="">Select category</option>
              {visibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {type === "TRANSFER" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">From account</div>
            <select
              className="h-10 w-full rounded-xl border border-border/80 bg-background px-3"
              value={fromAccountId}
              onChange={(event) => setFromAccountId(event.target.value)}
              required
            >
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <div className="text-muted-foreground">To account</div>
            <select
              className="h-10 w-full rounded-xl border border-border/80 bg-background px-3"
              value={toAccountId}
              onChange={(event) => setToAccountId(event.target.value)}
              required
            >
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <label className="space-y-2 text-sm">
          <div className="text-muted-foreground">{type === "INCOME" ? "Into account" : "From account"}</div>
          <select
            className="h-10 w-full rounded-xl border border-border/80 bg-background px-3"
            value={type === "INCOME" ? toAccountId : fromAccountId}
            onChange={(event) => (type === "INCOME" ? setToAccountId(event.target.value) : setFromAccountId(event.target.value))}
            required
          >
            <option value="">Select account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="space-y-2 text-sm">
        <div className="text-muted-foreground">Internal note</div>
        <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Short internal note" />
      </label>

      <label className="space-y-2 text-sm">
        <div className="text-muted-foreground">Description</div>
        <Textarea
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Add context, references, or reconciliation detail"
        />
      </label>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
