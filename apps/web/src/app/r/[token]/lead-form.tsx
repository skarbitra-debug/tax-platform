"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { submitApplication, type LeadFormState } from "@/actions/deal.actions";

const initialState: LeadFormState = { ok: false };

/**
 * Живое форматирование разрядов: "1200000" → "1 200 000".
 * Только цифры, ведущие нули срезаются, 13 знаков хватает на границу 2 млрд.
 */
function formatRubInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 13);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Числовое значение из отформатированной строки ("1 200 000" → 1200000) */
function rubValue(formatted: string): number | null {
  const digits = formatted.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

/**
 * submissionId генерируется при монтировании (идемпотентность двойного тапа, план §4).
 * crypto.randomUUID есть только в secure context — для http-dev в WebView
 * держим ручной RFC4122-v4 fallback на getRandomValues.
 */
function makeSubmissionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Ошибка конкретного поля из Zod flatten() — как в register-form */
function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1.5 text-sm text-red-600">{errors[0]}</p>;
}

// Крупные поля под палец (16px+ — iOS не зумит), mobile-first 360px
const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
const labelCls = "mb-1.5 block text-sm font-medium text-slate-700";

export function LeadForm({
  token,
  thresholdRub,
  thresholdLabel,
  intro,
}: {
  token: string;
  /** Объяснялка (бейдж, заголовок, шаги) — видна на шаге intro, при успехе скрыта */
  intro: ReactNode;
  /** Порог из конфига в рублях (null — порога нет) — для неблокирующего hint */
  thresholdRub: number | null;
  thresholdLabel: string | null;
}) {
  const [state, formAction, pending] = useActionState(submitApplication, initialState);
  const fe = state.fieldErrors ?? {};

  // Двухшаговый флоу (решение заказчика 19.07): шаг 1 — объяснялка с кнопкой
  // «Просчитать возврат», шаг 2 — анкета «как следующая страница». Реализовано
  // состоянием ВНУТРИ одной страницы: токен остаётся в URL (Telegram-WebView
  // теряет его при настоящих переходах — план §1).
  const [step, setStep] = useState<"intro" | "form">("intro");
  const openForm = () => {
    setStep("form");
    window.scrollTo({ top: 0 });
  };

  // ВСЕ поля controlled: React 19 сбрасывает uncontrolled-форму после action,
  // а нам нельзя терять ввод при ошибке валидации/устаревшей ссылке (план §4)
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [taxPaid, setTaxPaid] = useState("");
  const [consentPd, setConsentPd] = useState(false);

  // Генерация в effect, не в useState-init: иначе SSR и гидрация дадут
  // разные UUID → hydration mismatch на hidden-инпуте
  const [submissionId, setSubmissionId] = useState("");
  useEffect(() => {
    setSubmissionId(makeSubmissionId());
  }, []);

  // Успех: ВЕСЬ экран заменяется подтверждением — объяснялка, CTA и форма
  // исчезают (иначе клиент видел бы «Заявка принята» и одновременно кнопку
  // «Оставить заявку» — сбивает с толку). Номер заявки клиенту не показываем.
  const ok = state.ok;
  useEffect(() => {
    if (ok) window.scrollTo({ top: 0 });
  }, [ok]);

  if (state.ok) {
    return (
      <div
        data-testid="quizSuccess"
        className="flex min-h-[70vh] flex-col items-center justify-center text-center"
      >
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl"
          aria-hidden
        >
          ✓
        </span>
        <h1 className="mt-5 text-2xl font-bold text-emerald-800">Заявка принята!</h1>
        <p className="mt-3 max-w-sm text-base leading-relaxed text-slate-600">
          Мы проверим данные и свяжемся с вами в Telegram или по телефону —
          обычно в течение 1–2 рабочих дней.
        </p>
        <p className="mt-4 text-sm text-slate-400">Страницу можно закрыть.</p>
      </div>
    );
  }

  // Неблокирующий hint про порог (план §1: анкета НЕ отсекает — belowThreshold)
  const tax = rubValue(taxPaid);
  const showThresholdHint =
    thresholdRub !== null && thresholdLabel !== null && tax !== null && tax > 0 && tax < thresholdRub;

  if (step === "intro") {
    return (
      <>
        {intro}
        <button
          type="button"
          data-testid="startQuizBtn"
          onClick={openForm}
          className="mt-6 block w-full rounded-xl bg-blue-600 px-4 py-3.5 text-center text-base font-semibold text-white transition hover:bg-blue-700"
        >
          Просчитать возврат
        </button>
        <p className="mt-3 text-center text-xs text-slate-400">
          Анкета из 4 полей — займёт пару минут.
        </p>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setStep("intro")}
        className="text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        ← Назад к описанию
      </button>
      <section id="lead-form" className="mt-4">
        <h2 className="text-xl font-bold">Заявка на возврат</h2>
        <p className="mb-5 mt-1 text-sm text-slate-500">
          Точную сумму возврата посчитаем по документам — анкета ни к чему не обязывает.
        </p>
        <form action={formAction} data-testid="quizForm" className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="submissionId" value={submissionId} />

      <label className="block">
        <span className={labelCls}>Ваше имя</span>
        <input
          type="text"
          name="firstName"
          required
          autoComplete="given-name"
          className={inputCls}
          placeholder="Иван"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <FieldError errors={fe.firstName} />
      </label>

      <label className="block">
        <span className={labelCls}>Телефон</span>
        <input
          type="tel"
          name="phone"
          required
          autoComplete="tel"
          inputMode="tel"
          className={inputCls}
          placeholder="+7 912 345-67-89"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">Можно в любом виде: 8…, 7… или +7…</p>
        <FieldError errors={fe.phone} />
      </label>

      <label className="block">
        <span className={labelCls}>За сколько продали недвижимость, ₽</span>
        <input
          type="text"
          name="salePriceRub"
          required
          inputMode="numeric"
          autoComplete="off"
          className={inputCls}
          placeholder="12 000 000"
          value={salePrice}
          onChange={(e) => setSalePrice(formatRubInput(e.target.value))}
        />
        <FieldError errors={fe.salePriceRub} />
      </label>

      <label className="block">
        <span className={labelCls}>Сколько налога заплатили, ₽</span>
        <input
          type="text"
          name="taxPaidRub"
          required
          inputMode="numeric"
          autoComplete="off"
          className={inputCls}
          placeholder="700 000"
          value={taxPaid}
          onChange={(e) => setTaxPaid(formatRubInput(e.target.value))}
        />
        {showThresholdHint && (
          <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Обычно берём в работу от {thresholdLabel} ₽ — заявка будет рассмотрена индивидуально.
          </p>
        )}
        <FieldError errors={fe.taxPaidRub} />
      </label>

      {/* Единственная галочка (решение заказчика 19.07): согласие на обработку ПДн, 152-ФЗ */}
      <div className="rounded-xl bg-slate-50 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="consentPersonalData"
            className="mt-0.5 h-5 w-5 shrink-0 rounded accent-blue-600"
            checked={consentPd}
            onChange={(e) => setConsentPd(e.target.checked)}
          />
          <span className="text-sm leading-snug text-slate-700">
            Я даю согласие на обработку моих персональных данных в соответствии
            с Федеральным законом №152-ФЗ «О персональных данных»
          </span>
        </label>
        <FieldError errors={fe.consentPersonalData} />
      </div>

      {state.formError && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.formError}</p>
      )}

      <button
        type="submit"
        data-testid="quizSubmit"
        disabled={pending || !submissionId}
        className="w-full rounded-xl bg-blue-600 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Отправляем…" : "Отправить заявку"}
      </button>

          <p className="text-center text-xs text-slate-400">
            Никаких предоплат — оплата только после получения денег на ваш счёт.
          </p>
        </form>
      </section>
    </>
  );
}
