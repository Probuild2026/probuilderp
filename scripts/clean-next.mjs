import { rmSync } from "node:fs";

try {
  rmSync(new URL("../.next", import.meta.url), { recursive: true, force: true });
} catch {
  // ignore
}

