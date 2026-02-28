import { createHash } from "crypto";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function safeDbInfo(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || null,
      db: parsed.pathname?.replace(/^\//, "") || null,
      fp: fingerprint(url),
    };
  } catch {
    return { host: null, port: null, db: null, fp: fingerprint(url) };
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const databaseUrl = process.env.DATABASE_URL ?? "";
  const info = databaseUrl ? safeDbInfo(databaseUrl) : { host: null, port: null, db: null, fp: null };

  const [hasTxnTdsAmount, hasTxnAlloc, hasTenantProfile] = await Promise.all([
    prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='Transaction' AND column_name='tdsAmount'
      ) as "exists"
    `,
    prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT (to_regclass('public."TransactionAllocation"') IS NOT NULL) as "exists"
    `,
    prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT (to_regclass('public."TenantProfile"') IS NOT NULL) as "exists"
    `,
  ]);

  const migrations = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT "migration_name" as "name"
    FROM "_prisma_migrations"
    ORDER BY finished_at DESC NULLS LAST
    LIMIT 20
  `.catch(() => []);

  return NextResponse.json({
    tenantId: session.user.tenantId,
    database: info,
    schemaChecks: {
      transaction_tdsAmount: !!hasTxnTdsAmount?.[0]?.exists,
      transactionAllocation_table: !!hasTxnAlloc?.[0]?.exists,
      tenantProfile_table: !!hasTenantProfile?.[0]?.exists,
    },
    recentMigrations: migrations,
  });
}

