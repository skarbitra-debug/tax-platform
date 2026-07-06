"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@tax/db";
import { requireRole } from "@/lib/require-role";

export type SettingsState = { ok?: boolean; error?: string };

/** Процент 0..100 с 2 знаками: "20", "20.5", "15,00" → строка для Decimal(5,2) */
const pctSchema = z
  .string()
  .transform((v) => v.replace(/\s/g, "").replace(",", "."))
  .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v), "Процент 0–999.99")
  .refine((v) => Number(v) <= 100, "Процент не может превышать 100");

const rublesSchema = z
  .string()
  .transform((v) => v.replace(/\s/g, "").replace(",", "."))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Сумма в рублях")
  .refine((v) => Number(v) <= 2_000_000_000, "Слишком большая сумма");

/**
 * Создать новую версию конфига комиссий (§2: настраиваемые ставки).
 * Старый активный конфиг деактивируется, новый становится активным — атомарно
 * в транзакции (partial-unique индекс допускает только один isActive=true).
 * Старые сделки продолжают ссылаться на прежнюю версию через DealCommission.configId.
 */
export async function saveCommissionConfigAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await requireRole("ADMIN");

  const parsed = z
    .object({
      clientRatePct: pctSchema,
      realtorRatePct: pctSchema,
      platformRatePct: pctSchema,
      commissionBase: z.enum(["REFUND_AMOUNT", "CONSULTANT_FEE"]),
      executorPayoutType: z.enum(["FIXED", "PERCENT"]),
      executorFixedAmount: rublesSchema.optional().or(z.literal("")),
      executorRatePct: pctSchema.optional().or(z.literal("")),
      minTaxThreshold: rublesSchema.optional().or(z.literal("")),
      showPlatformShareToRealtor: z.enum(["on", ""]).optional(),
    })
    .safeParse({
      clientRatePct: formData.get("clientRatePct"),
      realtorRatePct: formData.get("realtorRatePct"),
      platformRatePct: formData.get("platformRatePct"),
      commissionBase: formData.get("commissionBase"),
      executorPayoutType: formData.get("executorPayoutType"),
      executorFixedAmount: formData.get("executorFixedAmount") ?? "",
      executorRatePct: formData.get("executorRatePct") ?? "",
      minTaxThreshold: formData.get("minTaxThreshold") ?? "",
      showPlatformShareToRealtor: formData.get("showPlatformShareToRealtor") ?? "",
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля." };
  }
  const d = parsed.data;

  // при FIXED нужен фикс, при PERCENT — процент исполнителя
  if (d.executorPayoutType === "FIXED" && !d.executorFixedAmount) {
    return { error: "Укажите фиксированную выплату исполнителю." };
  }
  if (d.executorPayoutType === "PERCENT" && !d.executorRatePct) {
    return { error: "Укажите процент исполнителя." };
  }

  try {
    await prisma.$transaction([
      prisma.commissionConfig.updateMany({ where: { isActive: true }, data: { isActive: false } }),
      prisma.commissionConfig.create({
      data: {
        name: "config",
        clientRatePct: new Prisma.Decimal(d.clientRatePct),
        realtorRatePct: new Prisma.Decimal(d.realtorRatePct),
        platformRatePct: new Prisma.Decimal(d.platformRatePct),
        commissionBase: d.commissionBase,
        executorPayoutType: d.executorPayoutType,
        executorFixedAmount: d.executorFixedAmount ? new Prisma.Decimal(d.executorFixedAmount) : null,
        executorRatePct: d.executorRatePct ? new Prisma.Decimal(d.executorRatePct) : null,
        minTaxThreshold: d.minTaxThreshold ? new Prisma.Decimal(d.minTaxThreshold) : null,
        showPlatformShareToRealtor: d.showPlatformShareToRealtor === "on",
        isActive: true,
        createdById: session.user.id,
      },
      }),
    ]);
  } catch (e) {
    // Гонка двух одновременных сохранений: partial-unique индекс
    // CommissionConfig_single_active_key пропускает только одного — второй
    // получает P2002, а не второй активный конфиг. Честно просим повторить.
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return { error: "Настройки сохранял кто-то ещё одновременно — обновите страницу и повторите." };
    }
    throw e;
  }

  revalidatePath("/admin/settings/commissions");
  return { ok: true };
}

