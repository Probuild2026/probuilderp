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
      <CardHeader className={cn(isCompact ? "gap-1 px-4 py-4" : "px-5 py-5")}>
        <CardTitle className="text-base">{config.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{config.summary}</p>
      </CardHeader>
      <CardContent className={cn(isCompact ? "space-y-4 px-4 pb-4" : "space-y-5 px-5 pb-5")}>
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
        <CheatSheetBody
          moduleKey={moduleKey}
          variant="compact"
          showDecisionHints={showDecisionHints}
          showRoutingTrigger={showRoutingTrigger}
        />
      </div>
    );
  }

  return (
    <Card className={className}>
      <CheatSheetBody
        moduleKey={moduleKey}
        variant={variant}
        showDecisionHints={showDecisionHints}
        showRoutingTrigger={showRoutingTrigger}
      />
    </Card>
  );
}
