import { formatHandoffMessage } from "@tax/core";
import { prisma } from "@tax/db";
import { env } from "./env";

/**
 * Передача заявки в noname-канал исполнительниц (§4.5) прямо из web через
 * Bot API. Best-effort: если токен/канал не заданы или Telegram недоступен —
 * логируем и НЕ роняем заявку, но фиксируем исход: успех пишет
 * Deal.handoffSentAt, иначе поле остаётся null → в карточке сделки бейдж
 * «не передана в канал» + кнопка повторной отправки (без этого пропуск
 * хендоффа был невидим нигде, кроме docker logs).
 *
 * Вызывается через after() (после ответа клиенту) — сабмит анкеты не ждёт
 * Telegram; fetch дополнительно ограничен таймаутом 5с (недоступность
 * api.telegram.org с РФ-хостинга — реалистичный сценарий, а дефолты undici
 * держали бы соединение минуты).
 *
 * Почему из web, а не из бота: бот на long polling и не слушает события БД;
 * прямой вызов Bot API избавляет от outbox-инфраструктуры на пилоте.
 *
 * @returns true, если сообщение доставлено в канал
 */
export async function sendHandoffToChannel(dealId: string): Promise<boolean> {
  const token = env().TELEGRAM_BOT_TOKEN;
  const channelId = env().TELEGRAM_CHANNEL_ID;
  if (!token || !channelId) {
    console.warn("[handoff] TELEGRAM_BOT_TOKEN/CHANNEL_ID не заданы — передача в канал пропущена");
    return false;
  }

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        number: true,
        taxPaidAmount: true,
        belowThreshold: true,
        client: { select: { firstName: true, phone: true, telegramUsername: true } },
      },
    });
    if (!deal) return false;

    const text = formatHandoffMessage({
      number: deal.number,
      clientFirstName: deal.client.firstName,
      clientPhone: deal.client.phone,
      clientTelegram: deal.client.telegramUsername,
      taxPaidAmount: deal.taxPaidAmount.toString(),
      belowThreshold: deal.belowThreshold,
    });

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: channelId, text, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[handoff] Telegram sendMessage ${res.status}: ${await res.text()}`);
      return false;
    }

    await prisma.deal.update({ where: { id: dealId }, data: { handoffSentAt: new Date() } });
    return true;
  } catch (e) {
    console.error("[handoff] отправка в канал не удалась:", e);
    return false;
  }
}
