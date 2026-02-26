"use client";

import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";

export async function uploadBillToBlob(params: {
  tenantId: number;
  entityPath: string;
  file: File;
}) {
  const pathname = `tenant-${params.tenantId}/${params.entityPath}/${params.file.name}`;
  const blob = (await upload(pathname, params.file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
  })) as PutBlobResult;

  return blob;
}

