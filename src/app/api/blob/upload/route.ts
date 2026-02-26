import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { handleUpload } from "@vercel/blob/client";

import { authOptions } from "@/server/auth";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob is not configured (missing BLOB_READ_WRITE_TOKEN)." }, { status: 500 });
  }

  const body = await request.json();

  const result = await handleUpload({
    request,
    body,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (pathname) => {
      // Enforce tenant prefix so a token can't write outside a tenant namespace.
      const prefix = `tenant-${session.user.tenantId}/`;
      if (!pathname.startsWith(prefix)) {
        throw new Error(`Invalid upload path. Must start with ${prefix}`);
      }

      return {
        maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
        allowedContentTypes: ["image/*", "application/pdf"],
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({
          tenantId: session.user.tenantId,
          userId: session.user.id,
        }),
      };
    },
    onUploadCompleted: async () => {
      // We create Attachment rows in our own server actions after the upload completes.
    },
  });

  return NextResponse.json(result);
}

