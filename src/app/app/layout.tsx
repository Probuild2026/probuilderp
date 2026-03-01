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
import { Input } from "@/components/ui/input";
import { Prisma } from "@prisma/client";
import { CommandPalette, CommandPaletteSearch } from "@/components/app/command-palette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const [projects, cookieStore] = await Promise.all([
    prisma.project.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 500,
    }),
    cookies(),
  ]);
  const selectedProjectId = cookieStore.get(PROJECT_FILTER_COOKIE)?.value ?? "";

  let profile: {
    legalName: string;
    tradeName: string | null;
    brandName: string | null;
    primaryColor: string | null;
    accentColor: string | null;
    logoUrl: string | null;
  } | null = null;
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
    } else {
      throw e;
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
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b">
          <div className="flex items-center gap-3 p-3 md:p-4">
            <div className="md:hidden">
              <MobileNav />
            </div>

            <div className="flex items-center gap-2">
              {profile?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.logoUrl}
                  alt={brandName}
                  className="h-7 w-auto max-w-[180px] object-contain sm:h-8"
                />
              ) : (
                <div className="size-7 rounded bg-sidebar-primary/20" />
              )}
              <div className="hidden sm:block">
                <div className="text-sm font-semibold leading-5">{brandName}</div>
                <div className="text-xs text-muted-foreground">Construction ERP</div>
              </div>
            </div>

            <div className="mx-auto hidden w-full max-w-xl flex-1 items-center gap-3 md:flex">
              <CommandPaletteSearch />
              <GlobalProjectFilter projects={projects} value={selectedProjectId} />
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-sm text-muted-foreground lg:block">{session.user.email}</div>
              <SignOutButton />
            </div>
          </div>
          <div className="px-3 pb-3 md:hidden">
            <div className="flex items-center gap-3">
              <GlobalProjectFilter projects={projects} value={selectedProjectId} />
              <CommandPaletteSearch placeholder="Search…" />
            </div>
          </div>
        </header>
        <CommandPalette />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
