import { Suspense } from "react";

import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { LoginForm } from "./login-form";
import { authOptions } from "@/server/auth";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/app");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
