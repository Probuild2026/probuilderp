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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar className="hidden md:block" />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b p-3 md:p-4">
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <MobileNav />
            </div>
            <GlobalProjectFilter projects={projects} value={selectedProjectId} />
            <div className="hidden text-sm text-muted-foreground sm:block">{session.user.email}</div>
          </div>
          <SignOutButton />
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
