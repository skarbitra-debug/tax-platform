import Link from "next/link";
import { prisma } from "@tax/db";
import { createMyReferralLink } from "@/actions/referral.actions";
import { formatRub } from "@/lib/format";
import { env } from "@/lib/env";
import { requireRole } from "@/lib/require-role";
import { BelowThresholdBadge, StatusBadge, formatDate } from "./_lib/ui";
import { ReferralLinkActions } from "./referral-link-actions";

export const metadata = { title: "Кабинет партнёра" };
// Страница ходит в prisma — рендер только на запрос, без пререндера в build
export const dynamic = "force-dynamic";

/**
 * [M1-3] Дашборд риэлтора: блок «Моя партнёрская ссылка» + счётчики заявок.
 * requireRole вызывается и здесь (не только в layout) — из сессии нужен
 * realtorId, и по нему же фильтруются ВСЕ выборки (изоляция, план §1).
 */
export default async function CabinetPage() {
  const session = await requireRole("REALTOR");
  const realtorId = session.user.realtorId;
  if (!realtorId) {
    // Аномалия данных: RealtorProfile создаётся при регистрации всегда
    throw new Error("У пользователя REALTOR отсутствует профиль риэлтора");
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [activeLink, totalCount, newCount, weekCount, recentDeals] = await Promise.all([
    // Чтение напрямую (мутации — только через @tax/core в actions)
    prisma.referralLink.findFirst({
      where: { realtorId, isActive: true },
      select: { id: true, token: true },
    }),
    prisma.deal.count({ where: { realtorId } }),
    // Новые — по стабильному code (контракт §1: label админ правит свободно)
    prisma.deal.count({ where: { realtorId, status: { code: "NEW" } } }),
    prisma.deal.count({ where: { realtorId, createdAt: { gte: weekAgo } } }),
    // Лента последних заявок прямо на дашборде (просьба заказчика):
    // изоляция та же — только свои, покрыто индексом [realtorId, createdAt desc]
    prisma.deal.findMany({
      where: { realtorId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        number: true,
        createdAt: true,
        belowThreshold: true,
        taxPaidAmount: true,
        client: { select: { firstName: true, phone: true } },
        status: { select: { label: true, color: true } },
      },
    }),
  ]);

  // База реф-ссылок — APP_URL из @tax/config (§5); хвостовой слэш срезаем
  const linkUrl = activeLink
    ? `${env().APP_URL.replace(/\/+$/, "")}/r/${activeLink.token}`
    : null;

  const counters = [
    { label: "Всего заявок", value: totalCount },
    { label: "Новых", value: newCount },
    { label: "За 7 дней", value: weekCount },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Добро пожаловать!</h1>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">Моя партнёрская ссылка</h2>
        {activeLink && linkUrl ? (
          <div className="mt-3 space-y-4">
            <p
              data-testid="refLinkUrl"
              className="break-all rounded-xl bg-slate-50 px-4 py-3 text-lg font-semibold text-blue-700 sm:text-xl"
            >
              {linkUrl}
            </p>
            <ReferralLinkActions linkId={activeLink.id} url={linkUrl} />
            <p className="text-xs text-slate-500">
              Отправьте ссылку клиенту в мессенджере — его заявка автоматически
              привяжется к вам.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-slate-600">
              Активной ссылки пока нет. Создайте её в один клик, скопируйте и
              отправьте клиенту.
            </p>
            <form action={createMyReferralLink}>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Создать ссылку
              </button>
            </form>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Заявки</h2>
          <Link
            href="/cabinet/deals"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Все заявки →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {counters.map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Лента последних заявок прямо на дашборде (до 8; полный список — /cabinet/deals) */}
        {recentDeals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
            Заявок пока нет — отправьте свою ссылку клиенту, и они появятся здесь.
          </div>
        ) : (
          <>
            {/* Мобильные карточки (< sm) */}
            <ul className="space-y-3 sm:hidden">
              {recentDeals.map((deal) => (
                <li key={deal.id} className="rounded-2xl border border-slate-200 bg-white p-4">
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
                  {recentDeals.map((deal) => (
                    <tr key={deal.id}>
                      <td className="px-4 py-3 text-slate-500">{deal.number}</td>
                      <td className="px-4 py-3 font-medium">{deal.client.firstName}</td>
                      <td className="px-4 py-3">
                        <a href={`tel:${deal.client.phone}`} className="text-blue-600 hover:underline">
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

            {totalCount > recentDeals.length && (
              <p className="text-center text-sm text-slate-500">
                Показаны последние {recentDeals.length} из {totalCount} —{" "}
                <Link href="/cabinet/deals" className="font-medium text-blue-600 hover:text-blue-700">
                  открыть все
                </Link>
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
