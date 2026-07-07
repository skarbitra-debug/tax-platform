/**
 * Разбор голосовой команды смены статуса ПРАВИЛАМИ (§4.7), без облака/LLM.
 * Полностью локально и бесплатно: Whisper даёт текст, тут — текст → намерение.
 *
 * Две задачи:
 *  1. номер сделки: цифры (Whisper обычно выдаёт «12») + русские числительные
 *     («двенадцать»); из кандидатов берём тот, что есть в каталоге открытых сделок;
 *  2. целевой статус: сопоставляем слова фразы с названиями статусов (fuzzy —
 *     по общему префиксу, чтобы переживать словоформы и лёгкое искажение Whisper).
 *
 * Чистая функция: без БД и сети — юнит-тестируется (в т.ч. в CI).
 */

export interface VoiceParseContext {
  deals: { number: number }[];
  statuses: { code: string; label: string }[];
}

export interface VoiceParseResult {
  dealNumber: number | null;
  targetStatusCode: string | null;
}

/** lowercase, ё→е, только буквы/цифры/пробел */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// --- русские числительные ---
const UNITS: Record<string, number> = {
  ноль: 0, один: 1, одна: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4,
  пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9,
};
const TEENS: Record<string, number> = {
  десять: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14,
  пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19,
};
const TENS: Record<string, number> = {
  двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50,
  шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90,
};
const HUNDREDS: Record<string, number> = {
  сто: 100, двести: 200, триста: 300, четыреста: 400, пятьсот: 500,
  шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900,
};

/** Русские числительные-слова из последовательности токенов → числа (суммируем в пределах прогона). */
function wordNumbers(tokens: string[]): number[] {
  const out: number[] = [];
  let acc = 0;
  let inRun = false;
  const flush = () => {
    if (inRun) out.push(acc);
    acc = 0;
    inRun = false;
  };
  for (const t of tokens) {
    const part = HUNDREDS[t] ?? TENS[t] ?? TEENS[t] ?? UNITS[t];
    if (part !== undefined) {
      acc += part;
      inRun = true;
    } else {
      flush();
    }
  }
  flush();
  return out;
}

/** Совпадение слов по общему префиксу (переживает словоформы: отправлен/отправила) */
function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min < 4) return false;
  let p = 0;
  while (p < min && a[p] === b[p]) p++;
  return p >= 4;
}

export function parseVoiceCommand(transcript: string, ctx: VoiceParseContext): VoiceParseResult {
  const norm = normalize(transcript);
  const tokens = norm.split(" ").filter(Boolean);

  // --- номер сделки ---
  const digitNums = (norm.match(/\d+/g) ?? []).map(Number);
  const candidates = [...digitNums, ...wordNumbers(tokens)];
  const inCatalog = candidates.find((n) => ctx.deals.some((d) => d.number === n));
  const dealNumber = inCatalog ?? candidates[0] ?? null;

  // --- статус: лучший по доле совпавших слов названия ---
  let best: { code: string; score: number; matched: number } | null = null;
  for (const st of ctx.statuses) {
    const labelTokens = normalize(st.label).split(" ").filter((w) => w.length >= 3);
    if (labelTokens.length === 0) continue;
    let matched = 0;
    for (const lt of labelTokens) {
      if (tokens.some((t) => tokenMatch(lt, t))) matched++;
    }
    const score = matched / labelTokens.length;
    if (matched > 0 && (best === null || score > best.score || (score === best.score && matched > best.matched))) {
      best = { code: st.code, score, matched };
    }
  }
  // требуем, чтобы совпала хотя бы половина слов названия — иначе не уверены
  const targetStatusCode = best && best.score >= 0.5 ? best.code : null;

  return { dealNumber, targetStatusCode };
}
