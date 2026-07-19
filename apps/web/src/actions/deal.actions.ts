"use server";

import { after } from "next/server";
import { createLead, leadFormSchema } from "@tax/core";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request-meta";
import { sendHandoffToChannel } from "@/lib/telegram";

/**
 * Состояние анкеты для useActionState. Успех рендерится НА МЕСТЕ формы
 * (redirect нет — переход потерял бы контекст в Telegram-WebView, план §1).
 */
export type LeadFormState = {
  ok: boolean;
  fieldErrors?: Record<string, string[]>;
  formError?: string;
};

/** «1 200 000» из живого форматирования разрядов → "1200000" для z.coerce */
function digitsOnly(v: FormDataEntryValue | null): string {
  return String(v ?? "").replace(/\D/g, "");
}

/**
 * Публичный сабмит анкеты клиента (M1-5). Гейт — валидный токен + rate-limit
 * по IP; авторизации нет и быть не должно (клиент — физлицо без аккаунта).
 *
 * Сервер НЕ доверяет форме (контракт §1): весь ввод, включая скрытые
 * token/submissionId, проходит leadFormSchema из @tax/core (regex/uuid),
 * а токен дальше сверяется с БД внутри транзакции createLead.
 */
export async function submitApplication(
  _prev: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const meta = await getRequestMeta();

  // Анти-спам: 10 сабмитов/мин с IP (in-memory — однопроцессный пилот)
  if (!checkRateLimit(`lead-submit:${meta.ip ?? "unknown"}`, 10, 60_000)) {
    return {
      ok: false,
      formError: "Слишком много попыток. Подождите минуту и отправьте ещё раз.",
    };
  }

  const parsed = leadFormSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    submissionId: String(formData.get("submissionId") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    salePriceRub: digitsOnly(formData.get("salePriceRub")),
    taxPaidRub: digitsOnly(formData.get("taxPaidRub")),
    consentPersonalData: formData.get("consentPersonalData") === "on",
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    // Ошибка в СКРЫТЫХ полях = битая или подделанная форма — под полем её
    // не показать, честному пользователю поможет только перезагрузка
    if (fieldErrors.token || fieldErrors.submissionId) {
      return {
        ok: false,
        formError: "Не удалось отправить заявку. Обновите страницу и попробуйте ещё раз.",
      };
    }
    return { ok: false, fieldErrors };
  }

  const result = await createLead(parsed.data, meta);

  if (!result.ok) {
    // Деактивация во время заполнения (план §4, edge case): ошибка на сабмите
    // БЕЗ потери ввода — поля формы controlled, состояние остаётся на экране
    return {
      ok: false,
      formError:
        result.error === "LINK_INACTIVE"
          ? "Ссылка устарела — запросите новую у вашего риэлтора. Введённые данные сохранены на этой странице."
          : "Ссылка недействительна. Запросите ссылку у вашего риэлтора.",
    };
  }

  // Передача в noname-канал девочек (§4.5): ТОЛЬКО для реально созданной
  // сделки (created=false — ретрай с тем же submissionId, дубль в канал не шлём)
  // и строго ПОСЛЕ ответа клиенту (after() — сабмит не ждёт Telegram;
  // внутри свой таймаут 5с и запись исхода в Deal.handoffSentAt).
  if (result.created) {
    after(() => sendHandoffToChannel(result.dealId));
  }

  // result.dealNumber клиенту НЕ показываем (номер — внутренний, для ЛК и голосовых команд)
  return { ok: true };
}
