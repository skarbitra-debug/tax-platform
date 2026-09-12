"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@tax/db";
import { signIn, signOut } from "@/auth";

/** Состояние для useActionState в формах логина/регистрации */
export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

/**
 * Открытые редиректы запрещены: принимаем только внутренние пути.
 * КРИТИЧНО: браузер нормализует "\" в "/", поэтому "/\evil.com" стал бы
 * протокол-относительным "//evil.com". Отвергаем и "//", и любой backslash,
 * и обратный слэш сразу после первого "/".
 */
function safeInternalPath(raw: string): string | null {
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.includes("\\")) return null;
  return raw;
}

/** Registration is disabled without consuming an invite or creating a user. */
export async function registerRealtor(
  _prev: AuthFormState,
  _formData: FormData,
): Promise<AuthFormState> {
  return { error: "Регистрация временно недоступна." };
}

/**
 * Логин: signIn без редиректа → редирект по роли (или на безопасный callbackUrl).
 * Единая ошибка на неверную пару — не раскрываем, что именно не так.
 */
export async function loginWithRedirect(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "");

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Неверный email или пароль." };
    }
    throw e; // NEXT_REDIRECT и прочее — наверх
  }

  // Роль — из БД, НЕ из auth(): свежая кука, выставленная signIn() внутри
  // этого же server action, ещё не видна auth() в том же запросе
  // (проверено вживую: админ улетал на /cabinet). Один SELECT по unique-индексу.
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { role: true },
  });
  const home = user?.role === "ADMIN" ? "/admin" : "/cabinet";
  redirect(safeInternalPath(callbackUrl) ?? home);
}

/** Выход: чистим JWT-куку и уводим на /login */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
