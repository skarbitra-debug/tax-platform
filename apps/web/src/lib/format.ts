/**
 * Формат денег для UI (контракт §1: в БД деньги — Decimal(14,2) в рублях).
 * Принимает unknown: Prisma Decimal, number или строку — всё, что осмысленно
 * приводится через Number(). Пример: 1234567 → "1 234 567 ₽".
 * Общий хелпер: используется и в ЛК риэлтора, и в админ-зоне.
 */
export function formatRub(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "— ₽";
  // ru-RU даёт пробелы-разделители разрядов; копейки показываем только
  // когда они есть (Decimal(14,2) → максимум 2 знака после запятой)
  return `${n.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
}
