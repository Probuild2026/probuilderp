"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { CommandPaletteProvider } from "@/components/app/command-palette";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        void registration.unregister();
      }
    });

    void caches.keys().then((keys) => {
      for (const key of keys) {
        if (key.toLowerCase().includes("workbox") || key.toLowerCase().includes("next-pwa")) {
          void caches.delete(key);
        }
      }
    });
  }, []);

  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <CommandPaletteProvider>{children}</CommandPaletteProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
