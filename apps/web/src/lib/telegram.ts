import { formatHandoffMessage } from "@tax/core";
import { prisma } from "@tax/db";
import { env } from "./env";

/**
 * Передача заявки в noname-канал исполнительниц (§4.5) прямо из web через
 * Bot API. Best-effort: если токен/канал не заданы или Telegram недоступен —
 * логируем и молчим, НЕ роняя создание заявки (клиент уже отправил анкету,
 * Татьяна увидит заявку в ЛК в любом случае).
 *
 * Почему из web, а не из бота: бот на long polling и не слушает события БД;
 * прямой вызов Bot API избавляет от outbox-инфраструктуры на пилоте. Токен —
 * тот же, что у бота (один секрет на два процесса, приемлемо для пилота).
 */
export async function sendHandoffToChannel(dealId: string): Promise<void> {
  const token = env().TELEGRAM_BOT_TOKEN;
  const channelId = env().TELEGRAM_CHANNEL_ID;
  if (!token || !channelId) {
    console.info("[handoff] TELEGRAM_BOT_TOKEN/CHANNEL_ID не заданы — передача в канал пропущена");
    return;
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
    if (!deal) return;

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
    });
    if (!res.ok) {
      console.error(`[handoff] Telegram sendMessage ${res.status}: ${await res.text()}`);
    }
  } catch (e) {
    console.error("[handoff] отправка в канал не удалась:", e);
  }
}
