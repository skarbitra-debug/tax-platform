import { prisma } from "@tax/db";
import { changeDealStatus } from "../status/engine";

/**
 * Применение голосовой команды смены статуса (§4.7 ТЗ).
 *
 * Разделение ответственности:
 *  - STT (речь→текст) и разбор намерения (текст→{номер сделки, код статуса})
 *    делает БОТ (apps/bot) через сменные адаптеры (Yandex/Whisper + Claude);
 *  - здесь — ПРИМЕНЕНИЕ уже разобранного намерения: находим сделку по номеру,
 *    двигаем статус (source=TELEGRAM_VOICE), пишем VoiceCommandLog со сквозной
 *    трассировкой «голос → запись в истории статусов».
 *
 * Функция чистая относительно LLM/STT — тестируется на живой БД с готовым
 * распарсенным намерением, без сети.
 */

export interface VoiceCommandMeta {
  chatId: bigint;
  messageId: bigint;
  fileId?: string | null;
  telegramAccountId?: string | null;
  /** User.id Татьяны, если её чат привязан к аккаунту (для автора истории) */
  actorUserId?: string | null;
}

export interface ParsedVoiceIntent {
  /** человекочитаемый номер сделки (Deal.number) */
  dealNumber: number | null;
  /** стабильный код целевого статуса (DealStatus.code) */
  targetStatusCode: string | null;
  /** сырой текст расшифровки — в лог */
  transcript: string;
  /** дополнительная заметка из речи (в комментарий истории) */
  note?: string | null;
}

export type ApplyVoiceResult =
  | { ok: true; dealNumber: number; toStatusLabel: string; logId: string }
  | { ok: false; reason: "DEAL_NOT_FOUND" | "STATUS_NOT_FOUND" | "NO_INTENT" | "STATUS_UNCHANGED"; logId: string };

export async function applyVoiceCommand(
  intent: ParsedVoiceIntent,
  meta: VoiceCommandMeta,
): Promise<ApplyVoiceResult> {
  // Лог создаём сразу — он переживает любой исход (в т.ч. отказ)
  const log = await prisma.voiceCommandLog.create({
    data: {
      telegramAccountId: meta.telegramAccountId ?? null,
      chatId: meta.chatId,
      messageId: meta.messageId,
      fileId: meta.fileId ?? null,
      transcript: intent.transcript,
      parsedIntent: {
        dealNumber: intent.dealNumber,
        targetStatusCode: intent.targetStatusCode,
        note: intent.note ?? null,
      },
      status: "PARSED",
    },
    select: { id: true },
  });

  const fail = async (
    reason: Exclude<ApplyVoiceResult, { ok: true }>["reason"],
    logStatus: "REJECTED" | "FAILED",
  ): Promise<ApplyVoiceResult> => {
    await prisma.voiceCommandLog.update({
      where: { id: log.id },
      data: { status: logStatus, error: reason, processedAt: new Date() },
    });
    return { ok: false, reason, logId: log.id };
  };

  if (intent.dealNumber === null || intent.targetStatusCode === null) {
    return fail("NO_INTENT", "REJECTED");
  }

  const deal = await prisma.deal.findUnique({
    where: { number: intent.dealNumber },
    select: { id: true, number: true },
  });
  if (!deal) return fail("DEAL_NOT_FOUND", "REJECTED");

  const status = await prisma.dealStatus.findUnique({
    where: { code: intent.targetStatusCode },
    select: { id: true, label: true },
  });
  if (!status) return fail("STATUS_NOT_FOUND", "REJECTED");

  const changed = await changeDealStatus({
    dealId: deal.id,
    toStatusId: status.id,
    mode: "MANUAL", // голос = человек (Татьяна) решил, просто озвучил
    source: "TELEGRAM_VOICE",
    actorUserId: meta.actorUserId ?? null,
    comment: intent.note ?? null,
    voiceCommandLogId: log.id, // сквозная трассировка
  });

  if (!changed.ok) return fail("STATUS_NOT_FOUND", "FAILED");
  if (!changed.changed) {
    // сделка уже в этом статусе — фиксируем как «без изменений», не ошибка
    await prisma.voiceCommandLog.update({
      where: { id: log.id },
      data: { status: "APPLIED", dealId: deal.id, processedAt: new Date() },
    });
    return { ok: false, reason: "STATUS_UNCHANGED", logId: log.id };
  }

  await prisma.voiceCommandLog.update({
    where: { id: log.id },
    data: { status: "APPLIED", dealId: deal.id, processedAt: new Date() },
  });

  return { ok: true, dealNumber: deal.number, toStatusLabel: status.label, logId: log.id };
}

/**
 * Каталог для LLM-разбора: свежие незакрытые сделки + активные статусы.
 * Бот кладёт это в промпт Claude, чтобы тот сопоставил речь с номером сделки
 * и кодом статуса (модель не выдумывает несуществующие).
 *
 * ПД в промпт НЕ уходят (инвариант §7 ТЗ / RUNBOOK: «только номера сделок и
 * статусы, никаких ФИО»). Это же закрывает prompt-инъекцию через firstName
 * из публичной анкеты. Татьяна командует номером сделки («по сделке 12») —
 * номер показан в её ЛК и в карточках.
 */
export async function buildVoiceContext(limit = 50): Promise<{
  deals: { number: number; statusCode: string }[];
  statuses: { code: string; label: string }[];
}> {
  const [deals, statuses] = await Promise.all([
    prisma.deal.findMany({
      where: { status: { isTerminal: false } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { number: true, status: { select: { code: true } } },
    }),
    prisma.dealStatus.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { code: true, label: true },
    }),
  ]);
  return {
    deals: deals.map((d) => ({ number: d.number, statusCode: d.status.code })),
    statuses,
  };
}
