/**
 * @tax/db — единая точка доступа к БД.
 *
 * Клиент генерируется в ../generated/client (контракт §1 плана:
 * кастомный output — иначе standalone-Docker и `pnpm deploy` его не находят).
 * Перед typecheck/build обязателен `pnpm db:generate` (корневые скрипты это делают).
 */
// ВАЖНО: импорт с явным /index.js, НЕ каталогом: tsup-бандл бота оставляет
// этот путь литеральным external-импортом, а Node ESM не резолвит каталоги
// (ERR_UNSUPPORTED_DIR_IMPORT — бот-контейнер крашился на старте).
import { PrismaClient } from "../generated/client/index.js";
import { existsSync } from "node:fs";

/**
 * Vercel/AWS Lambda: webpack-бандл инлайнит JS клиента и теряет его __dirname,
 * из-за чего Prisma не находит нативный движок («could not locate the Query
 * Engine for runtime rhel-openssl-3.0.x»), хотя file-tracing кладёт файлы в
 * лямбду по стабильному пути. Подсказываем путь через env ТОЛЬКО когда файл
 * реально существует — на билд-машине/локально/в Docker условие ложно и
 * ничего не трогаем (заданный извне PRISMA_QUERY_ENGINE_LIBRARY уважаем).
 */
const LAMBDA_ENGINE =
  "/var/task/packages/db/generated/client/libquery_engine-rhel-openssl-3.0.x.so.node";
if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY && existsSync(LAMBDA_ENGINE)) {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = LAMBDA_ENGINE;
}

/**
 * Нормализация DATABASE_URL под Prisma (совместимость с managed-провайдерами):
 * - `channel_binding` вырезается — драйвер Prisma этот libpq-параметр не
 *   понимает (Neon добавляет его в свои строки по умолчанию);
 * - pooled-хостам (PgBouncer: `-pooler` у Neon / `:6543` у Supabase) добавляется
 *   `pgbouncer=true`, без него Prisma падает на prepared statements.
 * Прямых (unpooled) строк не касается. Значение самой env не меняется.
 */
function normalizeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    u.searchParams.delete("channel_binding");
    const pooled = u.hostname.includes("-pooler") || u.port === "6543";
    if (pooled && !u.searchParams.has("pgbouncer")) {
      u.searchParams.set("pgbouncer", "true");
    }
    return u.toString();
  } catch {
    return raw; // непарсибельную строку отдаём как есть — пусть упадёт с честной ошибкой Prisma
  }
}

// Singleton через globalThis: в dev Next.js пересоздаёт модули при hot-reload,
// без кэша каждый reload открывал бы новый пул подключений к Postgres.
// Кэшируем безусловно (без проверки NODE_ENV — прямой process.env запрещён §1;
// чтение DATABASE_URL здесь — не конфиг приложения, а нормализация драйвера).
const globalForPrisma = globalThis as unknown as { __taxPrisma?: PrismaClient };

const normalizedUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);

export const prisma: PrismaClient =
  globalForPrisma.__taxPrisma ??
  (globalForPrisma.__taxPrisma = new PrismaClient(
    normalizedUrl ? { datasources: { db: { url: normalizedUrl } } } : undefined,
  ));

// Реэкспорт всего сгенерированного: типы моделей, enum'ы (UserRole, ...),
// namespace Prisma (Decimal, ошибки P2002 и т.д.), класс PrismaClient.
export * from "../generated/client/index.js";
