import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/server/db";

type AuditWriter = Prisma.TransactionClient | PrismaClient;

type AuditLogInput = {
  tenantId: number;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

function normalizeAuditData(input: AuditLogInput) {
  return {
    tenantId: input.tenantId,
    userId: input.userId ?? null,
    userEmail: input.userEmail ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    summary: input.summary,
    metadata: input.metadata ?? Prisma.JsonNull,
  };
}

export async function writeAuditLog(writer: AuditWriter, input: AuditLogInput) {
  await writer.auditLog.create({ data: normalizeAuditData(input) });
}

export async function safeWriteAuditLog(input: AuditLogInput) {
  try {
    await prisma.auditLog.create({ data: normalizeAuditData(input) });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}
