"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@tax/db";
import { requireRole } from "@/lib/require-role";

/** Состояние для useActionState формы создания инвайта */
export type InviteFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Свежесозданный код — показываем Татьяне сразу под формой */
  createdCode?: string;
};

/**
 * Алфавит без визуальных двойников (I/L/O/0/1 исключены) — код диктуют
 * по телефону и перепечатывают с бумажки. Тот же принцип, что у реф-токена
 * (§1), но верхний регистр: инвайт вводят руками, а не открывают по ссылке.
 */
const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Читаемый код вида INV-XXXX-XXXX; randomInt — CSPRNG без модульного смещения */
function generateInviteCode(): string {
  const group = () =>
    Array.from({ length: 4 }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join("");
  return `INV-${group()}-${group()}`;
}

/** P2002 (unique violation) без импорта Prisma-namespace — как в auth.actions */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/** null и пустая строка из FormData → undefined (для optional-полей) */
const emptyToUndef = (v: unknown) =>
  v == null || (typeof v === "string" && v.trim() === "") ? undefined : v;

const createInviteSchema = z.object({
  label: z.preprocess(
    emptyToUndef,
    z
      .string()
      .trim()
      .min(2, "Метка — минимум 2 символа")
      .max(100, "Метка — максимум 100 символов")
      .optional(),
  ),
  maxUses: z.preprocess(
    emptyToUndef,
    z.coerce
      .number({ invalid_type_error: "Лимит — целое число" })
      .int("Лимит — целое число")
      .min(1, "Лимит — минимум 1")
      .max(10_000, "Лимит — максимум 10 000")
      .default(50), // план §2: дефолт 50 использований на агентство
  ),
  expiresAt: z.preprocess(
    emptyToUndef,
    z.coerce.date({ invalid_type_error: "Некорректная дата" }).optional(),
  ),
});

/**
 * Создание инвайт-кода (M1-7). requireRole в самом action — layout-guard'у
 * одному не доверяем (план §3: каждый server action начинается с проверки).
 */
export async function createInvite(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const session = await requireRole("ADMIN");

  const parsed = createInviteSchema.safeParse({
    label: formData.get("label"),
    maxUses: formData.get("maxUses"),
    expiresAt: formData.get("expiresAt"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { label, maxUses } = parsed.data;

  // <input type="date"> даёт полночь — сдвигаем на конец дня, чтобы код
  // действовал весь указанный день включительно (и «сегодня» было валидно)
  let expiresAt: Date | null = null;
  if (parsed.data.expiresAt) {
    expiresAt = new Date(parsed.data.expiresAt);
    expiresAt.setHours(23, 59, 59, 999);
    if (expiresAt < new Date()) {
      return { fieldErrors: { expiresAt: ["Дата окончания уже прошла"] } };
    }
  }

  // Коллизия кода почти невероятна (31^8), но истина — unique-индекс:
  // P2002 → новый код, до 3 попыток
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateInviteCode();
    try {
      await prisma.inviteCode.create({
        data: {
          code,
          label: label ?? null,
          maxUses,
          expiresAt,
          createdById: session.user.id,
        },
      });
      revalidatePath("/admin/invites");
      return { createdCode: code };
    } catch (e) {
      if (isUniqueViolation(e)) continue;
      throw e;
    }
  }
  return { error: "Не удалось сгенерировать уникальный код. Попробуйте ещё раз." };
}

const revokeSchema = z.object({
  inviteId: z.string().cuid("Некорректный идентификатор кода"),
});

/**
 * Отзыв инвайт-кода: isActive=false (регистрация по нему сразу перестаёт
 * работать — auth.actions проверяет isActive внутри транзакции).
 * Скрытому полю формы не доверяем (§1): id валидируется Zod'ом,
 * права — requireRole; админ вправе отозвать любой код.
 */
export async function revokeInvite(formData: FormData): Promise<void> {
  await requireRole("ADMIN");

  const parsed = revokeSchema.safeParse({ inviteId: formData.get("inviteId") });
  if (!parsed.success) return; // мусорный id — молча игнорируем, ронять нечего

  // updateMany: несуществующий/уже отозванный id не кидает P2025 — просто 0 строк
  await prisma.inviteCode.updateMany({
    where: { id: parsed.data.inviteId, isActive: true },
    data: { isActive: false },
  });
  revalidatePath("/admin/invites");
}
