export const metadata = { title: "Админ-панель" };

/** [M0-skel] Обзор для Татьяны; списки сделок/риэлторов/инвайтов — M1-7 */
export default function AdminPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Обзор платформы</h1>

      <section className="grid gap-4 sm:grid-cols-3">
        {["Всего заявок", "Активные риэлторы", "Инвайт-коды"].map((label) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-300">—</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
        <h2 className="text-base font-semibold">Разделы в разработке</h2>
        <p className="mt-2 text-sm text-slate-600">
          Списки сделок с фильтрами, управление риэлторами и инвайт-кодами
          появятся в M1. Настройки комиссий — M2+.
        </p>
      </section>
    </div>
  );
}
