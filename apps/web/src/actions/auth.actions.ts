"use server";

import { hash } from "@node-rs/argon2";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizeRuPhone } from "@tax/core";
import { prisma } from "@tax/db";
import { signIn, signOut } from "@/auth";

/** Состояние для useActionState в формах логина/регистрации */
export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

/**
 * Схема регистрации риэлтора. КРИТИЧНО (план §3): поля role здесь НЕТ —
 * mass-assignment исключён на уровне схемы, role захардкожен в create ниже.
 * Телефон нормализуется в +7XXXXXXXXXX локально; в M1 замена на
 * normalizeRuPhone из @tax/core (единый нормализатор с анкетой клиента).
 */
const registerSchema = z.object({
  name: z.string().trim().min(2, "Имя — минимум 2 символа"),
  // Единый нормализатор с анкетой клиента (@tax/core), не локальный дубль:
  // одинаковый формат +7XXXXXXXXXX по всей платформе
  phone: z
    .string()
    .transform((v) => normalizeRuPhone(v))
    .refine((v): v is string => v !== null, "Телефон в формате +7 XXX XXX-XX-XX"),
  email: z.string().trim().toLowerCase().email("Некорректный email"),
  password: z.string().min(10, "Пароль — минимум 10 символов"),
  inviteCode: z.string().trim().min(1, "Укажите инвайт-код"),
});

/** P2002 (unique violation) без импорта Prisma-namespace — меньше стыковок */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

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

/**
 * Регистрация риэлтора по инвайт-коду (M0-8).
 * Транзакция: проверка кода → гонкоустойчивый инкремент usedCount →
 * User (role: REALTOR захардкожен) + RealtorProfile → авто-логин → /cabinet.
 */
export async function registerRealtor(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    password: formData.get("password"),
    inviteCode: formData.get("inviteCode"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { name, phone, email, password, inviteCode } = parsed.data;

  // argon2id (контракт §1); дефолтный алгоритм @node-rs/argon2 — argon2id,
  // параметры по умолчанию соответствуют рекомендациям OWASP
  const passwordHash = await hash(password);

  let result: { ok: true } | { ok: false; error: string };
  try {
    result = await prisma.$transaction(async (tx) => {
      const invite = await tx.inviteCode.findUnique({ where: { code: inviteCode } });
      if (!invite || !invite.isActive) {
        return { ok: false as const, error: "Инвайт-код не найден или отозван." };
      }
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        return { ok: false as const, error: "Срок действия инвайт-кода истёк." };
      }
      // Инкремент с условием в WHERE — двое одновременных на последнем слоте
      // не проскочат: у второго count === 0
      const claimed = await tx.inviteCode.updateMany({
        where: {
          id: invite.id,
          isActive: true,
          usedCount: { lt: invite.maxUses },
        },
        data: { usedCount: { increment: 1 } },
      });
      if (claimed.count === 0) {
        return { ok: false as const, error: "Лимит использований инвайт-кода исчерпан." };
      }

      await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          phone,
          role: "REALTOR", // захардкожено; ADMIN появляется только из seed (план §3)
          status: "ACTIVE",
          inviteCodeId: invite.id,
          realtorProfile: { create: {} },
        },
      });
      return { ok: true as const };
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Дубль email: ОБЩАЯ ошибка — существование аккаунта не раскрываем (план §6 M0-8)
      return { error: "Не удалось завершить регистрацию. Проверьте данные и попробуйте ещё раз." };
    }
    throw e;
  }
  if (!result.ok) return { error: result.error };

  // Авто-логин свежесозданным риэлтором
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      // Аккаунт создан, но вход не удался — отправляем на ручной логин
      redirect("/login");
    }
    throw e;
  }
  redirect("/cabinet");
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
