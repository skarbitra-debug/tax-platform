import { prisma } from "@tax/db";
import { requireRole } from "@/lib/require-role";
import { CommissionForm, type ConfigDefaults } from "./commission-form";

export const metadata = { title: "Ставки комиссий — настройки" };
export const dynamic = "force-dynamic";

const EMPTY: ConfigDefaults = {
  clientRatePct: "20",
  realtorRatePct: "15",
  platformRatePct: "5",
  commissionBase: "CONSULTANT_FEE",
  executorPayoutType: "FIXED",
  executorFixedAmount: "20000",
  executorRatePct: "",
  minTaxThreshold: "250000",
  showPlatformShareToRealtor: false,
};

export default async function CommissionSettingsPage() {
  await requireRole("ADMIN");
  const active = await prisma.commissionConfig.findFirst({
    where: { isActive: true },
    orderBy: { effectiveFrom: "desc" },
  });

  const defaults: ConfigDefaults = active
    ? {
        clientRatePct: active.clientRatePct.toString(),
        realtorRatePct: active.realtorRatePct.toString(),
        platformRatePct: active.platformRatePct.toString(),
        commissionBase: active.commissionBase,
        executorPayoutType: active.executorPayoutType,
        executorFixedAmount: active.executorFixedAmount?.toString() ?? "",
        executorRatePct: active.executorRatePct?.toString() ?? "",
        minTaxThreshold: active.minTaxThreshold?.toString() ?? "",
        showPlatformShareToRealtor: active.showPlatformShareToRealtor,
      }
    : EMPTY;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ставки комиссий</h1>
        <p className="mt-1 text-sm text-slate-500">
          Настраиваемые проценты (§2). Сохранение создаёт новую версию; ранее рассчитанные
          сделки остаются на прежней версии.
        </p>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <CommissionForm defaults={defaults} />
      </section>
    </div>
  );
}
