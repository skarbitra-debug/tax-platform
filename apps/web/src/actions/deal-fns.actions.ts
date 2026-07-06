"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clearFnsCredential, revealFnsCredential, setFnsCredential } from "@/lib/fns";
import { getRequestMeta } from "@/lib/request-meta";
import { requireRole } from "@/lib/require-role";

/** Состояние формы сохранения доступов */
export type FnsSetState = { ok?: boolean; error?: string };

/** Состояние показа доступов: при успехе несёт расшифрованные логин/пароль */
export type FnsRevealState =
  | { status: "idle" }
  | { status: "shown"; login: string; password: string }
  | { status: "error"; message: string };

/** Сохранить/обновить доступы ЛК ФНС клиента (шифрование в @/lib/fns) */
export async function setFnsAction(
  _prev: FnsSetState,
  formData: FormData,
): Promise<FnsSetState> {
  const session = await requireRole("ADMIN");
  const parsed = z
    .object({
      clientId: z.string().min(1),
      dealId: z.string().min(1),
      login: z.string().trim().min(1, "Введите логин"),
      password: z.string().min(1, "Введите пароль"),
    })
    .safeParse({
      clientId: formData.get("clientId"),
      dealId: formData.get("dealId"),
      login: formData.get("login"),
      password: formData.get("password"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля." };
  }

  try {
    await setFnsCredential({
      clientId: parsed.data.clientId,
      login: parsed.data.login,
      password: parsed.data.password,
      actorUserId: session.user.id,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось сохранить доступы." };
  }

  revalidatePath(`/admin/deals/${parsed.data.dealId}`);
  return { ok: true };
}

/** Показать (расшифровать) доступы — пишет AuditLog чтения (§7) */
export async function revealFnsAction(
  _prev: FnsRevealState,
  formData: FormData,
): Promise<FnsRevealState> {
  const session = await requireRole("ADMIN");
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return { status: "error", message: "Клиент не указан." };

  const meta = await getRequestMeta();
  const res = await revealFnsCredential({
    clientId,
    actorUserId: session.user.id,
    ip: meta.ip,
  });

  if (!res.ok) {
    return {
      status: "error",
      message:
        res.reason === "NOT_FOUND"
          ? "Доступы не сохранены."
          : "Не удалось расшифровать (проверьте FNS_ENCRYPTION_KEY).",
    };
  }
  return { status: "shown", login: res.login, password: res.password };
}

/** Удалить доступы */
export async function clearFnsAction(
  _prev: FnsSetState,
  formData: FormData,
): Promise<FnsSetState> {
  const session = await requireRole("ADMIN");
  const clientId = String(formData.get("clientId") ?? "");
  const dealId = String(formData.get("dealId") ?? "");
  if (!clientId) return { error: "Клиент не указан." };

  await clearFnsCredential(clientId, session.user.id);
  revalidatePath(`/admin/deals/${dealId}`);
  return { ok: true };
}
