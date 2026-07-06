// @tax/config — единственный владелец env-словаря (план §1, §5).
// Правило: переменная появляется сначала в .env.example и здесь, потом в коде.
// Приложения НЕ трогают process.env напрямую — только loadEnv(schema).

import { z } from 'zod';

// ---------- хелперы ----------

/**
 * dotenv отдаёт незаполненные ключи как "" (см. .env.example: `FNS_ENCRYPTION_KEY=`).
 * Для optional-переменных пустую строку приравниваем к «не задано»,
 * иначе .optional() бесполезен — "" валился бы на regex/refine.
 */
const emptyAsUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    schema,
  );

/**
 * Boolean-подобный флаг из env: "0"/"false"/"no"/"off" → false, всё прочее → true.
 * Не задан или пуст → defaultValue. Голый z.coerce.boolean() тут не годится:
 * он превратил бы строку "0" в true (непустая строка truthy).
 */
const boolish = (defaultValue: boolean) =>
  z.preprocess((v) => {
    if (v === undefined || v === null || v === '') return defaultValue;
    if (typeof v === 'string') {
      return !['0', 'false', 'no', 'off'].includes(v.trim().toLowerCase());
    }
    return Boolean(v);
  }, z.boolean());

/** Строгий base64 (стандартный алфавит) + ровно 32 байта после декодирования. */
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const isBase64Of32Bytes = (v: string): boolean =>
  BASE64_RE.test(v) && Buffer.from(v, 'base64').byteLength === 32;

// ---------- схемы ----------

/** Общая база web и bot. */
export const baseSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: z
    .string()
    .startsWith('postgresql://', 'ожидается postgresql://-строка подключения'),
  APP_URL: z.string().url('APP_URL должен быть валидным URL (база реф-ссылок)'),
});

/** apps/web: Auth.js + пилотные флаги. */
export const webEnvSchema = baseSchema.extend({
  // секрет подписи JWT (Credentials-стратегия, таблиц сессий нет — план §1)
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET короче 32 символов (openssl rand -base64 33)'),
  // за reverse-proxy (Caddy) хосту доверяем всегда
  AUTH_TRUST_HOST: z.coerce.boolean().default(true),
  // закрытый пилот: noindex по умолчанию ВКЛЮЧЁН — выключается явным "0"
  PILOT_NOINDEX: boolish(true),
  // AES-256-GCM ключ хранилища ФНС: генерируется в M0, обязателен с M4 —
  // поэтому optional, но если задан, обязан быть корректным (тихая порча ключа недопустима)
  FNS_ENCRYPTION_KEY: emptyAsUndefined(
    z
      .string()
      .refine(
        isBase64Of32Bytes,
        'FNS_ENCRYPTION_KEY: ожидается base64 от ровно 32 байт (openssl rand -base64 32)',
      )
      .optional(),
  ),
  // M3: передача заявки в канал девочек (§4.5) отправляется прямо из web
  // через Bot API. Оба optional: пока не заданы — хендофф молча пропускается
  // (заявка всё равно создаётся, Татьяна видит её в ЛК).
  TELEGRAM_BOT_TOKEN: emptyAsUndefined(
    z.string().regex(/^\d+:[\w-]{30,}$/, 'TELEGRAM_BOT_TOKEN не похож на токен BotFather').optional(),
  ),
  TELEGRAM_CHANNEL_ID: emptyAsUndefined(
    z.string().regex(/^-100\d+$/, 'TELEGRAM_CHANNEL_ID: ожидается формат -100xxxxxxxxxx').optional(),
  ),
});

/**
 * Seed/migrate-контейнер (packages/db). ADMIN_* нужны ТОЛЬКО одноразовому
 * сиду админа — НЕ приложению web (иначе web-контейнер падал бы на старте,
 * не получив seed-only переменные от compose). Пароль потом меняется в ЛК.
 */
export const seedEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .startsWith('postgresql://', 'ожидается postgresql://-строка подключения'),
  ADMIN_EMAIL: z.string().email('ADMIN_EMAIL должен быть валидным email'),
  ADMIN_INITIAL_PASSWORD: z.string().min(8, 'ADMIN_INITIAL_PASSWORD минимум 8 символов'),
});

/** apps/bot: grammY long polling. */
export const botEnvSchema = baseSchema.extend({
  // формат BotFather: <числовой id>:<секрет 30+ символов [A-Za-z0-9_-]>
  TELEGRAM_BOT_TOKEN: z
    .string()
    .regex(/^\d+:[\w-]{30,}$/, 'TELEGRAM_BOT_TOKEN не похож на токен BotFather'),
  // канал девочек — обязателен только с M2; если задан — формат супергруппы/канала
  TELEGRAM_CHANNEL_ID: emptyAsUndefined(
    z
      .string()
      .regex(/^-100\d+$/, 'TELEGRAM_CHANNEL_ID: ожидается формат -100xxxxxxxxxx')
      .optional(),
  ),
  // голосовой ассистент — M3
  ANTHROPIC_API_KEY: emptyAsUndefined(z.string().min(1).optional()),
  // чат Татьяны: ТОЛЬКО он может голосом двигать статусы (§4.7). Без него
  // голосовой ассистент отвечает «не авторизовано». Числовой chat_id.
  TELEGRAM_ADMIN_CHAT_ID: emptyAsUndefined(
    z.string().regex(/^-?\d+$/, 'TELEGRAM_ADMIN_CHAT_ID: числовой chat_id').optional(),
  ),
  // модель Claude для разбора голосовых команд (дёшево и быстро — haiku)
  VOICE_LLM_MODEL: z.string().default('claude-haiku-4-5-20251001'),
});

export type BaseEnv = z.infer<typeof baseSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
export type BotEnv = z.infer<typeof botEnvSchema>;
export type SeedEnv = z.infer<typeof seedEnvSchema>;

/**
 * Build-safe чтение флага noindex БЕЗ полного парса схемы.
 * generateMetadata корневого layout выполняется на пререндере статических
 * страниц (`next build`), где секретов (AUTH_SECRET и пр.) нет — полный
 * webEnvSchema.parse там уронил бы сборку. Флаг закрытости пилота от них
 * не зависит, поэтому читаем его отдельно (владелец имени — по-прежнему тут).
 * По умолчанию noindex ВКЛЮЧЁН: safe-default для закрытого пилота.
 */
export function pilotNoindexFromEnv(): boolean {
  const raw = process.env.PILOT_NOINDEX;
  if (raw === undefined || raw.trim() === '') return true;
  return !['0', 'false', 'no', 'off'].includes(raw.trim().toLowerCase());
}

// ---------- загрузчик ----------

/**
 * Валидирует process.env по схеме. При ошибке — печатает перечень
 * проблемных ключей и гасит процесс (fail-fast на старте, DoD M0-2:
 * «старт без обязательной переменной падает с перечнем недостающих»).
 */
export function loadEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
): z.infer<TSchema> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => {
      const key = issue.path.join('.') || '(root)';
      return `  - ${key}: ${issue.message}`;
    });
    console.error(
      `[@tax/config] Невалидное окружение — проверь .env (образец: .env.example):\n${lines.join('\n')}`,
    );
    process.exit(1);
  }
  return result.data as z.infer<TSchema>;
}
