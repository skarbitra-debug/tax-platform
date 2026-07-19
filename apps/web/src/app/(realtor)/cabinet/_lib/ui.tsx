/**
 * Общие элементы кабинета риэлтора: статус-бейджи и формат даты.
 * Используются дашбордом (/cabinet — лента последних заявок) и полным
 * списком (/cabinet/deals). Папка _lib роутом не является.
 */

/** Дата по МСК: аудитория в РФ, сервер — зарубежный (UTC) */
export function formatDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Moscow",
  });
}

/**
 * Статус-бейдж: label + color из DealStatus (админ настраивает, §6 ТЗ).
 * color — hex вида #16a34a; заливка — он же с ~12% альфы (суффикс "1f").
 * color не задан (seed его не заполняет) → нейтральный серый.
 */
export function StatusBadge({ status }: { status: { label: string; color: string | null } }) {
  if (!status.color) {
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
        {status.label}
      </span>
    );
  }
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: status.color, backgroundColor: `${status.color}1f` }}
    >
      {status.label}
    </span>
  );
}

/** Пометка «ниже порога» (§1: анкета не отсекает — решение за Татьяной) */
export function BelowThresholdBadge() {
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      Ниже порога
    </span>
  );
}
