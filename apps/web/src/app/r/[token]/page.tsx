import type { ReactNode } from "react";
import {
  getActiveCommissionConfig,
  REFERRAL_TOKEN_REGEX,
  resolveReferralLink,
} from "@tax/core";
import { checkRateLimit, isOverLimit } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request-meta";
import { LeadForm } from "./lead-form";

export const metadata = { title: "Возврат налога" };

// Состояние ссылки и ставка читаются на КАЖДЫЙ запрос: деактивация ссылки
// или смена конфига должны быть видны немедленно, никакого кэша
export const dynamic = "force-dynamic";

const fmtRub = new Intl.NumberFormat("ru-RU");
const fmtPct = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

/** Общая обёртка экранов-состояний (недействительна/устарела) — без формы */
function StateScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">{children}</p>
      </div>
    </main>
  );
}

/** Мусорный/несуществующий токен. notFound() сознательно НЕ зовём — нужен свой текст */
function InvalidLinkScreen() {
  return (
    <StateScreen title="Ссылка недействительна">
      Мы работаем по приглашениям от партнёров — запросите ссылку у вашего риэлтора.
    </StateScreen>
  );
}

/** Деактивированная ссылка — отдельный, более мягкий текст */
function InactiveLinkScreen() {
  return (
    <StateScreen title="Ссылка устарела">
      Запросите новую у вашего риэлтора — это займёт минуту.
    </StateScreen>
  );
}

/** Шаг «как это работает» — нумерованный кружок + текст */
function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
        {n}
      </span>
      <div>
        <p className="font-semibold leading-7">{title}</p>
        <p className="text-sm text-slate-600">{text}</p>
      </div>
    </li>
  );
}

/**
 * [M1-4] ЕДИНСТВЕННАЯ клиентская страница: объяснялка + анкета одним экраном
 * (токен живёт в URL — переходы теряют его в Telegram-WebView, план §1).
 * Mobile-first 360px; клиент — физлицо без аккаунта, auth тут нет и не будет.
 */
export default async function ClientReferralPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { ip } = await getRequestMeta();
  // Анти-перебор токенов (план §4 edge cases): 20 промахов/мин с IP.
  // В счётчик идут ТОЛЬКО промахи — открытия валидных ссылок бюджет не тратят.
  const missKey = `r-token-miss:${ip ?? "unknown"}`;

  // 1) Формат мимо regex — мусор, в БД не ходим вовсе
  if (!REFERRAL_TOKEN_REGEX.test(token)) {
    checkRateLimit(missKey, 20, 60_000);
    return <InvalidLinkScreen />;
  }

  // 2) IP уже выбрал лимит промахов — глушим ДО запроса к БД тем же экраном
  //    «недействительна» (перебор неотличим от промаха, валидные токены не палим)
  if (isOverLimit(missKey, 20, 60_000)) {
    return <InvalidLinkScreen />;
  }

  const resolved = await resolveReferralLink(token);

  if (resolved.status === "not_found") {
    checkRateLimit(missKey, 20, 60_000);
    return <InvalidLinkScreen />;
  }
  if (resolved.status === "inactive") {
    return <InactiveLinkScreen />;
  }

  // Ставка и порог — из активного CommissionConfig (контракт §1: НЕ хардкод).
  // Ставку клиент ВИДИТ здесь; её снапшот в Deal.consentRatePct пишет createLead
  const { clientRatePct, minTaxThreshold } = await getActiveCommissionConfig();
  const ratePctLabel = fmtPct.format(clientRatePct);
  const thresholdLabel = minTaxThreshold !== null ? fmtRub.format(minTaxThreshold) : null;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      {/* Плавный скролл для якоря-CTA; страница одна — глобальный css не трогаем */}
      <style>{`html { scroll-behavior: smooth; }`}</style>

      {/* --- Объяснялка --- */}
      <p className="mb-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
        Приглашение от вашего риэлтора
      </p>
      <h1 className="text-2xl font-bold leading-tight">
        Вернём налог, переплаченный при продаже недвижимости
      </h1>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Если вы продали недвижимость и заплатили налог, часть его часто можно вернуть
        за прошлые годы. Всю работу с налоговой мы берём на себя.
      </p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Как это работает</h2>
        <ol className="mt-4 space-y-4">
          <Step n={1} title="Заполняете анкету" text="Пара минут прямо на этой странице." />
          <Step n={2} title="Подписываете договор" text="Пришлём после проверки анкеты." />
          <Step
            n={3}
            title="Мы работаем с налоговой"
            text="Готовим документы и подаём корректировку — обычно около 3 месяцев."
          />
          <Step n={4} title="Деньги приходят на ваш счёт" text="Напрямую от налоговой, вам." />
          <Step
            n={5}
            title="Только после этого — оплата"
            text="Никаких предоплат на всём пути."
          />
        </ol>
      </section>

      <section className="mt-4 rounded-2xl bg-blue-50 p-5">
        <p className="text-base leading-relaxed text-blue-900">
          Вы платите <span className="font-bold">{ratePctLabel}%</span> от фактически
          возвращённого налога — и только после того, как деньги поступят на ваш счёт.
        </p>
      </section>

      <a
        href="#lead-form"
        className="mt-5 block w-full rounded-xl bg-blue-600 px-4 py-3.5 text-center text-base font-semibold text-white transition hover:bg-blue-700"
      >
        Оставить заявку
      </a>

      {/* --- Анкета (та же страница, ниже; scroll-mt — воздух при якорном скролле) --- */}
      <section id="lead-form" className="mt-10 scroll-mt-6">
        <h2 className="text-xl font-bold">Заявка на возврат</h2>
        <p className="mb-5 mt-1 text-sm text-slate-500">
          Точную сумму возврата посчитаем по документам — анкета ни к чему не обязывает.
        </p>
        <LeadForm
          token={token}
          ratePctLabel={ratePctLabel}
          thresholdRub={minTaxThreshold}
          thresholdLabel={thresholdLabel}
        />
      </section>
    </main>
  );
}
