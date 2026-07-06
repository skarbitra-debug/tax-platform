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

// Singleton через globalThis: в dev Next.js пересоздаёт модули при hot-reload,
// без кэша каждый reload открывал бы новый пул подключений к Postgres.
// Кэшируем безусловно (без проверки NODE_ENV — прямой process.env запрещён §1):
// в проде процесс один, лишний глобальный указатель безвреден.
const globalForPrisma = globalThis as unknown as { __taxPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__taxPrisma ?? (globalForPrisma.__taxPrisma = new PrismaClient());

// Реэкспорт всего сгенерированного: типы моделей, enum'ы (UserRole, ...),
// namespace Prisma (Decimal, ошибки P2002 и т.д.), класс PrismaClient.
export * from "../generated/client/index.js";
