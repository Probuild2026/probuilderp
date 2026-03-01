import { cookies } from "next/headers";

export const PROJECT_FILTER_COOKIE = "pb_project_id";

export async function getSelectedProjectId(): Promise<string | undefined> {
  const c = await cookies();
  const raw = c.get(PROJECT_FILTER_COOKIE)?.value ?? "";
  const value = raw.trim();
  return value.length ? value : undefined;
}

