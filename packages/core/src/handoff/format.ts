/**
 * Форматирование сообщения передачи заявки в noname-канал исполнительниц
 * (§4.5 ТЗ). Чистая функция без БД/сети — тестируема; отправку делает адаптер
 * (apps/web/lib/telegram) через Bot API.
 *
 * NONAME (§4.5): в сообщении НЕТ ни личности риэлтора, ни контактов «девочек» —
 * только данные клиента, необходимые, чтобы девочки с ним связались, и краткая
 * сводка по сделке. Личность исполнительниц для клиента остаётся скрытой на
 * уровне самого канала.
 */

export interface HandoffDeal {
  number: number;
  clientFirstName: string;
  clientPhone: string;
  clientTelegram: string | null;
  taxPaidAmount: string; // Decimal→string рубли
  belowThreshold: boolean;
}

/** Экранирование под Telegram HTML parse_mode */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Рубли-строка "455000" → "455 000 ₽" */
function rub(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return `${v} ₽`;
  return `${n.toLocaleString("ru-RU")} ₽`;
}

export function formatHandoffMessage(deal: HandoffDeal): string {
  const lines = [
    `<b>Новая заявка № ${deal.number}</b>`,
    ``,
    `Клиент: ${esc(deal.clientFirstName)}`,
    `Телефон: ${esc(deal.clientPhone)}`,
    ...(deal.clientTelegram ? [`Telegram: @${esc(deal.clientTelegram)}`] : []),
    `Уплачено налога: ${rub(deal.taxPaidAmount)}`,
    ...(deal.belowThreshold ? [`⚠️ Ниже порога — на усмотрение`] : []),
    ``,
    `Свяжитесь с клиентом и запросите документы.`,
  ];
  return lines.join("\n");
}
