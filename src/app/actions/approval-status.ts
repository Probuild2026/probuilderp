"use server";

import { type ApprovalStatus } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import { type ActionResult } from "./_result";

const approvalStatusValues = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "CANCELLED"] as const;
const approvalTargetValues = ["bill", "expense", "wage", "payment", "receipt"] as const;

const updateApprovalStatusSchema = z.object({
  target: z.enum(approvalTargetValues),
  id: z.string().min(1),
  status: z.enum(approvalStatusValues),
});

function revalidateApprovalStatusPaths(target: z.infer<typeof updateApprovalStatusSchema>["target"], id: string) {
  if (target === "bill") {
    revalidatePath("/app/purchases/bills");
    revalidatePath(`/app/purchases/bills/${id}`);
    return;
  }
  if (target === "expense") {
    revalidatePath("/app/expenses");
    revalidatePath(`/app/expenses/${id}`);
    return;
  }
  if (target === "wage") {
    revalidatePath("/app/wages");
    revalidatePath(`/app/wages/${id}`);
    revalidatePath("/app/transactions");
    return;
  }
  if (target === "payment") {
    revalidatePath("/app/purchases/payments-made");
    revalidatePath(`/app/purchases/payments-made/${id}`);
    revalidatePath("/app/transactions");
    return;
  }
  revalidatePath("/app/sales/receipts");
  revalidatePath(`/app/sales/receipts/${id}`);
  revalidatePath("/app/transactions");
}

export async function updateApprovalStatus(input: unknown): Promise<ActionResult<{ id: string; status: ApprovalStatus }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } };

  const parsed = updateApprovalStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION", message: "Invalid approval status update." } };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.target === "bill") {
        const result = await tx.purchaseInvoice.updateMany({
          where: { tenantId: session.user.tenantId, id: parsed.data.id },
          data: { approvalStatus: parsed.data.status },
        });
        return result.count > 0;
      }

      if (parsed.data.target === "expense") {
        const result = await tx.expense.updateMany({
          where: { tenantId: session.user.tenantId, id: parsed.data.id },
          data: { approvalStatus: parsed.data.status },
        });
        return result.count > 0;
      }

      if (parsed.data.target === "payment") {
        const result = await tx.transaction.updateMany({
          where: { tenantId: session.user.tenantId, id: parsed.data.id, type: "EXPENSE", vendorId: { not: null } },
          data: { approvalStatus: parsed.data.status },
        });
        return result.count > 0;
      }

      if (parsed.data.target === "wage") {
        const sheet = await tx.labourSheet.findFirst({
          where: { tenantId: session.user.tenantId, id: parsed.data.id },
          select: { id: true, transactionId: true },
        });
        if (!sheet) return false;

        await tx.labourSheet.updateMany({
          where: { tenantId: session.user.tenantId, id: parsed.data.id },
          data: { approvalStatus: parsed.data.status },
        });

        if (sheet.transactionId) {
          await tx.transaction.updateMany({
            where: { tenantId: session.user.tenantId, id: sheet.transactionId },
            data: { approvalStatus: parsed.data.status },
          });
        }

        return true;
      }

      const receipt = await tx.receipt.findFirst({
        where: { tenantId: session.user.tenantId, id: parsed.data.id },
        select: { id: true, transactionId: true },
      });
      if (!receipt) return false;

      await tx.receipt.updateMany({
        where: { tenantId: session.user.tenantId, id: parsed.data.id },
        data: { approvalStatus: parsed.data.status },
      });

      if (receipt.transactionId) {
        await tx.transaction.updateMany({
          where: { tenantId: session.user.tenantId, id: receipt.transactionId },
          data: { approvalStatus: parsed.data.status },
        });
      }

      return true;
    });

    if (!updated) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Entry not found." } };
    }

    revalidateApprovalStatusPaths(parsed.data.target, parsed.data.id);
    return { ok: true, data: { id: parsed.data.id, status: parsed.data.status } };
  } catch {
    return { ok: false, error: { code: "INTERNAL", message: "Failed to update approval status." } };
  }
}
