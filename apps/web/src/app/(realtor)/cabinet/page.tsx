import Link from "next/link";
import { prisma } from "@tax/db";
import { createMyReferralLink } from "@/actions/referral.actions";
import { env } from "@/lib/env";
import { requireRole } from "@/lib/require-role";
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
  const [activeLink, totalCount, newCount, weekCount] = await Promise.all([
    // Чтение напрямую (мутации — только через @tax/core в actions)
    prisma.referralLink.findFirst({
      where: { realtorId, isActive: true },
      select: { id: true, token: true },
    }),
    prisma.deal.count({ where: { realtorId } }),
    // Новые — по стабильному code (контракт §1: label админ правит свободно)
    prisma.deal.count({ where: { realtorId, status: { code: "NEW" } } }),
    prisma.deal.count({ where: { realtorId, createdAt: { gte: weekAgo } } }),
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
      </section>
    </div>
  );
}
