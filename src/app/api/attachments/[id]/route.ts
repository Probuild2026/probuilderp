import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If stored in Vercel Blob (URL), redirect to it.
  if (attachment.storagePath.startsWith("http://") || attachment.storagePath.startsWith("https://")) {
    return NextResponse.redirect(attachment.storagePath);
  }

  try {
    await stat(attachment.storagePath);
  } catch {
    return NextResponse.json(
      {
        error: "File not found on server storage.",
      },
      { status: 404 },
    );
  }

  const stream = createReadStream(attachment.storagePath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = Readable.toWeb(stream) as any;

  return new NextResponse(body, {
    headers: {
      "content-type": attachment.mimeType || "application/octet-stream",
      "content-disposition": `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
    },
  });
}
