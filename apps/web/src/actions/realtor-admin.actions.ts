"use server";

import { revalidatePath } from "next/cache";
import { deactivateReferralLink } from "@tax/core";
import { prisma } from "@tax/db";
import { requireRole } from "@/lib/require-role";

export type RealtorAdminState = { ok?: boolean; error?: string };

/**
 * Блокировка/разблокировка риэлтора (§4.6, обещано в M2). Серверная механика
 * готова давно: requireRole сверяет User.status по БД — BLOCKED с живым JWT
 * получает отказ немедленно. При блокировке дополнительно гасим его активную
 * реф-ссылку (клиенты по старой ссылке видят «ссылка устарела» — заявки
 * расставшемуся партнёру не капают). Разблокировка ссылку НЕ возвращает —
 * риэлтор создаст новую в один клик.
 */
export async function toggleRealtorBlockAction(
  _prev: RealtorAdminState,
  formData: FormData,
): Promise<RealtorAdminState> {
  const session = await requireRole("ADMIN");
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Риэлтор не указан." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, realtorProfile: { select: { id: true } } },
  });
  if (!user || user.role !== "REALTOR") return { error: "Риэлтор не найден." };

  const nextStatus = user.status === "BLOCKED" ? "ACTIVE" : "BLOCKED";
  await prisma.user.update({ where: { id: user.id }, data: { status: nextStatus } });

  // Блокировка гасит активную ссылку — атрибуция старых заявок не трогается
  if (nextStatus === "BLOCKED" && user.realtorProfile) {
    const active = await prisma.referralLink.findFirst({
      where: { realtorId: user.realtorProfile.id, isActive: true },
      select: { id: true },
    });
    if (active) {
      await deactivateReferralLink({
        linkId: active.id,
        actorRealtorId: null,
        isAdmin: true,
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: nextStatus === "BLOCKED" ? "realtor.block" : "realtor.unblock",
      entityType: "User",
      entityId: user.id,
    },
  });

  revalidatePath("/admin/realtors");
  return { ok: true };
}
