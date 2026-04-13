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
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(140,188,255,0.28),transparent_62%)]" />
        <header className="sticky top-0 z-40 border-b border-white/60 bg-[color-mix(in_srgb,var(--surface)_76%,transparent)] backdrop-blur-2xl">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6">
            <div className="md:hidden">
              <MobileNav />
            </div>

            <div className="flex min-w-0 items-center gap-3">
              {profile?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.logoUrl}
                  alt={brandName}
                  className="h-9 w-auto max-w-[180px] rounded-lg object-contain"
                />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-sm font-semibold text-primary shadow-[0_16px_28px_-24px_rgba(91,124,191,0.55)]">
                  PB
                </div>
              )}
              <div className="hidden min-w-0 sm:block">
                <div className="truncate text-sm font-semibold leading-5">{brandName}</div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Construction operating system</div>
              </div>
            </div>

            <div className="mx-auto hidden w-full max-w-3xl flex-1 items-center gap-3 md:flex">
              <CommandPaletteSearch />
              <GlobalProjectFilter projects={projects} value={selectedProjectId} />
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden rounded-full border border-white/70 bg-white/72 px-3 py-1.5 text-sm text-muted-foreground shadow-[0_12px_30px_-26px_rgba(91,124,191,0.5)] lg:block">
                {session.user.email}
              </div>
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
