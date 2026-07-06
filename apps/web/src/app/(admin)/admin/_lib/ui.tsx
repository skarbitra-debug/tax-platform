/**
 * Общие мелочи админки: бейджи и форматирование дат.
 * Папка _lib роутом не является (underscore-конвенция App Router).
 * Всё серверно-совместимо — «use client» не нужен.
 */

const dateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** «06.07.26, 14:05» — серверная TZ; на пилоте все в одном поясе */
export function formatDateTime(d: Date): string {
  return dateTimeFmt.format(d);
}

/** «06.07.2026» */
export function formatDate(d: Date): string {
  return dateFmt.format(d);
}

/**
 * Бейдж статуса сделки: цветная точка + label. Цвет — свободная строка
 * DealStatus.color (правит админ), поэтому точка через inline-style,
 * а не через классы; мусорный цвет портит только точку, не текст.
 */
export function StatusBadge({ label, color }: { label: string; color: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? "#94a3b8" }}
        aria-hidden
      />
      {label}
    </span>
  );
}

/** Предупреждающий бейдж («ниже порога», «возможный дубль») */
export function FlagBadge({ text, tone }: { text: string; tone: "amber" | "red" }) {
  const cls =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-red-200 bg-red-50 text-red-700";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {text}
    </span>
  );
}

/** User.status → русский бейдж (сама блокировка из UI — M2, здесь только отображение) */
const USER_STATUS_RU = {
  ACTIVE: { label: "Активен", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  PENDING: { label: "Ожидает", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  BLOCKED: { label: "Заблокирован", cls: "border-red-200 bg-red-50 text-red-700" },
} as const;

export function UserStatusBadge({ status }: { status: keyof typeof USER_STATUS_RU }) {
  const s = USER_STATUS_RU[status];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
