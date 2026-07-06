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

/** apps/web: Auth.js + seed админа + пилотные флаги. */
export const webEnvSchema = baseSchema.extend({
  // секрет подписи JWT (Credentials-стратегия, таблиц сессий нет — план §1)
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET короче 32 символов (openssl rand -base64 33)'),
  // за reverse-proxy (Caddy) хосту доверяем всегда
  AUTH_TRUST_HOST: z.coerce.boolean().default(true),
  // только для идемпотентного seed Татьяны; пароль потом меняется в ЛК
  ADMIN_EMAIL: z.string().email('ADMIN_EMAIL должен быть валидным email'),
  ADMIN_INITIAL_PASSWORD: z.string().min(8, 'ADMIN_INITIAL_PASSWORD минимум 8 символов'),
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
});

export type BaseEnv = z.infer<typeof baseSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
export type BotEnv = z.infer<typeof botEnvSchema>;

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
