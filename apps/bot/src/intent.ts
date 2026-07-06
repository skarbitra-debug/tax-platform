import type { ParsedVoiceIntent } from "@tax/core";
import { env } from "./env";

/**
 * Разбор намерения из расшифровки голоса через Claude (§4.7). Модель получает
 * каталог реальных сделок и статусов и обязана вернуть номер сделки + код
 * статуса ИЗ КАТАЛОГА (не выдумывать). Вызывается raw fetch'ом к Messages API —
 * без SDK-зависимости.
 *
 * Требует ANTHROPIC_API_KEY. Если ключа нет — бросает (voice.ts ловит и
 * отвечает пользователю «ассистент не настроен»).
 */

export interface VoiceContext {
  deals: { number: number; clientFirstName: string; statusCode: string }[];
  statuses: { code: string; label: string }[];
}

const SYSTEM_PROMPT = `Ты — ассистент налогового консультанта. По короткой русской фразе определи, у какой сделки сменить статус и на какой. Отвечай ТОЛЬКО валидным JSON без пояснений: {"dealNumber": <число или null>, "targetStatusCode": "<код из списка или null>", "note": "<короткая заметка из фразы или null>"}. Номер сделки и код статуса бери СТРОГО из предоставленных списков; если не уверен — ставь null.`;

export async function parseVoiceIntent(
  transcript: string,
  ctx: VoiceContext,
): Promise<ParsedVoiceIntent> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY не задан — голосовой разбор недоступен");
  }

  const userContent = [
    `Фраза: "${transcript}"`,
    ``,
    `Открытые сделки (номер — клиент — текущий статус):`,
    ...ctx.deals.map((d) => `- ${d.number} — ${d.clientFirstName} — ${d.statusCode}`),
    ``,
    `Доступные статусы (код — название):`,
    ...ctx.statuses.map((s) => `- ${s.code} — ${s.label}`),
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.VOICE_LLM_MODEL,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((b) => b.type === "text")?.text ?? "";
  const parsed = extractJson(text);

  return {
    transcript,
    dealNumber: typeof parsed.dealNumber === "number" ? parsed.dealNumber : null,
    targetStatusCode: typeof parsed.targetStatusCode === "string" ? parsed.targetStatusCode : null,
    note: typeof parsed.note === "string" && parsed.note.trim() ? parsed.note.trim() : null,
  };
}

/** Достаём JSON даже если модель обернула его в текст/```json */
function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
}
