import { prisma } from "@tax/db";
import { requireRole } from "@/lib/require-role";
import { UserStatusBadge, formatDate } from "../_lib/ui";

export const metadata = { title: "Риэлторы — админ-панель" };
export const dynamic = "force-dynamic";

/**
 * [M1-7] Все зарегистрированные риэлторы: контакты, агентство, счётчик
 * заявок (relation count одним запросом), наличие активной реф-ссылки
 * и User.status. Блокировка/разблокировка из UI — M2, здесь только просмотр.
 */
export default async function AdminRealtorsPage() {
  await requireRole("ADMIN"); // in-page guard (см. admin/page.tsx)
  const realtors = await prisma.realtorProfile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      agencyName: true,
      user: {
        select: { name: true, email: true, phone: true, status: true, createdAt: true },
      },
      // Одна активная ссылка гарантирована partial-unique индексом (§2) —
      // take: 1 достаточно, тянем только факт наличия
      referralLinks: { where: { isActive: true }, select: { id: true }, take: 1 },
      _count: { select: { deals: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Риэлторы</h1>
        <p className="text-sm text-slate-500">Всего: {realtors.length}</p>
      </div>

      {realtors.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Риэлторов пока нет. Создайте инвайт-код в разделе «Инвайты» и передайте
          его агентству — риэлторы зарегистрируются сами.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Имя</th>
                <th className="px-3 py-3 font-medium">Email</th>
                <th className="px-3 py-3 font-medium">Телефон</th>
                <th className="px-3 py-3 font-medium">Агентство</th>
                <th className="px-3 py-3 font-medium">Регистрация</th>
                <th className="px-3 py-3 font-medium">Заявки</th>
                <th className="px-3 py-3 font-medium">Ссылка</th>
                <th className="px-3 py-3 pr-5 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {realtors.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-5 py-3 font-medium">{r.user.name ?? "—"}</td>
                  <td className="px-3 py-3 text-slate-600">{r.user.email}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    {r.user.phone ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{r.agencyName ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    {formatDate(r.user.createdAt)}
                  </td>
                  <td className="px-3 py-3 font-medium">{r._count.deals}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {r.referralLinks.length > 0 ? (
                      <span className="text-emerald-600">Есть</span>
                    ) : (
                      <span className="text-slate-400">Нет</span>
                    )}
                  </td>
                  <td className="px-3 py-3 pr-5">
                    <UserStatusBadge status={r.user.status} />
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
