import Link from "next/link";

/**
 * [M0-skel] Оффер риэлтору. Тексты-заглушки; дизайн и финальные формулировки — M5
 * (ждём референсы, план ТЗ §11.4).
 */
export default function MarketingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <section className="max-w-2xl">
        <p className="mb-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          Партнёрская программа для риэлторов
        </p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight">
          Ваши клиенты возвращают налоги за прошлые годы — вы получаете вознаграждение
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Продали квартиру клиенту? Помогите ему вернуть переплаченный налог.
          Отправьте персональную ссылку — всё остальное сделаем мы. Вы видите
          статус каждой заявки в личном кабинете.
        </p>
        <ul className="mt-6 space-y-2 text-slate-700">
          <li>— Персональная ссылка: заявки клиентов закрепляются за вами</li>
          <li>— Прозрачные статусы: от заявки до выплаты</li>
          <li>— Вознаграждение с каждой успешной сделки</li>
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700"
          >
            Стать партнёром
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
          >
            У меня уже есть аккаунт
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Регистрация — по инвайт-коду от вашего агентства.
        </p>
      </section>
    </div>
  );
}
