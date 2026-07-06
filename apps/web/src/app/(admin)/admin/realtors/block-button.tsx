"use client";

import { useActionState } from "react";
import {
  type RealtorAdminState,
  toggleRealtorBlockAction,
} from "@/actions/realtor-admin.actions";

/**
 * Блокировка/разблокировка риэлтора (§4.6). Блокировка действует немедленно
 * (requireRole сверяет status по БД) и гасит активную реф-ссылку.
 */
export function BlockButton({ userId, status }: { userId: string; status: string }) {
  const [state, action, pending] = useActionState(
    toggleRealtorBlockAction,
    {} as RealtorAdminState,
  );
  const isBlocked = status === "BLOCKED";
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!isBlocked && !window.confirm("Заблокировать риэлтора? Его реф-ссылка будет деактивирована.")) {
          e.preventDefault();
        }
      }}
      className="inline-flex items-center gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={pending}
        className={`text-xs font-medium hover:underline disabled:opacity-50 ${
          isBlocked ? "text-emerald-600" : "text-red-600"
        }`}
      >
        {isBlocked ? "Разблокировать" : "Заблокировать"}
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
