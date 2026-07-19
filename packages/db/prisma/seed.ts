/**
 * Идемпотентный seed (upsert-only) — входит в прод-пайплайн (§5 плана):
 * без него на чистом VPS нет ни админа, ни статусов — воронка мертва.
 *
 * Гарантии повторного запуска:
 *  - существующие записи НЕ перетираются (update: {} везде, где запись
 *    могла быть отредактирована руками: пароль админа, лейблы статусов, ставки);
 *  - ровно 1 админ, 8 статусов, 1 конфиг комиссий, 1 инвайт-код.
 *
 * Env читается напрямую через process.env — это скрипт, не приложение
 * (исключение из контракта §1 оговорено планом), но с проверкой наличия.
 */
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

/** Обязательная переменная: падаем с внятной ошибкой, а не с NPE глубже. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`seed: переменная окружения ${name} не задана (см. .env.example в корне репо)`);
  }
  return value;
}

/**
 * argon2id (контракт §1: не bcrypt), параметры OWASP: m=19456 KiB, t=2, p=1.
 * algorithm не передаём: дефолт @node-rs/argon2 — Argon2id, а сам enum Algorithm —
 * ambient const enum, несовместимый с verbatimModuleSyntax (TS2748).
 */
function hashPassword(plain: string): Promise<string> {
  return hash(plain, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

/// ---------- 1. Админ (Татьяна) ----------
async function seedAdmin(): Promise<void> {
  // Валидация формата инлайн (контракт seedEnvSchema из @tax/config): в
  // migrate-образе workspace-пакетов нет (см. packages/db/Dockerfile), поэтому
  // правила продублированы — email с «@», пароль ≥8. Иначе опечатка оператора
  // молча создала бы админа с кривым email/слабым паролем вместо fail-fast.
  const email = requireEnv("ADMIN_EMAIL").trim().toLowerCase(); // lowercase — тот же канон, что в core
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`seed: ADMIN_EMAIL не похож на email: "${email}"`);
  }
  const password = requireEnv("ADMIN_INITIAL_PASSWORD");
  if (password.length < 8) {
    throw new Error("seed: ADMIN_INITIAL_PASSWORD короче 8 символов (контракт seedEnvSchema)");
  }

  await prisma.user.upsert({
    where: { email },
    update: {}, // существующего админа не трогаем: пароль мог быть сменён в ЛК
    create: {
      email,
      passwordHash: await hashPassword(password),
      name: "Татьяна",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  console.log(`seed: админ ${email} — ok`);
}

/// ---------- 2. Статусы воронки (§6 ТЗ), стабильный ключ — code ----------
const STATUSES = [
  { code: "NEW",              label: "Новая заявка",       sortOrder: 10, isInitial: true,  isTerminal: false },
  { code: "CONTRACT_SENT",    label: "Договор отправлен",  sortOrder: 20, isInitial: false, isTerminal: false },
  { code: "IN_PROGRESS",      label: "В работе",           sortOrder: 30, isInitial: false, isTerminal: false },
  { code: "CORRECTION_FILED", label: "Уточнёнка подана",   sortOrder: 40, isInitial: false, isTerminal: false },
  { code: "FNS_REVIEW",       label: "Проверка ФНС",       sortOrder: 50, isInitial: false, isTerminal: false },
  { code: "MONEY_ON_ENS",     label: "Деньги на ЕНС",      sortOrder: 60, isInitial: false, isTerminal: false },
  { code: "CLIENT_PAID",      label: "Клиент оплатил",     sortOrder: 70, isInitial: false, isTerminal: false },
  { code: "CLOSED",           label: "Закрыта",            sortOrder: 80, isInitial: false, isTerminal: true  },
] as const;

async function seedStatuses(): Promise<void> {
  for (const s of STATUSES) {
    await prisma.dealStatus.upsert({
      where: { code: s.code },
      update: {}, // лейблы/порядок админ правит свободно (§6) — не перетираем
      create: { ...s },
    });
  }
  console.log(`seed: статусы (${STATUSES.length}) — ok`);
}

/// ---------- 3. Конфиг комиссий по умолчанию (20/15/5, FIXED 20000) ----------
async function seedCommissionConfig(): Promise<void> {
  // У name нет @unique, а партиальный индекс пускает только один isActive=true,
  // поэтому: есть хоть один конфиг (админ мог создать свой) → ничего не делаем.
  const existing = await prisma.commissionConfig.count();
  if (existing > 0) {
    console.log("seed: конфиг комиссий уже есть — пропуск");
    return;
  }
  await prisma.commissionConfig.create({
    data: {
      name: "default",
      clientRatePct: "20.00",
      realtorRatePct: "15.00",
      platformRatePct: "5.00",
      executorPayoutType: "FIXED",
      executorFixedAmount: "20000.00",
      // База = гонорар Татьяны (не весь возврат): доли риэлтора/площадки берутся
      // из её 20%, иначе 15%+5% от возврата съедают весь гонорар и Татьяне минус.
      // Экономически осмысленный дефолт под пример ТЗ §2; Татьяна меняет в настройках.
      commissionBase: "CONSULTANT_FEE",
      showPlatformShareToRealtor: false,
      minTaxThreshold: "250000.00", // единственный дом порога 250к (§1)
      isActive: true,
    },
  });
  console.log("seed: конфиг комиссий default — ok");
}

/// ---------- 4. Инвайт-код пилота — ТОЛЬКО в dev ----------
// В проде предсказуемый код («PILOT-2026») — угадываемая дверь в закрытый
// пилот (§7 ТЗ). Поэтому на проде инвайты не сеются: Татьяна (админ из seed)
// создаёт коды со случайным INV-XXXX-XXXX через /admin/invites. Здесь — только
// удобный фиксированный код для локальной разработки.
async function seedInvite(): Promise<void> {
  if (process.env.SEED_DEV !== "1") {
    console.log("seed: инвайт-коды в проде не создаются (админ заведёт в /admin/invites)");
    return;
  }
  await prisma.inviteCode.upsert({
    where: { code: "PILOT-2026" },
    update: {}, // usedCount/isActive живут своей жизнью — не сбрасываем
    create: { code: "PILOT-2026", label: "Dev-инвайт", maxUses: 100 },
  });
  console.log("seed[dev]: инвайт-код PILOT-2026 — ok");
}

/// ---------- 5. Dev-данные (SEED_DEV=1): тестовый риэлтор + ссылка + 2 сделки ----------
const DEV_REALTOR_EMAIL = "realtor.dev@example.com";
const DEV_REALTOR_PASSWORD = "dev-realtor-123"; // только dev; в проде SEED_DEV не включается
// Токен соответствует контракту §1: 12 символов алфавита abcdefghjkmnpqrstuvwxyz23456789
const DEV_REF_TOKEN = "abcdefgh2345";

async function seedDev(): Promise<void> {
  if (process.env.SEED_DEV !== "1") return;

  // Тестовый риэлтор + профиль
  const user = await prisma.user.upsert({
    where: { email: DEV_REALTOR_EMAIL },
    update: {},
    create: {
      email: DEV_REALTOR_EMAIL,
      passwordHash: await hashPassword(DEV_REALTOR_PASSWORD),
      name: "Тест Риэлторов",
      role: "REALTOR",
      status: "ACTIVE",
    },
  });
  const profile = await prisma.realtorProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, agencyName: "Dev-агентство", city: "Санкт-Петербург" },
  });

  // Реферальная ссылка: ищем по ТОКЕНУ (@unique), а не по «активной» —
  // иначе повторный seed после деактивации ссылки падал бы на create с P2002
  // (токен-то остался). upsert по token идемпотентен при любом isActive.
  const link = await prisma.referralLink.upsert({
    where: { token: DEV_REF_TOKEN },
    update: {}, // isActive существующей не трогаем
    create: { token: DEV_REF_TOKEN, realtorId: profile.id, label: "dev" },
  });

  const statusNew = await prisma.dealStatus.findUniqueOrThrow({ where: { code: "NEW" } });

  // 2 сделки; идемпотентность — по submissionId (@unique), как у реальной анкеты
  const DEV_DEALS = [
    {
      submissionId: "seed-dev-deal-1",
      phone: "+79990000001",
      firstName: "Иван",
      saleAmount: "12500000.00",
      taxPaidAmount: "455000.00",
      belowThreshold: false,
    },
    {
      submissionId: "seed-dev-deal-2",
      phone: "+79990000002",
      firstName: "Мария",
      saleAmount: "4200000.00",
      taxPaidAmount: "180000.00",
      belowThreshold: true, // ниже порога 250к — проверка бейджа в ЛК (M1-6)
    },
  ] as const;

  for (const d of DEV_DEALS) {
    const exists = await prisma.deal.findUnique({ where: { submissionId: d.submissionId } });
    if (exists) continue;

    // Клиент: reuse по нормализованному телефону — как в createLead (§4 плана)
    await prisma.$transaction(async (tx) => {
      let client = await tx.client.findFirst({ where: { phone: d.phone } });
      client ??= await tx.client.create({ data: { firstName: d.firstName, phone: d.phone } });

      const deal = await tx.deal.create({
        data: {
          clientId: client.id,
          realtorId: profile.id,
          referralLinkId: link.id,
          statusId: statusNew.id,
          submissionId: d.submissionId,
          saleAmount: d.saleAmount,
          taxPaidAmount: d.taxPaidAmount,
          consentPersonalData: true,
          consentRatePct: "20.00", // снапшот ставки, которую клиент видел
          belowThreshold: d.belowThreshold,
          thresholdAtSubmission: "250000.00",
        },
      });
      // Первичная установка статуса — как в боевой транзакции createLead
      await tx.dealStatusHistory.create({
        data: {
          dealId: deal.id,
          fromStatusId: null,
          toStatusId: statusNew.id,
          mode: "AUTO",
          source: "SYSTEM",
        },
      });
    });
  }
  console.log(`seed[dev]: риэлтор ${DEV_REALTOR_EMAIL} (пароль ${DEV_REALTOR_PASSWORD}), ссылка /r/${link.token}, сделки — ok`);
}

async function main(): Promise<void> {
  await seedAdmin();
  await seedStatuses();
  await seedCommissionConfig();
  await seedInvite();
  await seedDev();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("seed: готово");
  })
  .catch(async (e) => {
    console.error("seed: ошибка", e);
    await prisma.$disconnect();
    process.exit(1);
  });
