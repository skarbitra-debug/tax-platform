import Link from "next/link";
import { prisma } from "@tax/db";
import { formatRub } from "@/lib/format";
import { requireRole } from "@/lib/require-role";
import { FlagBadge, StatusBadge, formatDateTime } from "../_lib/ui";

export const metadata = { title: "Заявки — админ-панель" };
export const dynamic = "force-dynamic";

/** searchParams может отдать массив (повтор параметра в URL) — берём только строку */
function pickOne(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

const selectCls =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

/**
 * [M1-7] Все заявки с фильтрами по риэлтору и статусу.
 * Фильтры — обычная GET-форма (server component, без клиентского JS):
 * состояние живёт в URL, страницу можно переслать ссылкой.
 * Ручная смена статуса — сознательно НЕ здесь (M2).
 */
export default async function AdminDealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN"); // in-page guard (см. admin/page.tsx)
  const sp = await searchParams;
  // Значения из URL уходят в where как есть — это только id для равенства,
  // Prisma параметризует; несуществующий id даст пустой список, не ошибку
  const realtorId = pickOne(sp.realtor);
  const statusId = pickOne(sp.status);

  const [deals, realtors, statuses] = await Promise.all([
    prisma.deal.findMany({
      where: {
        ...(realtorId ? { realtorId } : {}),
        ...(statusId ? { statusId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200, // пилот: пагинации нет, 200 свежих заявок хватает с запасом
      select: {
        id: true,
        number: true,
        createdAt: true,
        saleAmount: true,
        taxPaidAmount: true,
        belowThreshold: true,
        duplicateOfDealId: true,
        client: { select: { firstName: true, phone: true } },
        realtor: { select: { user: { select: { name: true, email: true } } } },
        status: { select: { label: true, color: true } },
      },
    }),
    prisma.realtorProfile.findMany({
      orderBy: { user: { name: "asc" } },
      select: { id: true, user: { select: { name: true, email: true } } },
    }),
    prisma.dealStatus.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true },
    }),
  ]);

  const hasFilter = Boolean(realtorId || statusId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Заявки</h1>
        <p className="text-sm text-slate-500">
          {hasFilter ? `Найдено: ${deals.length}` : `Всего показано: ${deals.length}`}
        </p>
      </div>

      {/* GET-форма фильтров: работает без JS, URL можно переслать */}
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Риэлтор</span>
          <select name="realtor" defaultValue={realtorId ?? ""} className={selectCls}>
            <option value="">Все риэлторы</option>
            {realtors.map((r) => (
              <option key={r.id} value={r.id}>
                {r.user.name ?? r.user.email}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Статус</span>
          <select name="status" defaultValue={statusId ?? ""} className={selectCls}>
            <option value="">Все статусы</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Показать
        </button>
        {hasFilter && (
          <Link href="/admin/deals" className="py-2 text-sm text-blue-600 hover:underline">
            Сбросить
          </Link>
        )}
      </form>

      {deals.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {hasFilter ? "По выбранным фильтрам заявок нет." : "Заявок пока нет."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">№</th>
                <th className="px-3 py-3 font-medium">Дата</th>
                <th className="px-3 py-3 font-medium">Клиент</th>
                <th className="px-3 py-3 font-medium">Риэлтор</th>
                <th className="px-3 py-3 font-medium">Суммы</th>
                <th className="px-3 py-3 pr-5 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium">
                    <Link href={`/admin/deals/${d.id}`} className="text-blue-600 hover:underline">
                      {d.number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    {formatDateTime(d.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    <div>{d.client.firstName}</div>
                    <div className="whitespace-nowrap text-xs text-slate-500">{d.client.phone}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {d.realtor.user.name ?? d.realtor.user.email}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <div>{formatRub(d.saleAmount)}</div>
                    <div className="text-xs text-slate-500">налог {formatRub(d.taxPaidAmount)}</div>
                  </td>
                  <td className="px-3 py-3 pr-5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge label={d.status.label} color={d.status.color} />
                      {/* Пометки воронки (план §4): ниже порога — решает Татьяна;
                          дубль по телефону — мягкий, сделку не блокирует */}
                      {d.belowThreshold && <FlagBadge text="ниже порога" tone="amber" />}
                      {d.duplicateOfDealId && <FlagBadge text="возможный дубль" tone="red" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
