import { NextResponse, type NextRequest } from "next/server";

import { handleUpload } from "@vercel/blob/client";
import { getToken } from "next-auth/jwt";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Server auth is not configured (missing NEXTAUTH_SECRET)." }, { status: 500 });
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = Number((token as any).tenantId ?? 1);

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
      const prefix = `tenant-${tenantId}/`;
      if (!pathname.startsWith(prefix)) {
        throw new Error(`Invalid upload path. Must start with ${prefix}`);
      }

      return {
        maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
        allowedContentTypes: ["image/*", "application/pdf"],
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({
          tenantId,
          userId: token.sub,
        }),
      };
    },
    onUploadCompleted: async () => {
      // We create Attachment rows in our own server actions after the upload completes.
    },
  });

  return NextResponse.json(result);
}
