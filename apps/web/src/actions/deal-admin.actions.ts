"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { changeDealStatus, changeDealStatusByCode, recalcDealCommission } from "@tax/core";
import { Prisma, prisma } from "@tax/db";
import { requireRole } from "@/lib/require-role";
import { sendHandoffToChannel } from "@/lib/telegram";

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
 * ВНИМАНИЕ: механизм самого подписания (галка/ЭЦП/сторонний сервис) — §11.14,
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

  // Авто-переход ТОЛЬКО ВПЕРЁД: повторная отправка договора со сделки в более
  // позднем статусе (например «В работе») не должна откатывать воронку назад
  const [deal, target] = await Promise.all([
    prisma.deal.findUnique({
      where: { id: dealId },
      select: { status: { select: { sortOrder: true } } },
    }),
    prisma.dealStatus.findUnique({
      where: { code: "CONTRACT_SENT" },
      select: { sortOrder: true },
    }),
  ]);
  const isForward = !!deal && !!target && deal.status.sortOrder < target.sortOrder;

  if (isForward) {
    const moved = await changeDealStatusByCode({
      dealId,
      toStatusCode: "CONTRACT_SENT",
      mode: "AUTO",
      source: "WEB",
      actorUserId: session.user.id,
      comment: "Договор отправлен клиенту",
    });
    // Результат НЕ игнорируем: статус мог быть деактивирован в настройках —
    // дата отправки записана, но воронка не сдвинулась, честно говорим об этом
    if (!moved.ok) {
      revalidatePath(`/admin/deals/${dealId}`);
      return {
        error:
          "Дата отправки записана, но статус не изменён: «Договор отправлен» " +
          "выключен в настройках статусов.",
      };
    }
  }

  revalidatePath(`/admin/deals/${dealId}`);
  return { ok: true };
}

/**
 * Повторная отправка заявки в noname-канал (§4.5): для сделок, у которых
 * хендофф не прошёл (handoffSentAt=null — Telegram лежал или не был настроен).
 */
export async function resendHandoffAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  await requireRole("ADMIN");
  const dealId = String(formData.get("dealId") ?? "");
  if (!dealId) return { error: "Сделка не указана." };

  const sent = await sendHandoffToChannel(dealId);
  revalidatePath(`/admin/deals/${dealId}`);
  if (!sent) {
    return {
      error:
        "Не удалось отправить в канал: проверьте TELEGRAM_BOT_TOKEN/TELEGRAM_CHANNEL_ID " +
        "и доступность Telegram.",
    };
  }
  return { ok: true };
}

/** Отметить «договор подписан» (§4.8) — симметрично отправке, только дата */
export async function markContractSignedAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  await requireRole("ADMIN");
  const dealId = String(formData.get("dealId") ?? "");
  if (!dealId) return { error: "Сделка не указана." };

  await prisma.deal.update({
    where: { id: dealId },
    data: { contractSignedAt: new Date() },
  });
  revalidatePath(`/admin/deals/${dealId}`);
  return { ok: true };
}

/**
 * Перепривязка заявки на другого риэлтора (контракт плана §1: last click +
 * «у админа есть ручная перепривязка» — споры атрибуции решает Татьяна).
 * Пишем AuditLog с from→to: смена влияет на будущие 15% риэлтора.
 */
export async function reassignRealtorAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const session = await requireRole("ADMIN");
  const parsed = z
    .object({ dealId: z.string().min(1), realtorId: z.string().min(1) })
    .safeParse({ dealId: formData.get("dealId"), realtorId: formData.get("realtorId") });
  if (!parsed.success) return { error: "Выберите риэлтора." };

  const target = await prisma.realtorProfile.findUnique({
    where: { id: parsed.data.realtorId },
    select: { id: true },
  });
  if (!target) return { error: "Риэлтор не найден." };

  const deal = await prisma.deal.findUnique({
    where: { id: parsed.data.dealId },
    select: { realtorId: true },
  });
  if (!deal) return { error: "Сделка не найдена." };
  if (deal.realtorId === parsed.data.realtorId) return { ok: true }; // уже он

  await prisma.$transaction([
    prisma.deal.update({
      where: { id: parsed.data.dealId },
      data: { realtorId: parsed.data.realtorId },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "deal.realtor.reassign",
        entityType: "Deal",
        entityId: parsed.data.dealId,
        payload: { from: deal.realtorId, to: parsed.data.realtorId },
      },
    }),
  ]);

  revalidatePath(`/admin/deals/${parsed.data.dealId}`);
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
