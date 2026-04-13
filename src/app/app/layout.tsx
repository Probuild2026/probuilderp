import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { MobileNav } from "@/components/app/mobile-nav";
import { Sidebar } from "@/components/app/sidebar";
import { GlobalProjectFilter } from "@/components/app/global-project-filter";
import { SignOutButton } from "@/components/auth/signout-button";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { PROJECT_FILTER_COOKIE } from "@/lib/project-filter";
import { Prisma } from "@prisma/client";
import { CommandPalette, CommandPaletteSearch } from "@/components/app/command-palette";

function isDbUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P1001" || error.code === "P1002";
  return message.includes("Can't reach database server") || message.includes("P1001");
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const cookieStore = await cookies();
  let projects: Array<{ id: string; name: string }> = [];
  let dbUnavailable = false;
  try {
    projects = await prisma.project.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 500,
    });
  } catch (e) {
    if (isDbUnavailable(e)) {
      dbUnavailable = true;
    } else {
      throw e;
    }
  }
  const selectedProjectId = cookieStore.get(PROJECT_FILTER_COOKIE)?.value ?? "";

  let profile: {
    legalName: string;
    tradeName: string | null;
    brandName: string | null;
    primaryColor: string | null;
    accentColor: string | null;
    logoUrl: string | null;
  } | null = null;
  if (!dbUnavailable) {
    try {
      const res = await prisma.tenantProfile.findUnique({
        where: { tenantId: session.user.tenantId },
        select: {
          legalName: true,
          tradeName: true,
          brandName: true,
          primaryColor: true,
          accentColor: true,
          logoUrl: true,
        },
      });
      profile = res;
    } catch (e) {
      // If the DB migration hasn't been applied yet, fall back to older columns.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
        const res = await prisma.tenantProfile.findUnique({
          where: { tenantId: session.user.tenantId },
          select: {
            legalName: true,
            tradeName: true,
            logoUrl: true,
          },
        });
        profile = res
          ? {
              legalName: res.legalName,
              tradeName: res.tradeName ?? null,
              brandName: null,
              primaryColor: null,
              accentColor: null,
              logoUrl: res.logoUrl ?? null,
            }
          : null;
      } else if (isDbUnavailable(e)) {
        dbUnavailable = true;
      } else {
        throw e;
      }
    }
  }

  const brandName = profile?.brandName?.trim() || profile?.tradeName?.trim() || profile?.legalName?.trim() || "Probuild ERP";

  return (
    <div
      className="flex min-h-screen bg-background"
      style={
        {
          ...(profile?.primaryColor ? { ["--primary" as any]: profile.primaryColor, ["--sidebar-primary" as any]: profile.primaryColor } : {}),
          ...(profile?.accentColor ? { ["--accent" as any]: profile.accentColor, ["--sidebar-accent" as any]: profile.accentColor } : {}),
        } as React.CSSProperties
      }
    >
      <Sidebar className="hidden md:block" />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(231,241,255,0.92),rgba(248,251,255,0.55)_58%,transparent)]" />
        <header className="sticky top-0 z-40 border-b border-border/70 bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-2xl">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6">
            <div className="md:hidden">
              <MobileNav />
            </div>

            <div className="flex min-w-0 shrink-0 items-center gap-3">
              {profile?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.logoUrl}
                  alt={brandName}
                  className="h-10 w-auto max-w-[184px] object-contain"
                />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-2xl border border-border/70 bg-white/90 text-sm font-semibold text-primary shadow-[0_14px_24px_-24px_rgba(91,124,191,0.25)]">
                  PB
                </div>
              )}
              {!profile?.logoUrl ? <div className="hidden truncate text-sm font-semibold leading-5 sm:block">{brandName}</div> : null}
            </div>

            <div className="mx-auto hidden w-full max-w-3xl flex-1 items-center gap-3 md:flex">
              <CommandPaletteSearch />
              <GlobalProjectFilter projects={projects} value={selectedProjectId} />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <SignOutButton />
            </div>
          </div>
          <div className="space-y-3 px-4 pb-4 md:hidden">
            <CommandPaletteSearch placeholder="Search across projects, clients, and ledgers" />
            <div className="flex items-center gap-3">
              <GlobalProjectFilter projects={projects} value={selectedProjectId} />
            </div>
          </div>
          {dbUnavailable ? (
            <div className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 md:px-6">
              Database temporarily unreachable. Some pages may load with limited data until connectivity is restored.
            </div>
          ) : null}
        </header>
        <CommandPalette />
        <main className="relative min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
