import { prisma } from "@tax/db";
import { isUniqueViolation } from "../internal/prisma-errors";
import { REFERRAL_TOKEN_REGEX, generateReferralToken } from "./token";

/** Публичная форма активной ссылки — ровно то, что нужно блоку «Моя ссылка» в ЛК */
export type ActiveReferralLink = {
  id: string;
  token: string;
  isActive: boolean;
  createdAt: Date;
};

const linkSelect = { id: true, token: true, isActive: true, createdAt: true } as const;

/**
 * Активная ссылка риэлтора или создание новой (идемпотентно, M1-2).
 *
 * Инвариант «одна активная ссылка на риэлтора» держит БД: partial-unique
 * индекс ReferralLink_realtorId_active_key (raw SQL в init-миграции).
 * Гонка двойного клика → у проигравшего P2002 → перечитываем ссылку соседа.
 * P2002 может прилететь и по token (коллизия nanoid, ~никогда при 60 битах) —
 * различаем по факту: активная ссылка уже есть → гонка; нет → коллизия → 1 retry.
 */
export async function getOrCreateActiveReferralLink(
  realtorId: string,
): Promise<ActiveReferralLink> {
  const existing = await prisma.referralLink.findFirst({
    where: { realtorId, isActive: true },
    select: linkSelect,
  });
  if (existing) return existing;

  // 2 попытки: первая + один retry на коллизию токена
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.referralLink.create({
        data: { realtorId, token: generateReferralToken() },
        select: linkSelect,
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // P2002: либо сосед по гонке успел создать активную — возвращаем её,
      // либо (активной нет) коллизия token — идём на новую попытку
      const raced = await prisma.referralLink.findFirst({
        where: { realtorId, isActive: true },
        select: linkSelect,
      });
      if (raced) return raced;
    }
  }
  throw new Error("Не удалось создать реферальную ссылку: повторная коллизия токена.");
}

/**
 * Деактивация ссылки: isActive=false + deactivatedAt (мягко, строка остаётся —
 * на ней держится атрибуция старых сделок через Deal.referralLinkId).
 *
 * Права: не-админ может деактивировать ТОЛЬКО свою (actorRealtorId из сессии,
 * не из формы — контракт §1). Владение проверяется прямо в WHERE updateMany —
 * авторизация и мутация одним запросом, без TOCTOU.
 */
export async function deactivateReferralLink(args: {
  linkId: string;
  actorRealtorId: string | null;
  isAdmin: boolean;
}): Promise<void> {
  const { linkId, actorRealtorId, isAdmin } = args;

  // Не-админ без realtorId — аномальная сессия, отказ до похода в БД
  if (!isAdmin && !actorRealtorId) {
    throw new Error("Нет прав на деактивацию ссылки.");
  }

  const updated = await prisma.referralLink.updateMany({
    where: {
      id: linkId,
      isActive: true,
      ...(isAdmin ? {} : { realtorId: actorRealtorId as string }),
    },
    data: { isActive: false, deactivatedAt: new Date() },
  });
  if (updated.count > 0) return;

  // count 0 — разбираем причину: повторная деактивация своей → идемпотентный no-op
  const link = await prisma.referralLink.findUnique({
    where: { id: linkId },
    select: { isActive: true, realtorId: true },
  });
  if (link && !link.isActive && (isAdmin || link.realtorId === actorRealtorId)) {
    return;
  }
  throw new Error(link ? "Можно деактивировать только свою ссылку." : "Ссылка не найдена.");
}

/** Результат резолва токена для страницы /r/[token] (SSR, M1-4) */
export type ResolveReferralLinkResult =
  | { status: "active"; link: { id: string; realtorId: string } }
  | { status: "inactive" }
  | { status: "not_found" };

/**
 * Резолв реф-токена: active / inactive / not_found — три состояния страницы
 * анкеты (§4 edge cases: «работаем по приглашениям» vs «ссылка устарела»).
 * Мусорный токен отсекается regex'ом без похода в БД (дёшево под перебором).
 */
export async function resolveReferralLink(token: string): Promise<ResolveReferralLinkResult> {
  if (!REFERRAL_TOKEN_REGEX.test(token)) return { status: "not_found" };

  const link = await prisma.referralLink.findUnique({
    where: { token },
    select: { id: true, realtorId: true, isActive: true },
  });
  if (!link) return { status: "not_found" };
  if (!link.isActive) return { status: "inactive" };
  return { status: "active", link: { id: link.id, realtorId: link.realtorId } };
}
