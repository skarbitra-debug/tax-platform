"use client";

import { useActionState } from "react";
import {
  type FnsRevealState,
  type FnsSetState,
  clearFnsAction,
  revealFnsAction,
  setFnsAction,
} from "@/actions/deal-fns.actions";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
const btnCls =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";

/**
 * Секция доступов ЛК ФНС в карточке сделки (§7). Логин/пароль шифруются на
 * сервере (@/lib/fns, AES-256-GCM); сюда с сервера НИКОГДА не приходят в
 * открытом виде до нажатия «Показать» (тогда пишется AuditLog чтения).
 */
export function FnsSection({
  clientId,
  dealId,
  hasCredential,
  configured,
}: {
  clientId: string;
  dealId: string;
  hasCredential: boolean;
  configured: boolean;
}) {
  const [setState, setAction, setPending] = useActionState(setFnsAction, {} as FnsSetState);
  const [revealState, revealAction, revealPending] = useActionState(
    revealFnsAction,
    { status: "idle" } as FnsRevealState,
  );
  const [, clearAction] = useActionState(clearFnsAction, {} as FnsSetState);

  if (!configured) {
    return (
      <p className="text-sm text-amber-700">
        Хранилище доступов ФНС не настроено: задайте FNS_ENCRYPTION_KEY в окружении.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Статус:</span>
        {hasCredential ? (
          <span className="font-medium text-emerald-700">доступы сохранены (зашифрованы)</span>
        ) : (
          <span className="text-slate-500">не сохранены</span>
        )}
      </div>

      {/* Показ расшифрованных доступов — по кнопке, с записью в аудит */}
      {hasCredential && (
        <div className="space-y-2">
          <form action={revealAction}>
            <input type="hidden" name="clientId" value={clientId} />
            <button type="submit" disabled={revealPending} className={btnCls}>
              Показать доступы
            </button>
          </form>
          {revealState.status === "shown" && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm">
              <div>
                <span className="text-slate-400">логин:</span> {revealState.login}
              </div>
              <div>
                <span className="text-slate-400">пароль:</span> {revealState.password}
              </div>
            </div>
          )}
          {revealState.status === "error" && (
            <p className="text-sm text-red-600">{revealState.message}</p>
          )}
        </div>
      )}

      {/* Форма сохранения/обновления */}
      <form action={setAction} className="space-y-3">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="dealId" value={dealId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="login" placeholder="Логин ЛК ФНС" className={inputCls} autoComplete="off" />
          <input
            name="password"
            placeholder="Пароль ЛК ФНС"
            className={inputCls}
            autoComplete="off"
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={setPending} className={btnCls}>
            {hasCredential ? "Обновить доступы" : "Сохранить доступы"}
          </button>
          {setState.error && <span className="text-sm text-red-600">{setState.error}</span>}
          {setState.ok && <span className="text-sm text-emerald-600">Сохранено ✓</span>}
        </div>
      </form>

      {hasCredential && (
        <form action={clearAction}>
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="dealId" value={dealId} />
          <button type="submit" className="text-sm text-red-600 hover:underline">
            Удалить доступы
          </button>
        </form>
      )}
    </div>
  );
}
