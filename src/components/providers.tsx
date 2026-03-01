"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { CommandPaletteProvider } from "@/components/app/command-palette";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <CommandPaletteProvider>{children}</CommandPaletteProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
