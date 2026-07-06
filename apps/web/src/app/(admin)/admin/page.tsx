import Link from "next/link";
import { prisma } from "@tax/db";
import { formatRub } from "@/lib/format";
import { requireRole } from "@/lib/require-role";
import { StatusBadge, formatDateTime } from "./_lib/ui";

export const metadata = { title: "Админ-панель" };
// Каждый заход — свежие данные из БД, никакого пререндера на билде
export const dynamic = "force-dynamic";

/** [M1-7] Дашборд Татьяны: счётчики + последние заявки + входы в разделы */
export default async function AdminPage() {
  // In-page guard: layout не перемонтируется при клиентской навигации между
  // разделами — сверка User.status по БД на КАЖДОЙ странице (мгновенная блокировка, §1)
  await requireRole("ADMIN");

  const [totalDeals, newDeals, realtorCount, initialStatus, lastDeals] = await Promise.all([
    prisma.deal.count(),
    // «Новые» = в начальном статусе; NEW ищем по isInitial, не по code (контракт §1)
    prisma.deal.count({ where: { status: { isInitial: true } } }),
    prisma.realtorProfile.count(),
    // id начального статуса — для ссылки-фильтра с карточки «Новые»
    prisma.dealStatus.findFirst({
      where: { isInitial: true, isActive: true },
      select: { id: true },
    }),
    prisma.deal.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        createdAt: true,
        saleAmount: true,
        client: { select: { firstName: true, phone: true } },
        realtor: { select: { user: { select: { name: true, email: true } } } },
        status: { select: { label: true, color: true } },
      },
    }),
  ]);

  const cards = [
    { label: "Всего заявок", value: totalDeals, href: "/admin/deals" },
    {
      label: "Новых заявок",
      value: newDeals,
      href: initialStatus ? `/admin/deals?status=${initialStatus.id}` : "/admin/deals",
    },
    { label: "Риэлторов", value: realtorCount, href: "/admin/realtors" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Обзор платформы</h1>

      {/* Счётчики — сами же и входы в разделы */}
      <section className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-400"
          >
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{c.value}</p>
          </Link>
        ))}
      </section>

      {/* Последние 5 заявок компактно; полный список с фильтрами — /admin/deals */}
      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold">Последние заявки</h2>
          <Link href="/admin/deals" className="text-sm font-medium text-blue-600 hover:underline">
            Все заявки →
          </Link>
        </div>
        {lastDeals.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            Заявок пока нет. Они появятся, когда клиенты начнут заполнять анкеты
            по ссылкам риэлторов.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2 font-medium">№</th>
                  <th className="px-3 py-2 font-medium">Дата</th>
                  <th className="px-3 py-2 font-medium">Клиент</th>
                  <th className="px-3 py-2 font-medium">Риэлтор</th>
                  <th className="px-3 py-2 font-medium">Сделка</th>
                  <th className="px-3 py-2 pr-5 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {lastDeals.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="px-5 py-2.5 font-medium">{d.number}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                      {formatDateTime(d.createdAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      {d.client.firstName}
                      <span className="ml-2 whitespace-nowrap text-xs text-slate-500">
                        {d.client.phone}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {d.realtor.user.name ?? d.realtor.user.email}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{formatRub(d.saleAmount)}</td>
                    <td className="px-3 py-2.5 pr-5">
                      <StatusBadge label={d.status.label} color={d.status.color} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">Разделы</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <li>
            <Link href="/admin/deals" className="font-medium text-blue-600 hover:underline">
              Заявки
            </Link>
            <p className="text-slate-500">Все заявки, фильтры по риэлтору и статусу.</p>
          </li>
          <li>
            <Link href="/admin/realtors" className="font-medium text-blue-600 hover:underline">
              Риэлторы
            </Link>
            <p className="text-slate-500">Зарегистрированные партнёры и их заявки.</p>
          </li>
          <li>
            <Link href="/admin/invites" className="font-medium text-blue-600 hover:underline">
              Инвайты
            </Link>
            <p className="text-slate-500">Коды для регистрации риэлторов.</p>
          </li>
        </ul>
      </section>
    </div>
  );
}
