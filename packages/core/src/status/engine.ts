import { prisma } from "@tax/db";

/**
 * Движок статусов сделки (§6 ТЗ, гибрид авто+ручной).
 * Набор статусов КОНФИГУРИРУЕМЫЙ (таблица DealStatus, не enum) — здесь
 * ничего не захардкожено, кроме признаков isInitial/isActive.
 */

export type StatusChangeMode = "AUTO" | "MANUAL";
export type ChangeSource = "WEB" | "TELEGRAM_VOICE" | "TELEGRAM_TEXT" | "SYSTEM";

export interface ChangeStatusArgs {
  dealId: string;
  toStatusId: string;
  mode: StatusChangeMode;
  source: ChangeSource;
  /** кто сменил (null для AUTO/SYSTEM) */
  actorUserId?: string | null;
  comment?: string | null;
  /** трассировка «голос → смена статуса» (M3) */
  voiceCommandLogId?: string | null;
}

export type ChangeStatusResult =
  | { ok: true; changed: boolean; fromStatusId: string | null; toStatusId: string }
  | { ok: false; reason: "DEAL_NOT_FOUND" | "STATUS_NOT_FOUND" | "STATUS_INACTIVE" };

/** Активные статусы воронки по порядку (для селектов и отображения) */
export function listActiveStatuses() {
  return prisma.dealStatus.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, label: true, sortOrder: true, color: true, isInitial: true, isTerminal: true },
  });
}

/**
 * Сменить статус сделки. Единая точка и для ручной смены (админ, mode=MANUAL,
 * source=WEB), и для авто-событий (mode=AUTO, source=SYSTEM/TELEGRAM_VOICE).
 * Атомарно: обновляет Deal.statusId и пишет запись в DealStatusHistory.
 * Если статус уже текущий — no-op без записи в историю (changed=false).
 */
export async function changeDealStatus(args: ChangeStatusArgs): Promise<ChangeStatusResult> {
  const deal = await prisma.deal.findUnique({
    where: { id: args.dealId },
    select: { id: true, statusId: true },
  });
  if (!deal) return { ok: false, reason: "DEAL_NOT_FOUND" };

  const target = await prisma.dealStatus.findUnique({
    where: { id: args.toStatusId },
    select: { id: true, isActive: true },
  });
  if (!target) return { ok: false, reason: "STATUS_NOT_FOUND" };
  if (!target.isActive) return { ok: false, reason: "STATUS_INACTIVE" };

  // Уже в этом статусе → ничего не делаем, историю не засоряем
  if (deal.statusId === target.id) {
    return { ok: true, changed: false, fromStatusId: deal.statusId, toStatusId: target.id };
  }

  await prisma.$transaction([
    prisma.deal.update({ where: { id: deal.id }, data: { statusId: target.id } }),
    prisma.dealStatusHistory.create({
      data: {
        dealId: deal.id,
        fromStatusId: deal.statusId,
        toStatusId: target.id,
        mode: args.mode,
        source: args.source,
        changedById: args.actorUserId ?? null,
        comment: args.comment ?? null,
        voiceCommandLogId: args.voiceCommandLogId ?? null,
      },
    }),
  ]);

  return { ok: true, changed: true, fromStatusId: deal.statusId, toStatusId: target.id };
}

/**
 * Смена статуса по стабильному коду (для авто-событий и голосового ассистента
 * M3, которые оперируют кодами вроде "CONTRACT_SENT", а не UUID).
 */
export async function changeDealStatusByCode(
  args: Omit<ChangeStatusArgs, "toStatusId"> & { toStatusCode: string },
): Promise<ChangeStatusResult> {
  const status = await prisma.dealStatus.findUnique({
    where: { code: args.toStatusCode },
    select: { id: true },
  });
  if (!status) return { ok: false, reason: "STATUS_NOT_FOUND" };
  const { toStatusCode: _toStatusCode, ...rest } = args;
  return changeDealStatus({ ...rest, toStatusId: status.id });
}
