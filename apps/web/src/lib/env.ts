import { webEnvSchema } from "@tax/config";
import type { z } from "zod";

/**
 * Единственная точка доступа к env в @tax/web (контракт §1: владелец имён —
 * @tax/config, прямого process.env в коде приложения нет).
 * process.env передаётся в Zod-парс ровно здесь и больше нигде.
 */
type WebEnv = z.infer<typeof webEnvSchema>;

let cached: WebEnv | undefined;

export function env(): WebEnv {
  if (!cached) {
    // parse (не safeParse): недостающая переменная должна ронять процесс
    // с перечнем ошибок — DoD задачи M0-2
    cached = webEnvSchema.parse(process.env);
  }
  return cached;
}

/**
 * Флаги в .env пишутся как 1/0 (см. PILOT_NOINDEX в .env.example).
 * Хелпер терпим к типу, который вернёт схема (boolean после coerce или строка).
 */
export function flagOn(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}
