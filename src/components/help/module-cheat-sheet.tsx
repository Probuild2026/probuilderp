import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { EntryRoutingHelpModal } from "@/components/help/entry-routing-help-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MODULE_CHEAT_SHEETS, type ModuleKey } from "@/config/module-cheat-sheets";
import { cn } from "@/lib/utils";

type ModuleCheatSheetProps = {
  moduleKey: ModuleKey;
  variant?: "inline" | "sidebar" | "compact" | "embedded";
  showDecisionHints?: boolean;
  showRoutingTrigger?: boolean;
  className?: string;
};

function CheatSheetBody({
  moduleKey,
  variant = "inline",
  showDecisionHints = false,
  showRoutingTrigger = false,
}: Omit<ModuleCheatSheetProps, "className">) {
  const config = MODULE_CHEAT_SHEETS[moduleKey];
  const isCompact = variant === "compact";
  const sectionClassName = isCompact ? "space-y-1.5" : "space-y-2";
  const listClassName = isCompact
    ? "space-y-1 pl-4 text-sm text-muted-foreground"
    : "space-y-1.5 pl-4 text-sm text-muted-foreground";

  return (
    <>
      <CardContent className={cn(isCompact ? "space-y-4 px-4 pb-4 pt-4" : "space-y-5 px-5 pb-5 pt-5")}>
        <section className={sectionClassName}>
          <div className="text-sm font-medium text-foreground">Use when</div>
          <ul className={listClassName}>
            {config.useWhen.map((item) => (
              <li key={item} className="list-disc">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className={sectionClassName}>
          <div className="text-sm font-medium text-foreground">Do not use when</div>
          <ul className={listClassName}>
            {config.doNotUseWhen.map((item) => (
              <li key={item} className="list-disc">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className={sectionClassName}>
          <div className="text-sm font-medium text-foreground">Examples</div>
          <ul className={listClassName}>
            {config.examples.map((item) => (
              <li key={item} className="list-disc">
                {item}
              </li>
            ))}
          </ul>
        </section>

        {showDecisionHints && config.decisionHints?.length ? (
          <section className={sectionClassName}>
            <div className="text-sm font-medium text-foreground">Quick routing</div>
            <ul className={listClassName}>
              {config.decisionHints.map((item) => (
                <li key={item} className="list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {config.relatedLinks?.length ? (
          <section className={sectionClassName}>
            <div className="text-sm font-medium text-foreground">Related links</div>
            <div className="flex flex-wrap gap-2">
              {config.relatedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {showRoutingTrigger ? (
          <div className="pt-1">
            <EntryRoutingHelpModal />
          </div>
        ) : null}
      </CardContent>
    </>
  );
}

export function ModuleCheatSheet({
  moduleKey,
  variant = "inline",
  showDecisionHints = false,
  showRoutingTrigger = false,
  className,
}: ModuleCheatSheetProps) {
  if (variant === "sidebar") {
    return (
      <div className={cn("lg:sticky lg:top-4", className)}>
        <details className="group rounded-xl border bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none select-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
            How to use this page
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="border-t">
            <CardHeader className="gap-1.5 px-5 py-5 pb-0">
              <CardTitle className="text-base">{MODULE_CHEAT_SHEETS[moduleKey].title}</CardTitle>
              <p className="text-sm text-muted-foreground">{MODULE_CHEAT_SHEETS[moduleKey].summary}</p>
            </CardHeader>
            <CheatSheetBody
              moduleKey={moduleKey}
              variant="inline"
              showDecisionHints={showDecisionHints}
              showRoutingTrigger={showRoutingTrigger}
            />
          </div>
        </details>
      </div>
    );
  }

  if (variant === "embedded") {
    return (
      <div className={className}>
        <div className="gap-1 px-4 py-4 pb-0">
          <div className="text-base font-semibold leading-none tracking-tight">{MODULE_CHEAT_SHEETS[moduleKey].title}</div>
          <p className="mt-1.5 text-sm text-muted-foreground">{MODULE_CHEAT_SHEETS[moduleKey].summary}</p>
        </div>
        <CheatSheetBody
          moduleKey={moduleKey}
          variant="compact"
          showDecisionHints={showDecisionHints}
          showRoutingTrigger={showRoutingTrigger}
        />
      </div>
    );
  }

  const isCompact = variant === "compact";
  return (
    <Card className={cn("group overflow-hidden", className)}>
      <details className="[&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-start justify-between transition-colors hover:bg-muted/50">
          <CardHeader className={cn(isCompact ? "gap-1 px-4 py-4" : "gap-1.5 px-5 py-5")}>
            <CardTitle className="text-base">{MODULE_CHEAT_SHEETS[moduleKey].title}</CardTitle>
            <p className="text-sm text-muted-foreground text-left">{MODULE_CHEAT_SHEETS[moduleKey].summary}</p>
          </CardHeader>
          <div className={cn(isCompact ? "p-4" : "p-5")}>
            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </div>
        </summary>
        <div className="border-t">
          <CheatSheetBody
            moduleKey={moduleKey}
            variant={variant}
            showDecisionHints={showDecisionHints}
            showRoutingTrigger={showRoutingTrigger}
          />
        </div>
      </details>
    </Card>
  );
}
