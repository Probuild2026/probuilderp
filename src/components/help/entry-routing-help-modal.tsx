"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MODULE_CHEAT_SHEETS, type ModuleKey } from "@/config/module-cheat-sheets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ROUTING_STEPS: Array<{ question: string; moduleKey: ModuleKey }> = [
  { question: "Got money from client?", moduleKey: "receipts" },
  { question: "Need to request money from client?", moduleKey: "invoices" },
  { question: "Got a proper vendor/subcontractor bill?", moduleKey: "bills" },
  { question: "Already created a bill and now paying it?", moduleKey: "paymentsMade" },
  { question: "No bill, but money was spent on project?", moduleKey: "expenses" },
  { question: "Only moving money between cash/bank/owner funding?", moduleKey: "transactions" },
  { question: "Tracking direct worker wages separately?", moduleKey: "wages" },
];

export function EntryRoutingHelpModal({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" type="button">
            Need help choosing?
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Need help choosing?</DialogTitle>
          <DialogDescription>
            Follow the quickest path below and jump straight into the right entry screen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {ROUTING_STEPS.map((step) => {
            const target = MODULE_CHEAT_SHEETS[step.moduleKey];
            return (
              <div key={step.question} className="rounded-xl border bg-card px-4 py-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">{step.question}</div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{target.title.replace("What goes in ", "")}</span>
                      {" · "}
                      {target.summary}
                    </div>
                  </div>
                  <Button asChild size="sm" className="shrink-0">
                    <Link href={target.createHref}>
                      Open
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
