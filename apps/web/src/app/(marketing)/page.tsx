import Link from "next/link";

/**
 * [M5] Витрина для риэлтора (§4.1). Тёмный премиум-дизайн по референсу
 * http://78.17.16.24: near-black фон, Inter, синий CTA + изумрудный акцент,
 * стеклянные карточки, свечение под hero. Тексты — честные под нашу модель
 * (комиссия настраиваемая, без выдуманных фикс-сумм).
 */

const STATS = [
  { value: "0 ₽", label: "вложений от вас и клиента до результата" },
  { value: "30 сек", label: "регистрация по коду агентства" },
  { value: "~3 мес", label: "средний срок возврата через ФНС" },
];

const PAINS = [
  {
    title: "Клиент переплатил налог",
    text: "Продавцы недвижимости часто платят НДФЛ больше, чем должны — из-за неверной консультации.",
  },
  {
    title: "Разбираться некогда",
    text: "Возврат — это документы, декларации и ФНС. У риэлтора нет на это времени, у клиента — знаний.",
  },
  {
    title: "Деньги просто теряются",
    text: "Без специалиста переплата так и остаётся в бюджете. А могла бы вернуться клиенту.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Зарегистрируйтесь",
    text: "По инвайт-коду от вашего агентства — за 30 секунд, без ожидания одобрения.",
  },
  {
    n: "2",
    title: "Отправьте ссылку клиенту",
    text: "Персональная ссылка в один клик. Заявка автоматически закрепляется за вами.",
  },
  {
    n: "3",
    title: "Получите вознаграждение",
    text: "Мы возвращаем налог, клиент платит только с результата — вы получаете свою долю.",
  },
];

const BENEFITS = [
  {
    title: "Не нужно разбираться в налогах",
    text: "Всю работу с ФНС и документами ведут наши специалисты. От вас — только ссылка клиенту.",
  },
  {
    title: "Клиент делает всё сам",
    text: "Заполняет короткую анкету по ссылке. Дальше с ним работают напрямую, вас не дёргают.",
  },
  {
    title: "Оплата — только за результат",
    text: "Клиент платит комиссию с фактически возвращённой суммы и только после поступления денег.",
  },
  {
    title: "Прозрачный кабинет",
    text: "Каждая заявка — со статусом: от «новой» до «выплаты сделаны». Вы всегда видите, где деньги.",
  },
  {
    title: "Заявки закреплены за вами",
    text: "Атрибуция по вашей ссылке. Вознаграждение по каждой успешной сделке — ваше.",
  },
  {
    title: "Законно",
    text: "Возвращаем переплаченный НДФЛ в рамках закона — это ваш налоговый вычет, а не «схема».",
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

function PrimaryCta({ children = "Стать партнёром" }: { children?: React.ReactNode }) {
  return (
    <Link
      href="/register"
      className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white transition hover:opacity-90"
      style={{ backgroundColor: "var(--accent)" }}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

export default function MarketingPage() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="landing-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-20 text-center sm:pt-28">
          <span className="landing-card inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium text-white/70">
            Партнёрская программа для риэлторов
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
            Зарабатывайте <span className="text-emerald-gradient">на возврате налогов</span> ваших
            клиентов
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
            Продали клиенту квартиру? Помогите ему вернуть переплаченный налог. Отправьте
            персональную ссылку — остальное сделаем мы, а вы получаете вознаграждение с каждой
            сделки.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <PrimaryCta>Подключиться бесплатно</PrimaryCta>
            <Link
              href="#how"
              className="rounded-full border border-white/15 px-6 py-3 text-base font-medium text-white/80 transition hover:bg-white/5"
            >
              Как это работает?
            </Link>
          </div>

          {/* Статистика */}
          <div className="mx-auto mt-14 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.label} className="landing-card rounded-2xl px-5 py-6">
                <div className="text-2xl font-bold text-emerald-gradient">{s.value}</div>
                <div className="mt-1 text-xs text-white/50">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* БОЛЬ */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Налоги клиентов — не ваша забота
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-white/50">
          Вы приводите клиента — переплату находим и возвращаем мы.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {PAINS.map((p) => (
            <div
              key={p.title}
              className="rounded-3xl border border-red-500/15 bg-red-500/5 p-6"
            >
              <h3 className="font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-white/55">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ТРИ ШАГА */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Три шага — и вы зарабатываете
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="landing-card rounded-3xl p-7">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-white"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {s.n}
              </div>
              <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-white/55">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ПОЧЕМУ РАБОТАЕТ */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Почему это работает
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="landing-card rounded-3xl p-6">
              <div
                className="mb-4 h-1.5 w-10 rounded-full"
                style={{ background: "linear-gradient(135deg, var(--emerald), var(--emerald-light))" }}
              />
              <h3 className="font-semibold">{b.title}</h3>
              <p className="mt-2 text-sm text-white/55">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ЭКСПЕРТ */}
      <section className="mx-auto max-w-4xl px-4 py-20">
        <div className="landing-card rounded-3xl p-8 text-center sm:p-12">
          <span className="text-emerald-gradient text-sm font-semibold uppercase tracking-wide">
            За консультациями
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            Практикующий налоговый консультант
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/60">
            Возвраты ведёт эксперт по налогообложению сделок с недвижимостью и её команда.
            Тысячи возвращённых рублей клиентам — законно, через ФНС, с полным сопровождением.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Частые вопросы</h2>
        <div className="mt-10 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="landing-card group rounded-2xl p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:content-none">
                {f.q}
                <span className="text-white/40 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-white/55">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ФИНАЛЬНЫЙ CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-24">
        <div className="landing-glow relative overflow-hidden rounded-[2rem] border border-white/10 px-6 py-16 text-center">
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
            Подключитесь за 30 секунд
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/60">
            Один инвайт-код от агентства — и вы уже отправляете клиентам ссылки. Регистрация
            бесплатна.
          </p>
          <div className="relative mt-8 flex justify-center">
            <PrimaryCta />
          </div>
        </div>
      </section>
    </div>
  );
}
