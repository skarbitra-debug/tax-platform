"use server";

import { revalidatePath } from "next/cache";
import { deactivateReferralLink, getOrCreateActiveReferralLink } from "@tax/core";
import { requireRole } from "@/lib/require-role";

/**
 * Actions реф-ссылки ЛК риэлтора (M1-2/M1-3) — тонкие обёртки над @tax/core.
 * Каждый action начинается с requireRole("REALTOR") (2-й слой защиты, §1/§3).
 * realtorId берётся ТОЛЬКО из сессии — скрытым полям формы сервер не доверяет.
 */

/** REALTOR без профиля — аномалия данных: профиль создаётся при регистрации */
function realtorIdOrThrow(realtorId: string | null): string {
  if (!realtorId) {
    throw new Error("У пользователя REALTOR отсутствует профиль риэлтора");
  }
  return realtorId;
}

/**
 * Кнопка «Создать ссылку»: активная ссылка риэлтора или новая.
 * Идемпотентно — гонку двойного клика гасит partial-unique индекс БД
 * (core ловит P2002 и перечитывает существующую).
 */
export async function createMyReferralLink(): Promise<void> {
  const session = await requireRole("REALTOR");
  const realtorId = realtorIdOrThrow(session.user.realtorId);

  await getOrCreateActiveReferralLink(realtorId);
  revalidatePath("/cabinet");
}

/**
 * Кнопка «Деактивировать»: isActive=false + deactivatedAt.
 * Владение сверяет core по actorRealtorId — чужую ссылку тронуть нельзя,
 * даже если linkId подделан на клиенте.
 */
export async function deactivateMyReferralLink(linkId: string): Promise<void> {
  const session = await requireRole("REALTOR");
  const realtorId = realtorIdOrThrow(session.user.realtorId);

  await deactivateReferralLink({ linkId, actorRealtorId: realtorId, isAdmin: false });
  revalidatePath("/cabinet");
}
