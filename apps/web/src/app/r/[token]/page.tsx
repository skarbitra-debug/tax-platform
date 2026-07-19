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

  // Порог — из активного CommissionConfig (для неблокирующего hint в анкете).
  // Ставка клиенту больше не показывается (решение заказчика 19.07);
  // её снапшот в Deal.consentRatePct продолжает писать createLead
  const { minTaxThreshold } = await getActiveCommissionConfig();
  const thresholdLabel = minTaxThreshold !== null ? fmtRub.format(minTaxThreshold) : null;

  // Объяснялка передаётся В клиентский компонент: после успешной отправки
  // он заменяет ВЕСЬ экран подтверждением (без неё и без CTA) — иначе клиент
  // видел бы «Заявка принята» и одновременно кнопку «Оставить заявку»
  const intro = (
    <>
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
          <Step n={1} title="Заполняете анкету" text="Пара минут — на следующем шаге." />
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

    </>
  );

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      {/* Анкета — та же страница; intro и форма живут внутри LeadForm,
          чтобы успех заменял всё разом (секция #lead-form — внутри) */}
      <LeadForm
        token={token}
        thresholdRub={minTaxThreshold}
        thresholdLabel={thresholdLabel}
        intro={intro}
      />
    </main>
  );
}
