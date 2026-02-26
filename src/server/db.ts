import { PrismaClient } from "@prisma/client";

// Vercel/Prisma integrations may provide different env var names.
// Prisma Client expects `DATABASE_URL` because our Prisma schema uses `env("DATABASE_URL")`.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.PRISMA_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL_ ??
    process.env.DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
