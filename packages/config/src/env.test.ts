import { afterEach, describe, expect, it, vi } from 'vitest';
import { botEnvSchema, loadEnv, webEnvSchema } from './env';

// Общая база (baseSchema) — валидные значения
const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://tax:secret@localhost:5432/tax',
  APP_URL: 'http://localhost:3000',
};

// Валидный web-env целиком
const webValid = {
  ...base,
  AUTH_SECRET: 'a'.repeat(44), // как openssl rand -base64 33
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_INITIAL_PASSWORD: 'change-me-8+',
};

// Валидный bot-env целиком
const botValid = {
  ...base,
  TELEGRAM_BOT_TOKEN: `123456789:${'A'.repeat(35)}`,
};

describe('webEnvSchema', () => {
  it('валидный env проходит, дефолты подставляются', () => {
    const r = webEnvSchema.safeParse(webValid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.AUTH_TRUST_HOST).toBe(true); // default
      expect(r.data.PILOT_NOINDEX).toBe(true); // default: пилот закрыт
      expect(r.data.FNS_ENCRYPTION_KEY).toBeUndefined(); // optional до M4
    }
  });

  it('отсутствие AUTH_SECRET валит схему с указанием ключа', () => {
    const { AUTH_SECRET: _omit, ...rest } = webValid;
    const r = webEnvSchema.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path[0])).toContain('AUTH_SECRET');
    }
  });

  it('FNS_ENCRYPTION_KEY: base64 от 32 байт проходит', () => {
    const key32 = Buffer.alloc(32, 7).toString('base64');
    const r = webEnvSchema.safeParse({ ...webValid, FNS_ENCRYPTION_KEY: key32 });
    expect(r.success).toBe(true);
  });

  it('FNS_ENCRYPTION_KEY: не 32 байта — валит схему', () => {
    const key16 = Buffer.alloc(16, 7).toString('base64'); // 16 байт — мало
    const r = webEnvSchema.safeParse({ ...webValid, FNS_ENCRYPTION_KEY: key16 });
    expect(r.success).toBe(false);
  });

  it('FNS_ENCRYPTION_KEY: мусор вместо base64 — валит схему', () => {
    const r = webEnvSchema.safeParse({
      ...webValid,
      FNS_ENCRYPTION_KEY: '!!!не-base64!!!',
    });
    expect(r.success).toBe(false);
  });

  it('FNS_ENCRYPTION_KEY: пустая строка из .env трактуется как «не задан»', () => {
    const r = webEnvSchema.safeParse({ ...webValid, FNS_ENCRYPTION_KEY: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.FNS_ENCRYPTION_KEY).toBeUndefined();
  });

  it('PILOT_NOINDEX: "0" выключает noindex, "1" включает', () => {
    const off = webEnvSchema.safeParse({ ...webValid, PILOT_NOINDEX: '0' });
    const on = webEnvSchema.safeParse({ ...webValid, PILOT_NOINDEX: '1' });
    expect(off.success && off.data.PILOT_NOINDEX).toBe(false);
    expect(on.success && on.data.PILOT_NOINDEX).toBe(true);
  });

  it('DATABASE_URL без postgresql:// — валит базу', () => {
    const r = webEnvSchema.safeParse({ ...webValid, DATABASE_URL: 'mysql://x' });
    expect(r.success).toBe(false);
  });
});

describe('botEnvSchema', () => {
  it('валидный env с пустым TELEGRAM_CHANNEL_ID проходит (optional до M2)', () => {
    const r = botEnvSchema.safeParse({ ...botValid, TELEGRAM_CHANNEL_ID: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.TELEGRAM_CHANNEL_ID).toBeUndefined();
  });

  it('заданный TELEGRAM_CHANNEL_ID проверяется по формату -100…', () => {
    const ok = botEnvSchema.safeParse({
      ...botValid,
      TELEGRAM_CHANNEL_ID: '-1001234567890',
    });
    const bad = botEnvSchema.safeParse({
      ...botValid,
      TELEGRAM_CHANNEL_ID: '12345',
    });
    expect(ok.success).toBe(true);
    expect(bad.success).toBe(false);
  });

  it('кривой TELEGRAM_BOT_TOKEN валит схему', () => {
    const r = botEnvSchema.safeParse({ ...botValid, TELEGRAM_BOT_TOKEN: 'нет' });
    expect(r.success).toBe(false);
  });
});

describe('loadEnv', () => {
  const OLD_ENV = process.env;

  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  it('возвращает типизированный объект при валидном process.env', () => {
    process.env = { ...webValid } as NodeJS.ProcessEnv;
    const env = loadEnv(webEnvSchema);
    expect(env.ADMIN_EMAIL).toBe('admin@example.com');
    expect(env.PILOT_NOINDEX).toBe(true);
  });

  it('при невалидном env печатает перечень ключей и вызывает process.exit(1)', () => {
    process.env = { ...base } as NodeJS.ProcessEnv; // нет AUTH_SECRET и пр.
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((): never => {
        throw new Error('exit'); // прерываем поток, как это сделал бы exit
      }) as never);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => loadEnv(webEnvSchema)).toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    // в сообщении перечислены недостающие ключи
    const printed = errSpy.mock.calls.flat().join('\n');
    expect(printed).toContain('AUTH_SECRET');
    expect(printed).toContain('ADMIN_EMAIL');
  });
});
