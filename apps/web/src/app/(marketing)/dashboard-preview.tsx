/**
 * [M5] Превью кабинета (секция «Всё под контролем» референса). Стилизованный
 * тёмный мокап реального ЛК риэлтора: реф-ссылка + список заявок со статус-
 * бейджами. Серверный компонент (статичная разметка, без интерактива).
 */

const DEALS = [
  { client: "Иван П.", tax: "455 000 ₽", status: "Новая заявка", dot: "#3b82f6" },
  { client: "Мария С.", tax: "312 000 ₽", status: "Проверка ФНС", dot: "#f59e0b" },
  { client: "Олег К.", tax: "690 000 ₽", status: "Деньги на ЕНС", dot: "#10b981" },
  { client: "Анна В.", tax: "228 000 ₽", status: "Клиент оплатил", dot: "#10b981" },
];

export function DashboardPreview() {
  return (
    <div className="landing-card overflow-hidden rounded-2xl">
      {/* Хром окна браузера */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-white/15" />
        <span className="h-3 w-3 rounded-full bg-white/15" />
        <span className="h-3 w-3 rounded-full bg-white/15" />
        <span className="ml-3 text-xs text-white/40">Личный кабинет риэлтора</span>
      </div>

      <div className="p-5 sm:p-6">
        {/* Блок реф-ссылки */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs text-white/40">Ваша партнёрская ссылка</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <code className="truncate text-sm text-white/80">clients.возврат.рф/r/k7m2p9xq4a3b</code>
            <span
              className="shrink-0 rounded-lg px-3 py-1 text-xs font-medium text-white"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Копировать
            </span>
          </div>
        </div>

        {/* Счётчики */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { v: "12", l: "всего заявок" },
            { v: "3", l: "новых" },
            { v: "108 000 ₽", l: "вознаграждение" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
              <div className="text-lg font-bold text-emerald-gradient">{s.v}</div>
              <div className="text-[11px] text-white/40">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Список заявок */}
        <div className="mt-4 space-y-2">
          {DEALS.map((d) => (
            <div
              key={d.client}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium text-white">{d.client}</div>
                <div className="text-xs text-white/40">налог {d.tax}</div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/70">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: d.dot }} />
                {d.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
