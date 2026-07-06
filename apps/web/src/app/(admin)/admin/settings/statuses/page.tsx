import { prisma } from "@tax/db";
import { requireRole } from "@/lib/require-role";
import { AddStatusForm, StatusRow } from "./status-forms";

export const metadata = { title: "Статусы сделок — настройки" };
export const dynamic = "force-dynamic";

export default async function StatusSettingsPage() {
  await requireRole("ADMIN");
  const statuses = await prisma.dealStatus.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Статусы сделок</h1>
        <p className="mt-1 text-sm text-slate-500">
          Конфигурируемый набор статусов воронки (§6). Код менять нельзя — на него завязаны
          авто-переходы; название, цвет и порядок правятся свободно.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        {statuses.map((s) => (
          <StatusRow key={s.id} status={s} />
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Новый статус</h2>
        <AddStatusForm />
      </section>
    </div>
  );
}
