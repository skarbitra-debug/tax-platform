import Link from "next/link";

/**
 * [M5] Витрина для риэлтора (§4.1): оффер + как работает + выгоды + FAQ + CTA.
 * Контент и структура финальные; фирменные цвета/шрифты придут от Татьяны
 * (§11.4) — акцент вынесен в CSS-переменные (globals.css), перекраска локальна.
 */

const STEPS = [
  {
    n: "1",
    title: "Отправляете ссылку",
    text: "Генерируете персональную ссылку в кабинете и отправляете клиенту, который продал недвижимость.",
  },
  {
    n: "2",
    title: "Клиент оставляет заявку",
    text: "Заполняет короткую анкету по вашей ссылке. Заявка автоматически закрепляется за вами.",
  },
  {
    n: "3",
    title: "Мы возвращаем налог",
    text: "Наши специалисты проверяют переплату, готовят документы и ведут возврат через ФНС.",
  },
  {
    n: "4",
    title: "Вы получаете вознаграждение",
    text: "После успешного возврата и оплаты клиентом вы получаете свою долю. Всё видно в кабинете.",
  },
];

const BENEFITS = [
  {
    title: "Законно",
    text: "Возвращаем переплаченный НДФЛ по сделкам с недвижимостью в рамках закона — не «схемы».",
  },
  {
    title: "Без вложений для клиента",
    text: "Клиент платит комиссию только с фактически возвращённого налога — после результата.",
  },
  {
    title: "Прозрачно",
    text: "Каждая заявка — со статусом: от «новой» до «выплаты сделаны». Вы всегда в курсе.",
  },
];

const FAQ = [
  {
    q: "Кому подойдёт возврат?",
    a: "Клиентам, которые продали недвижимость и заплатили налог — часто переплаченный из-за неверной консультации.",
  },
  {
    q: "Сколько это стоит клиенту?",
    a: "Клиент платит комиссию только с фактически возвращённой суммы и только после того, как деньги поступили. Никаких предоплат.",
  },
  {
    q: "Как я получу вознаграждение?",
    a: "За каждого клиента, которому вернули налог, вы получаете свою долю. Выплата — после оплаты клиентом.",
  },
  {
    q: "Как стать партнёром?",
    a: "Регистрация — по инвайт-коду от вашего агентства. Получите код у директора и зарегистрируйтесь за минуту.",
  },
];

function Cta({ variant = "primary" }: { variant?: "primary" | "ghost" }) {
  if (variant === "ghost") {
    return (
      <Link
        href="/login"
        className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
      >
        У меня уже есть аккаунт
      </Link>
    );
  }
  return (
    <Link
      href="/register"
      className="rounded-xl px-6 py-3 text-base font-semibold text-white hover:opacity-90"
      style={{ backgroundColor: "var(--accent)" }}
    >
      Стать партнёром
    </Link>
  );
}

export default function MarketingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      {/* Hero */}
      <section className="py-16 sm:py-20">
        <div className="max-w-2xl">
          <p
            className="mb-3 inline-block rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent-ink)" }}
          >
            Партнёрская программа для риэлторов
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Ваши клиенты возвращают налоги за прошлые годы — вы получаете вознаграждение
          </h1>
          <p className="mt-5 text-lg text-slate-600">
            Продали клиенту квартиру? Помогите ему вернуть переплаченный налог. Отправьте
            персональную ссылку — остальное сделаем мы, а вы видите статус каждой заявки в
            личном кабинете.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Cta />
            <Cta variant="ghost" />
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Регистрация — по инвайт-коду от вашего агентства.
          </p>
        </div>
      </section>

      {/* Как это работает */}
      <section className="border-t border-slate-200 py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Как это работает</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {s.n}
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Выгоды */}
      <section className="border-t border-slate-200 py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Почему это работает</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-lg font-semibold">{b.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-slate-200 py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Частые вопросы</h2>
        <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer list-none font-medium marker:content-none">
                <span className="flex items-center justify-between gap-4">
                  {f.q}
                  <span className="text-slate-400 transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Финальный CTA */}
      <section className="border-t border-slate-200 py-16">
        <div
          className="rounded-3xl px-6 py-12 text-center"
          style={{ backgroundColor: "var(--accent-soft)" }}
        >
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Начните зарабатывать на возвратах
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Присоединяйтесь к партнёрской сети. Один инвайт-код — и вы уже отправляете
            клиентам ссылки.
          </p>
          <div className="mt-8 flex justify-center">
            <Cta />
          </div>
        </div>
      </section>
    </div>
  );
}
