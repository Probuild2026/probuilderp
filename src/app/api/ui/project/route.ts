import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";

import { PROJECT_FILTER_COOKIE } from "@/lib/project-filter";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

const bodySchema = z.object({
  projectId: z.string().min(1).nullable(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const projectId = parsed.data.projectId;

  if (projectId) {
    const exists = await prisma.project.findFirst({
      where: { tenantId: session.user.tenantId, id: projectId },
      select: { id: true },
    });
    if (!exists) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true });
  if (projectId) {
    res.cookies.set(PROJECT_FILTER_COOKIE, projectId, { path: "/" });
  } else {
    res.cookies.delete(PROJECT_FILTER_COOKIE);
  }
  return res;
}

