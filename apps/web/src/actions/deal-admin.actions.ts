"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { changeDealStatus, changeDealStatusByCode, recalcDealCommission } from "@tax/core";
import { Prisma, prisma } from "@tax/db";
import { requireRole } from "@/lib/require-role";

/** Состояние форм карточки сделки (useActionState) */
export type DealActionState = { ok?: boolean; error?: string };

/**
 * Рубли из формы → Decimal(14,2). Принимаем "1 234 567", "1234567.89", "1234567,5".
 * Отвергаем мусор, отрицательные и超-суммы. Возвращает строку для Prisma.Decimal.
 */
const rublesSchema = z
  .string()
  .transform((v) => v.replace(/\s/g, "").replace(",", "."))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Введите сумму в рублях (например 1250000 или 1250000.50)")
  .refine((v) => Number(v) <= 2_000_000_000, "Сумма слишком большая");

/** Ручная смена статуса сделки (§6): mode=MANUAL, source=WEB, актор — Татьяна */
export async function changeStatusAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const session = await requireRole("ADMIN");
  const parsed = z
    .object({
      dealId: z.string().min(1),
      toStatusId: z.string().min(1),
      comment: z.string().trim().max(500).optional().or(z.literal("")),
    })
    .safeParse({
      dealId: formData.get("dealId"),
      toStatusId: formData.get("toStatusId"),
      comment: formData.get("comment"),
    });
  if (!parsed.success) return { error: "Проверьте поля формы." };

  const res = await changeDealStatus({
    dealId: parsed.data.dealId,
    toStatusId: parsed.data.toStatusId,
    mode: "MANUAL",
    source: "WEB",
    actorUserId: session.user.id,
    comment: parsed.data.comment || null,
  });
  if (!res.ok) return { error: "Не удалось сменить статус: " + res.reason };

  revalidatePath(`/admin/deals/${parsed.data.dealId}`);
  return { ok: true };
}

/** Проставить фактический возврат → пересчитать распределение комиссий (§2) */
export async function setRefundAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  await requireRole("ADMIN");
  const parsed = z
    .object({ dealId: z.string().min(1), refund: rublesSchema })
    .safeParse({ dealId: formData.get("dealId"), refund: formData.get("refund") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте сумму возврата." };
  }

  await prisma.deal.update({
    where: { id: parsed.data.dealId },
    data: { actualRefundAmount: new Prisma.Decimal(parsed.data.refund) },
  });
  const recalc = await recalcDealCommission(parsed.data.dealId);
  if (!recalc.ok && recalc.reason === "NO_CONFIG") {
    return { error: "Нет активного конфига комиссий — выполните seed/настройку." };
  }

  revalidatePath(`/admin/deals/${parsed.data.dealId}`);
  return { ok: true };
}

/** Ручная отметка «клиент оплатил» (эквайринга нет — §10, только факт) */
export async function markClientPaidAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const session = await requireRole("ADMIN");
  const parsed = z
    .object({ dealId: z.string().min(1), amount: rublesSchema })
    .safeParse({ dealId: formData.get("dealId"), amount: formData.get("amount") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте сумму оплаты." };
  }

  await prisma.deal.update({
    where: { id: parsed.data.dealId },
    data: {
      clientPaidAmount: new Prisma.Decimal(parsed.data.amount),
      clientPaidAt: new Date(),
      clientPaidMarkedById: session.user.id,
    },
  });

  revalidatePath(`/admin/deals/${parsed.data.dealId}`);
  return { ok: true };
}

/**
 * Отметить «договор отправлен клиенту» (§4.8): фиксируем contractSentAt и
 * двигаем статус на CONTRACT_SENT (авто-переход по событию, §6).
 * ВНИМАНИЕ: механизм самого подписания (галка/ЭЦП/сторонний сервис) — §11.3,
 * пока не определён; здесь трекается только факт отправки.
 */
export async function markContractSentAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const session = await requireRole("ADMIN");
  const dealId = String(formData.get("dealId") ?? "");
  if (!dealId) return { error: "Сделка не указана." };

  await prisma.deal.update({
    where: { id: dealId },
    data: { contractSentAt: new Date() },
  });
  // авто-переход статуса по событию «договор отправлен»
  await changeDealStatusByCode({
    dealId,
    toStatusCode: "CONTRACT_SENT",
    mode: "AUTO",
    source: "WEB",
    actorUserId: session.user.id,
    comment: "Договор отправлен клиенту",
  });

  revalidatePath(`/admin/deals/${dealId}`);
  return { ok: true };
}

/** Ручная отметка выплаты получателю (§4.6: без автоматики) */
export async function addPayoutAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const session = await requireRole("ADMIN");
  const parsed = z
    .object({
      dealId: z.string().min(1),
      recipientType: z.enum(["REALTOR", "PLATFORM_AGENCY", "EXECUTOR", "OTHER"]),
      realtorId: z.string().optional().or(z.literal("")),
      amount: rublesSchema,
      comment: z.string().trim().max(300).optional().or(z.literal("")),
    })
    .safeParse({
      dealId: formData.get("dealId"),
      recipientType: formData.get("recipientType"),
      realtorId: formData.get("realtorId"),
      amount: formData.get("amount"),
      comment: formData.get("comment"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля выплаты." };
  }

  await prisma.payout.create({
    data: {
      dealId: parsed.data.dealId,
      recipientType: parsed.data.recipientType,
      realtorId:
        parsed.data.recipientType === "REALTOR" && parsed.data.realtorId
          ? parsed.data.realtorId
          : null,
      amount: new Prisma.Decimal(parsed.data.amount),
      paidAt: new Date(),
      markedById: session.user.id,
      comment: parsed.data.comment || null,
    },
  });

  revalidatePath(`/admin/deals/${parsed.data.dealId}`);
  return { ok: true };
}
