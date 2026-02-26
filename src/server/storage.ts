import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function uploadsRoot() {
  return path.join(process.cwd(), "uploads");
}

export async function saveUploadToDisk(params: {
  tenantId: number;
  entityPath: string;
  file: File;
}) {
  const arrayBuffer = await params.file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  const hash = createHash("sha256").update(buf).digest("hex");
  const safeName = params.file.name.replaceAll(/[^\w.\-()+@ ]/g, "_");

  const dir = path.join(uploadsRoot(), String(params.tenantId), params.entityPath);
  await mkdir(dir, { recursive: true });

  const storageName = `${Date.now()}-${hash.slice(0, 12)}-${safeName}`;
  const storagePath = path.join(dir, storageName);
  await writeFile(storagePath, buf);

  return {
    storagePath,
    sha256: hash,
    size: buf.byteLength,
    originalName: params.file.name,
    mimeType: params.file.type || "application/octet-stream",
  };
}

