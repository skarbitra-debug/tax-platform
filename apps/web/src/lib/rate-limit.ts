/**
 * In-memory sliding-window rate-limit.
 *
 * ОДНОПРОЦЕССНЫЙ ПИЛОТ: окно живёт в памяти инстанса Next (standalone,
 * один процесс за Caddy) — для пилота этого достаточно. При масштабировании
 * на несколько процессов/реплик → Redis (sorted set / INCR+EXPIRE),
 * сигнатура checkRateLimit при этом не меняется.
 */

const hits = new Map<string, number[]>();

// Ленивая уборка протухших ключей: без неё перебор токенов с многих IP
// растил бы Map бесконечно. Раз в SWEEP_EVERY вызовов пробегаем всю Map;
// MAX_WINDOW_MS — самое широкое окно, которое кто-либо вправе запросить.
const SWEEP_EVERY = 2_000;
const MAX_WINDOW_MS = 10 * 60_000;
let callsUntilSweep = SWEEP_EVERY;

function sweep(now: number): void {
  for (const [key, stamps] of hits) {
    const alive = stamps.filter((t) => now - t < MAX_WINDOW_MS);
    if (alive.length === 0) hits.delete(key);
    else hits.set(key, alive);
  }
}

/**
 * Зафиксировать попытку и ответить, пропущена ли она.
 * true — в пределах лимита, false — лимит исчерпан.
 *
 * Отклонённые попытки тоже записываются: непрерывный долбёж продлевает
 * блокировку (окно скользящее), но хранение на ключ ограничено limit+1
 * свежими метками — атака на один ключ память не раздувает.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (--callsUntilSweep <= 0) {
    callsUntilSweep = SWEEP_EVERY;
    sweep(now);
  }

  const windowStart = now - windowMs;
  const fresh = (hits.get(key) ?? []).filter((t) => t > windowStart);
  fresh.push(now);
  const bounded = fresh.length > limit + 1 ? fresh.slice(fresh.length - (limit + 1)) : fresh;
  hits.set(key, bounded);
  return bounded.length <= limit;
}

/**
 * Проверка БЕЗ записи попытки. Нужна странице /r/[token]: «этот IP уже выбрал
 * лимит промахов?» спрашивается ДО запроса к БД — анти-перебор реально
 * экономит SELECT'ы, а легитимные открытия валидных ссылок бюджет не тратят
 * (в счётчик попадают только промахи — см. page.tsx).
 */
export function isOverLimit(key: string, limit: number, windowMs: number): boolean {
  const windowStart = Date.now() - windowMs;
  const fresh = (hits.get(key) ?? []).filter((t) => t > windowStart);
  return fresh.length >= limit;
}
