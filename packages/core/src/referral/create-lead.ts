import { prisma } from "@tax/db";
import { isUniqueViolation } from "../internal/prisma-errors";
import type { LeadFormInput } from "./lead-form";

/** Результат createLead: успех (в т.ч. идемпотентный повтор) или причина отказа */
export type CreateLeadResult =
  | { ok: true; dealId: string; dealNumber: number }
  | { ok: false; error: "LINK_INACTIVE" | "LINK_NOT_FOUND" };

/**
 * Hook после коммита createLead. В M1 — сознательный no-op: в M3 сюда встаёт
 * передача заявки в Telegram-канал исполнительниц (§4.5 ТЗ). Вызывается ТОЛЬКО
 * для реально созданной сделки — идемпотентный повтор двойного тапа не дублирует
 * побочные эффекты.
 */
async function onDealCreated(_dealId: string): Promise<void> {
  // no-op до M3
}

/**
 * Транзакция создания заявки (план §4, одна $transaction):
 *  1. ссылка по токену WHERE isActive — деактивация во время заполнения
 *     анкеты ловится здесь, ничего не создаётся;
 *  2. Client: reuse по нормализованному телефону (дозаполнение пустых полей)
 *     или create;
 *  3. открытая сделка (status.isTerminal=false) с тем же телефоном →
 *     duplicateOfDealId — бейдж «возможный дубль» у админа, НЕ блокируем
 *     (две квартиры = две легитимные сделки);
 *  4. Deal.create: суммы в рублях → Decimal(14,2), согласия + снапшоты из
 *     АКТИВНОГО конфига (consentRatePct — ставка, которую клиент ВИДЕЛ,
 *     юр. след §4.8; belowThreshold + thresholdAtSubmission — §8 вопрос 2),
 *     статус по isInitial=true (контракт §1: не хардкод code);
 *  5. DealStatusHistory {from: null, to: initial, AUTO, SYSTEM}.
 *
 * Идемпотентность: P2002 по submissionId ловится ВНЕ транзакции — двойной тап
 * означает, что первая транзакция уже закоммичена → перечитываем Deal и
 * возвращаем успех без дублей.
 *
 * input уже провалидирован leadFormSchema (телефон нормализован, суммы в
 * границах) — вызывающий action обязан парсить схемой, не сырой формой.
 */
export async function createLead(
  input: LeadFormInput,
  meta: { ip?: string | null; userAgent?: string | null },
): Promise<CreateLeadResult> {
  let result: CreateLeadResult;
  try {
    result = await prisma.$transaction(async (tx) => {
      // --- 1. Ссылка: строго isActive (перечитывается в транзакции, не доверяем SSR-рендеру)
      const link = await tx.referralLink.findUnique({
        where: { token: input.token },
        select: { id: true, realtorId: true, isActive: true },
      });
      if (!link) return { ok: false as const, error: "LINK_NOT_FOUND" as const };
      if (!link.isActive) return { ok: false as const, error: "LINK_INACTIVE" as const };

      // --- 2. Client: reuse-or-create по канон-телефону (phone @unique).
      // upsert компилируется в INSERT ... ON CONFLICT — атомарно, без гонки:
      // два одновременных сабмита с тем же телефоном не создадут дублей Client.
      let client = await tx.client.upsert({
        where: { phone: input.phone },
        create: {
          firstName: input.firstName,
          phone: input.phone,
          telegramUsername: input.telegram ?? null,
        },
        update: {}, // существующего здесь не трогаем — дозаполним ниже
      });
      // Дозаполняем ТОЛЬКО пустые поля (firstName пуст после обезличивания 152-ФЗ,
      // telegram мог не указываться в прошлый раз). Непустые не перетираем.
      const fill: { firstName?: string; telegramUsername?: string } = {};
      if (!client.firstName) fill.firstName = input.firstName;
      if (!client.telegramUsername && input.telegram) fill.telegramUsername = input.telegram;
      if (Object.keys(fill).length > 0) {
        client = await tx.client.update({ where: { id: client.id }, data: fill });
      }

      // --- 3. Мягкая дедупликация: свежайшая ОТКРЫТАЯ сделка с тем же телефоном
      const openDeal = await tx.deal.findFirst({
        where: { client: { phone: input.phone }, status: { isTerminal: false } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      // --- 4а. Снапшоты из активного конфига — читаем внутри транзакции,
      //         чтобы ставка и порог были согласованы на момент коммита
      const cfg = await tx.commissionConfig.findFirst({
        where: { isActive: true },
        orderBy: { effectiveFrom: "desc" },
        select: { clientRatePct: true, minTaxThreshold: true },
      });
      if (!cfg) throw new Error("Активный конфиг комиссий не найден — выполните seed.");

      // belowThreshold: порог задан и налог ниже него; порога нет → false (§1 план)
      const belowThreshold =
        cfg.minTaxThreshold !== null && input.taxPaidRub < cfg.minTaxThreshold.toNumber();

      // --- 4б. Начальный статус по isInitial (partial-unique гарантирует единственность)
      const initialStatus = await tx.dealStatus.findFirst({
        where: { isInitial: true, isActive: true },
        select: { id: true },
      });
      if (!initialStatus) {
        throw new Error("Начальный статус воронки (isInitial=true) не найден — выполните seed.");
      }

      // --- 4в. Сделка: целые рубли из анкеты → Decimal(14,2)
      const deal = await tx.deal.create({
        data: {
          clientId: client.id,
          realtorId: link.realtorId, // last click (§1): атрибуция токену реального сабмита
          referralLinkId: link.id,
          statusId: initialStatus.id,
          submissionId: input.submissionId,
          saleAmount: input.salePriceRub,
          taxPaidAmount: input.taxPaidRub,
          consentNoUnderstatement: input.consentNoUnderstatement,
          consentPaymentTerms: input.consentPaymentTerms,
          consentRatePct: cfg.clientRatePct, // Decimal как есть — без float-конверсий
          consentIp: meta.ip ?? null,
          consentUserAgent: meta.userAgent ?? null,
          belowThreshold,
          thresholdAtSubmission: cfg.minTaxThreshold,
          duplicateOfDealId: openDeal?.id ?? null,
        },
        select: { id: true, number: true },
      });

      // --- 5. История: первичная установка статуса (from: null — контракт §1)
      await tx.dealStatusHistory.create({
        data: {
          dealId: deal.id,
          fromStatusId: null,
          toStatusId: initialStatus.id,
          mode: "AUTO",
          source: "SYSTEM",
        },
      });

      return { ok: true as const, dealId: deal.id, dealNumber: deal.number };
    });
  } catch (e) {
    // P2002 по submissionId — двойной тап: первая транзакция уже закоммичена.
    // Ловим снаружи $transaction (внутри соединение уже в abort-состоянии).
    if (isUniqueViolation(e)) {
      const existing = await prisma.deal.findUnique({
        where: { submissionId: input.submissionId },
        select: { id: true, number: true },
      });
      if (existing) {
        return { ok: true, dealId: existing.id, dealNumber: existing.number };
      }
    }
    throw e;
  }

  // Hook строго ПОСЛЕ коммита — упавший side-effect не откатит заявку
  if (result.ok) await onDealCreated(result.dealId);
  return result;
}
