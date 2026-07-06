import Link from "next/link";
import { notFound } from "next/navigation";
import { listActiveStatuses } from "@tax/core";
import { prisma } from "@tax/db";
import { formatRub } from "@/lib/format";
import { requireRole } from "@/lib/require-role";
import { FlagBadge, StatusBadge, formatDateTime } from "../../_lib/ui";
import { ClientPaidForm, PayoutForm, RefundForm, StatusChangeForm } from "./deal-forms";

export const metadata = { title: "Сделка — админ-панель" };
export const dynamic = "force-dynamic";

const PAYOUT_RU: Record<string, string> = {
  REALTOR: "Риэлтор",
  PLATFORM_AGENCY: "Площадка / агентство",
  EXECUTOR: "Исполнитель",
  OTHER: "Другое",
};

/** Секция-карточка */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

export default async function AdminDealPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      client: true,
      realtor: { include: { user: { select: { name: true, email: true } } } },
      status: true,
      commission: true,
      payouts: { orderBy: { paidAt: "desc" } },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: {
          fromStatus: { select: { label: true } },
          toStatus: { select: { label: true, color: true } },
          changedBy: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!deal) notFound();

  const [statuses, realtors] = await Promise.all([
    listActiveStatuses(),
    prisma.realtorProfile.findMany({
      select: { id: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const c = deal.commission;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/deals" className="text-sm text-blue-600 hover:underline">
            ← Заявки
          </Link>
          <h1 className="text-2xl font-bold">Сделка № {deal.number}</h1>
          <StatusBadge label={deal.status.label} color={deal.status.color} />
        </div>
        <div className="flex flex-wrap gap-2">
          {deal.belowThreshold && <FlagBadge text="Ниже порога" tone="amber" />}
          {deal.duplicateOfDealId && <FlagBadge text="Возможный дубль" tone="red" />}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Клиент">
          <Row label="Имя" value={deal.client.firstName} />
          <Row
            label="Телефон"
            value={
              <a href={`tel:${deal.client.phone}`} className="text-blue-600 hover:underline">
                {deal.client.phone}
              </a>
            }
          />
          {deal.client.telegramUsername && (
            <Row label="Telegram" value={`@${deal.client.telegramUsername}`} />
          )}
          <Row label="Создана" value={formatDateTime(deal.createdAt)} />
        </Card>

        <Card title="Риэлтор и заявка">
          <Row label="Риэлтор" value={deal.realtor.user.name ?? deal.realtor.user.email} />
          {deal.realtor.agencyName && <Row label="Агентство" value={deal.realtor.agencyName} />}
          <Row label="Сумма сделки" value={formatRub(deal.saleAmount)} />
          <Row label="Уплаченный налог" value={formatRub(deal.taxPaidAmount)} />
          <Row label="Согласие (ставка на момент)" value={`${deal.consentRatePct.toString()}%`} />
        </Card>
      </div>

      <Card title="Фактический возврат и комиссии">
        <div className="mb-4">
          <RefundForm dealId={deal.id} currentRefund={deal.actualRefundAmount?.toString() ?? null} />
        </div>
        {c ? (
          <div className="rounded-xl bg-slate-50 p-4">
            <Row label="База расчёта" value={formatRub(c.baseAmount)} />
            <Row label="Клиент платит (гонорар)" value={formatRub(c.clientFeeAmount)} />
            <Row label="Риэлтор" value={formatRub(c.realtorAmount)} />
            {/* Админ видит долю площадки всегда; showPlatformShareToRealtor
                скрывает её лишь в кабинете риэлтора (§2) */}
            <Row label="Площадка / агентство" value={formatRub(c.platformAmount)} />
            <Row label="Исполнитель" value={formatRub(c.executorAmount)} />
            <Row
              label="Остаток Татьяне"
              value={
                <span className={c.consultantNetAmount.isNegative() ? "text-red-600" : ""}>
                  {formatRub(c.consultantNetAmount)}
                </span>
              }
            />
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Комиссии рассчитаются после ввода фактического возврата.
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Смена статуса">
          <StatusChangeForm
            dealId={deal.id}
            statuses={statuses.map((s) => ({ id: s.id, label: s.label }))}
            currentStatusId={deal.statusId}
          />
        </Card>

        <Card title="Оплата клиента">
          {deal.clientPaidAt ? (
            <p className="mb-3 text-sm text-emerald-700">
              Оплачено {formatRub(deal.clientPaidAmount)} · {formatDateTime(deal.clientPaidAt)}
            </p>
          ) : (
            <p className="mb-3 text-sm text-slate-500">Оплата ещё не отмечена.</p>
          )}
          <ClientPaidForm
            dealId={deal.id}
            suggested={c?.clientFeeAmount.toString() ?? null}
          />
        </Card>
      </div>

      <Card title="Выплаты">
        {deal.payouts.length > 0 ? (
          <ul className="mb-4 divide-y divide-slate-100">
            {deal.payouts.map((p) => (
              <li key={p.id} className="flex justify-between gap-4 py-2 text-sm">
                <span className="text-slate-600">
                  {PAYOUT_RU[p.recipientType] ?? p.recipientType}
                  {p.comment ? ` · ${p.comment}` : ""}
                </span>
                <span className="whitespace-nowrap">
                  <span className="font-medium">{formatRub(p.amount)}</span>{" "}
                  <span className="text-slate-400">{formatDateTime(p.paidAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-slate-500">Выплат пока нет.</p>
        )}
        <PayoutForm
          dealId={deal.id}
          realtors={realtors.map((r) => ({ id: r.id, name: r.user.name ?? r.user.email }))}
        />
      </Card>

      <Card title="История статусов">
        <ol className="space-y-3">
          {deal.statusHistory.map((h) => (
            <li key={h.id} className="flex gap-3 text-sm">
              <span className="whitespace-nowrap text-slate-400">{formatDateTime(h.createdAt)}</span>
              <span>
                <StatusBadge label={h.toStatus.label} color={h.toStatus.color} />
                {h.fromStatus && <span className="text-slate-400"> ← {h.fromStatus.label}</span>}
                <span className="ml-2 text-xs text-slate-400">
                  {h.mode === "AUTO" ? "авто" : "вручную"} · {h.source}
                  {h.changedBy ? ` · ${h.changedBy.name ?? h.changedBy.email}` : ""}
                </span>
                {h.comment && <span className="block text-slate-500">{h.comment}</span>}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
