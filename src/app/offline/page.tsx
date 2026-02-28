export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">You’re offline</h1>
      <p className="text-sm text-muted-foreground">
        Probuild ERP can open with limited functionality without an internet connection.
        When you’re back online, refresh to sync and load the latest data.
      </p>
      <a
        className="rounded-md border bg-muted/20 px-4 py-2 text-sm hover:bg-muted/30"
        href="/app"
      >
        Go to app
      </a>
    </main>
  );
}

