import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { MobileNav } from "@/components/app/mobile-nav";
import { Sidebar } from "@/components/app/sidebar";
import { SignOutButton } from "@/components/auth/signout-button";
import { authOptions } from "@/server/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar className="hidden md:block" />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b p-3 md:p-4">
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <MobileNav />
            </div>
            <div className="hidden text-sm text-muted-foreground sm:block">{session.user.email}</div>
          </div>
          <SignOutButton />
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
