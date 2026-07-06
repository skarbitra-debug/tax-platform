"use client";

import { useEffect, useState, useTransition } from "react";
import { deactivateMyReferralLink } from "@/actions/referral.actions";

/**
 * Кнопки блока «Моя партнёрская ссылка» (M1-3): clipboard, navigator.share,
 * confirm — браузерные API, поэтому отдельный client component.
 * URL и linkId приходят из server-дашборда, в БД компонент не ходит.
 */
export function ReferralLinkActions({ linkId, url }: { linkId: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [isPending, startTransition] = useTransition();

  // navigator существует только в браузере: проверяем share после mount,
  // иначе SSR- и CSR-разметка разойдутся (hydration mismatch). Нет share
  // (десктопные браузеры) → кнопка просто скрыта.
  useEffect(() => {
    setCanShare("share" in navigator);
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // галочка-фидбек на 2 секунды
    } catch {
      // clipboard бывает запрещён (нет HTTPS/пермишена) — даём скопировать руками
      window.prompt("Скопируйте ссылку вручную:", url);
    }
  }

  function handleShare() {
    // reject = пользователь закрыл системную шторку — не ошибка, молчим
    navigator.share({ title: "Возврат налога за прошлые годы", url }).catch(() => {});
  }

  function handleDeactivate() {
    const ok = window.confirm(
      "Деактивировать ссылку? Копии, уже отправленные клиентам, перестанут работать.",
    );
    if (!ok) return;
    // После revalidatePath("/cabinet") сервер перерисует блок в состояние
    // «активной ссылки нет» — локальный стейт чистить не нужно
    startTransition(async () => {
      await deactivateMyReferralLink(linkId);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        data-testid="copyLinkBtn"
        onClick={handleCopy}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        {copied ? "✓ Скопировано" : "Копировать"}
      </button>
      {canShare && (
        <button
          type="button"
          onClick={handleShare}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Поделиться
        </button>
      )}
      <button
        type="button"
        onClick={handleDeactivate}
        disabled={isPending}
        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "Деактивация…" : "Деактивировать"}
      </button>
    </div>
  );
}
