import { type LeadFormInput, generateReferralToken } from "@tax/core";
import { prisma } from "@tax/db";

/**
 * Фикстуры интеграционных тестов. Каждый тест создаёт СВОЙ изолированный
 * набор (риэлтор + активная ссылка + уникальные телефоны), чтобы тесты не
 * зависели от seed-данных и не мешали друг другу в общей БД.
 */

let counter = 0;
/** Уникальный суффикс на процесс+вызов (Date.now доступен в vitest/node) */
function uniq(): string {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

/** Уникальный РФ-телефон +7 9XX XXXXXXX */
export function uniquePhone(): string {
  const n = (Date.now() % 1_000_000_000) + counter++;
  return "+79" + String(n).padStart(9, "0").slice(-9);
}

export interface TestRealtor {
  userId: string;
  realtorId: string;
  linkId: string;
  token: string;
}

/** Риэлтор с профилем и одной активной реф-ссылкой */
export async function createTestRealtor(): Promise<TestRealtor> {
  const email = `realtor-${uniq()}@test.local`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: "x", // тесты логин не гоняют
      role: "REALTOR",
      status: "ACTIVE",
      realtorProfile: { create: {} },
    },
    include: { realtorProfile: true },
  });
  const realtorId = user.realtorProfile!.id;
  const link = await prisma.referralLink.create({
    data: { token: generateReferralToken(), realtorId, label: "test" },
  });
  return { userId: user.id, realtorId, linkId: link.id, token: link.token };
}

/** Удалить всё, созданное тестовым риэлтором (в порядке FK) */
export async function cleanupRealtor(r: TestRealtor): Promise<void> {
  const deals = await prisma.deal.findMany({
    where: { realtorId: r.realtorId },
    select: { id: true, clientId: true },
  });
  const dealIds = deals.map((d) => d.id);
  const clientIds = [...new Set(deals.map((d) => d.clientId))];

  await prisma.voiceCommandLog.deleteMany({ where: { dealId: { in: dealIds } } });
  await prisma.dealStatusHistory.deleteMany({ where: { dealId: { in: dealIds } } });
  await prisma.dealCommission.deleteMany({ where: { dealId: { in: dealIds } } });
  await prisma.payout.deleteMany({ where: { dealId: { in: dealIds } } });
  await prisma.deal.deleteMany({ where: { id: { in: dealIds } } });
  await prisma.fnsCredential.deleteMany({ where: { clientId: { in: clientIds } } });
  await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
  await prisma.referralLink.deleteMany({ where: { realtorId: r.realtorId } });
  await prisma.realtorProfile.deleteMany({ where: { id: r.realtorId } });
  await prisma.user.deleteMany({ where: { id: r.userId } });
}

/** Валидный вход анкеты для createLead (как после leadFormSchema) */
export function leadInput(token: string, over: Partial<LeadFormInput> = {}): LeadFormInput {
  return {
    token,
    submissionId: crypto.randomUUID(),
    firstName: "Тест",
    phone: uniquePhone(),
    telegram: undefined,
    salePriceRub: 5_000_000,
    taxPaidRub: 400_000,
    consentNoUnderstatement: true,
    consentPaymentTerms: true,
    ...over,
  };
}