/** Обновить настраиваемый статус (§6): название, цвет, порядок */
export async function updateStatusAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("ADMIN");
  const parsed = z
    .object({
      statusId: z.string().min(1),
      label: z.string().trim().min(1, "Название обязательно").max(60),
      color: z
        .string()
        .trim()
        .regex(/^#[0-9a-fA-F]{6}$/, "Цвет в формате #rrggbb")
        .optional()
        .or(z.literal("")),
      sortOrder: z.coerce.number().int().min(0).max(10000),
    })
    .safeParse({
      statusId: formData.get("statusId"),
      label: formData.get("label"),
      color: formData.get("color") ?? "",
      sortOrder: formData.get("sortOrder"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Проверьте поля." };

  await prisma.dealStatus.update({
    where: { id: parsed.data.statusId },
    data: {
      label: parsed.data.label,
      color: parsed.data.color || null,
      sortOrder: parsed.data.sortOrder,
    },
  });
  revalidatePath("/admin/settings/statuses");
  return { ok: true };
}

/** Включить/выключить статус. Начальный (isInitial) выключать нельзя — на нём висит воронка */
export async function toggleStatusAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("ADMIN");
  const statusId = String(formData.get("statusId") ?? "");
  if (!statusId) return { error: "Статус не указан." };

  const status = await prisma.dealStatus.findUnique({
    where: { id: statusId },
    select: { code: true, isActive: true, isInitial: true },
  });
  if (!status) return { error: "Статус не найден." };
  if (status.isInitial && status.isActive) {
    return { error: "Нельзя выключить начальный статус — на него создаются заявки." };
  }
  // Коды, на которые завязаны авто-переходы (§6): выключение сломало бы
  // событие «договор отправлен» — авто-смена молча перестала бы работать
  const AUTO_TRANSITION_CODES = ["CONTRACT_SENT"];
  if (status.isActive && AUTO_TRANSITION_CODES.includes(status.code)) {
    return {
      error: `Статус ${status.code} используется авто-переходом «договор отправлен» — выключать нельзя (переименовать можно).`,
    };
  }

  await prisma.dealStatus.update({ where: { id: statusId }, data: { isActive: !status.isActive } });
  revalidatePath("/admin/settings/statuses");
  return { ok: true };
}

/** Добавить свой статус в воронку (§6: конфигурируемый набор) */
export async function addStatusAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("ADMIN");
  const parsed = z
    .object({
      code: z
        .string()
        .trim()
        .regex(/^[A-Z][A-Z0-9_]{1,39}$/, "Код: латиница в ВЕРХНЕМ регистре, цифры, _"),
      label: z.string().trim().min(1, "Название обязательно").max(60),
      sortOrder: z.coerce.number().int().min(0).max(10000),
      color: z
        .string()
        .trim()
        .regex(/^#[0-9a-fA-F]{6}$/, "Цвет в формате #rrggbb")
        .optional()
        .or(z.literal("")),
    })
    .safeParse({
      code: formData.get("code"),
      label: formData.get("label"),
      sortOrder: formData.get("sortOrder"),
      color: formData.get("color") ?? "",
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Проверьте поля." };

  try {
    await prisma.dealStatus.create({
      data: {
        code: parsed.data.code,
        label: parsed.data.label,
        sortOrder: parsed.data.sortOrder,
        color: parsed.data.color || null,
        isActive: true,
        isInitial: false,
        isTerminal: false,
      },
    });
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return { error: "Статус с таким кодом уже есть." };
    }
    throw e;
  }
  revalidatePath("/admin/settings/statuses");
  return { ok: true };
}
