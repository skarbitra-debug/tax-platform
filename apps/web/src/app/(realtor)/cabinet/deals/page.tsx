import Link from "next/link";
import { prisma } from "@tax/db";
import { formatRub } from "@/lib/format";
import { requireRole } from "@/lib/require-role";
import { BelowThresholdBadge, StatusBadge, formatDate } from "../_lib/ui";

export const metadata = { title: "Мои заявки" };
// Список ходит в prisma — рендер только на запрос, без пререндера в build
export const dynamic = "force-dynamic";




/**
 * [M1-6] Заявки риэлтора: карточки на мобильном, таблица на десктопе.
 * ИЗОЛЯЦИЯ: фильтр строго по realtorId из СЕССИИ — никогда из параметров
 * запроса; риэлтор A физически не может увидеть заявки риэлтора B.
 */
export default async function RealtorDealsPage() {
  const session = await requireRole("REALTOR");
  const realtorId = session.user.realtorId;
  if (!realtorId) {
    // Аномалия данных: RealtorProfile создаётся при регистрации всегда
    throw new Error("У пользователя REALTOR отсутствует профиль риэлтора");
  }

  const deals = await prisma.deal.findMany({
    where: { realtorId },
    orderBy: { createdAt: "desc" }, // покрыт индексом [realtorId, createdAt desc]
    take: 500, // потолок выборки (пилот без пагинации; как в админ-списке)
    select: {
      id: true,
      number: true,
      createdAt: true,
      belowThreshold: true,
      taxPaidAmount: true,
      client: { select: { firstName: true, phone: true } },
      status: { select: { label: true, color: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Мои заявки</h1>
        <p className="text-sm text-slate-500">Всего: {deals.length}</p>
      </div>

      {deals.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">
            Пока нет заявок — отправьте свою ссылку клиенту.
          </p>
          <Link
            href="/cabinet"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            К моей ссылке →
          </Link>
        </section>
      ) : (
        <>
          {/* Мобильные карточки (< sm).
              data-testid="dealRow" ТОЛЬКО здесь: карточка и строка таблицы
              рендерятся в DOM одновременно (скрыты CSS), а e2e-контракт ждёт
              ровно один dealRow на заявку (toHaveCount(1), mobile viewport) */}
          <ul className="space-y-3 sm:hidden">
            {deals.map((deal) => (
              <li
                key={deal.id}
                data-testid="dealRow"
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-500">
                    № {deal.number} · {formatDate(deal.createdAt)}
                  </p>
                  <StatusBadge status={deal.status} />
                </div>
                <p className="mt-2 font-semibold">{deal.client.firstName}</p>
                <a href={`tel:${deal.client.phone}`} className="text-sm text-blue-600">
                  {deal.client.phone}
                </a>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-sm text-slate-600">
                    Налог:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatRub(deal.taxPaidAmount)}
                    </span>
                  </p>
                  {deal.belowThreshold && <BelowThresholdBadge />}
                </div>
              </li>
            ))}
          </ul>

          {/* Десктопная таблица (>= sm) */}
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">№</th>
                  <th className="px-4 py-3 font-semibold">Клиент</th>
                  <th className="px-4 py-3 font-semibold">Телефон</th>
                  <th className="px-4 py-3 font-semibold">Налог</th>
                  <th className="px-4 py-3 font-semibold">Дата</th>
                  <th className="px-4 py-3 font-semibold">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deals.map((deal) => (
                  <tr key={deal.id}>
                    <td className="px-4 py-3 text-slate-500">{deal.number}</td>
                    <td className="px-4 py-3 font-medium">{deal.client.firstName}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`tel:${deal.client.phone}`}
                        className="text-blue-600 hover:underline"
                      >
                        {deal.client.phone}
                      </a>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">
                      {formatRub(deal.taxPaidAmount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {formatDate(deal.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={deal.status} />
                        {deal.belowThreshold && <BelowThresholdBadge />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
