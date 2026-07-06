import { prisma } from "@tax/db";
import { revokeInvite } from "@/actions/invite.actions";
import { formatDate } from "../_lib/ui";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Инвайты — админ-панель" };
export const dynamic = "force-dynamic";

/**
 * Состояние кода — вычисляемое: isActive это только «не отозван»,
 * истечение и исчерпание лимита живут в expiresAt/usedCount
 * (та же логика, что в registerRealtor — auth.actions)
 */
function inviteState(inv: {
  isActive: boolean;
  expiresAt: Date | null;
  usedCount: number;
  maxUses: number;
}): { label: string; cls: string } {
  if (!inv.isActive) {
    return { label: "Отозван", cls: "border-slate-200 bg-slate-100 text-slate-500" };
  }
  if (inv.expiresAt && inv.expiresAt < new Date()) {
    return { label: "Истёк", cls: "border-amber-200 bg-amber-50 text-amber-800" };
  }
  if (inv.usedCount >= inv.maxUses) {
    return { label: "Исчерпан", cls: "border-amber-200 bg-amber-50 text-amber-800" };
  }
  return { label: "Активен", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
}

/** [M1-7] Инвайт-коды: создание, список, отзыв — закрытость пилота (§8-3) */
export default async function AdminInvitesPage() {
  const invites = await prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Инвайт-коды</h1>
      <p className="text-sm text-slate-600">
        Код передаётся директору агентства — риэлторы регистрируются по нему сами.
        Отзыв действует мгновенно: регистрация по отозванному коду невозможна.
      </p>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Новый код</h2>
        <InviteForm />
      </section>

      {invites.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Кодов пока нет — создайте первый в форме выше.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Код</th>
                <th className="px-3 py-3 font-medium">Метка</th>
                <th className="px-3 py-3 font-medium">Использован</th>
                <th className="px-3 py-3 font-medium">Действует до</th>
                <th className="px-3 py-3 font-medium">Создан</th>
                <th className="px-3 py-3 font-medium">Состояние</th>
                <th className="px-3 py-3 pr-5 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const st = inviteState(inv);
                return (
                  <tr key={inv.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-5 py-3 font-mono font-medium tracking-wide">
                      {inv.code}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{inv.label ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                      {inv.usedCount} / {inv.maxUses}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                      {inv.expiresAt ? formatDate(inv.expiresAt) : "Бессрочно"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                      {formatDate(inv.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${st.cls}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 pr-5">
                      {inv.isActive ? (
                        // Скрытое поле — только указатель; сервер валидирует id
                        // и права заново (invite.actions, контракт §1)
                        <form action={revokeInvite}>
                          <input type="hidden" name="inviteId" value={inv.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Отозвать
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
