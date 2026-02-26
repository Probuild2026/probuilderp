import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { del, put } from "@vercel/blob";

export function uploadsRoot() {
  // On Vercel/serverless, the filesystem is read-only except `/tmp`.
  // Using `/tmp` avoids 500s on upload, but files are ephemeral and may not persist.
  if (process.env.VERCEL) return path.join("/tmp", "probuild-uploads");
  return path.join(process.cwd(), "uploads");
}

function sanitizeName(name: string) {
  return name.replaceAll(/[^\w.\-()+@ ]/g, "_");
}

function buildStorageName(fileName: string, buf: Buffer) {
  const hash = createHash("sha256").update(buf).digest("hex");
  const safeName = sanitizeName(fileName);
  const storageName = `${Date.now()}-${hash.slice(0, 12)}-${safeName}`;
  return { storageName, sha256: hash };
}

async function saveUploadToBlob(params: { tenantId: number; entityPath: string; file: File; buf: Buffer }) {
  const { storageName, sha256 } = buildStorageName(params.file.name, params.buf);
  const key = `tenant-${params.tenantId}/${params.entityPath}/${storageName}`;

  const res = await put(key, params.buf, {
    access: "public",
    contentType: params.file.type || "application/octet-stream",
  });

  return {
    storagePath: res.url,
    sha256,
    size: params.buf.byteLength,
    originalName: params.file.name,
    mimeType: params.file.type || "application/octet-stream",
  };
}

export async function saveUploadToDisk(params: {
  tenantId: number;
  entityPath: string;
  file: File;
}) {
  const arrayBuffer = await params.file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  // Prefer durable Vercel Blob storage when configured.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return saveUploadToBlob({ ...params, buf });
  }

  const { storageName, sha256 } = buildStorageName(params.file.name, buf);
  const dir = path.join(uploadsRoot(), String(params.tenantId), params.entityPath);
  await mkdir(dir, { recursive: true });

  const storagePath = path.join(dir, storageName);
  await writeFile(storagePath, buf);

  return {
    storagePath,
    sha256,
    size: buf.byteLength,
    originalName: params.file.name,
    mimeType: params.file.type || "application/octet-stream",
  };
}

export async function tryDeleteStoredFile(storagePath: string) {
  // If it's a Blob URL, delete from Vercel Blob (best-effort).
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return;
    try {
      await del(storagePath);
    } catch {
      // best effort
    }
  }
}
