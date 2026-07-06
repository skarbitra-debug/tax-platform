export const metadata = { title: "Кабинет партнёра" };

/** [M0-skel] Дашборд риэлтора; блок реф-ссылки и счётчики приезжают в M1-3 */
export default function CabinetPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Добро пожаловать!</h1>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
        <h2 className="text-base font-semibold">Моя ссылка для клиентов</h2>
        <p className="mt-2 text-sm text-slate-600">
          Ваша реф-ссылка появится здесь (M1). Вы сможете создать её в один клик,
          скопировать и отправить клиенту в мессенджере.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {["Заявки", "В работе", "Выплачено"].map((label) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-300">—</p>
          </div>
        ))}
      </section>
    </div>
  );
}
