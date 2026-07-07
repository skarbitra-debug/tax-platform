import { applyVoiceCommand, buildVoiceContext, parseVoiceCommand } from "@tax/core";
import { prisma } from "@tax/db";
import type { Context } from "grammy";
import { env } from "./env";
import { createStt, isSttConfigured } from "./stt";

/**
 * Обработчик голосовой команды смены статуса (§4.7).
 * Конвейер: авторизация чата → скачивание OGG → Whisper (STT) → разбор
 * ПРАВИЛАМИ (parseVoiceCommand из @tax/core, без облака/LLM) →
 * applyVoiceCommand (двигает статус, source=TELEGRAM_VOICE, пишет
 * VoiceCommandLog). Всё локально: голос не покидает сервер, ключи не нужны.
 */
const stt = createStt();

/** Русские тексты исходов applyVoiceCommand */
const REASON_RU: Record<string, string> = {
  DEAL_NOT_FOUND: "не нашёл такую сделку",
  STATUS_NOT_FOUND: "не понял, на какой статус переводить",
  NO_INTENT: "не разобрал команду — назовите номер сделки и статус",
  STATUS_UNCHANGED: "сделка уже в этом статусе",
};

export async function handleVoice(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return;

  // Авторизация: голосом статусы двигает ТОЛЬКО Татьяна (§4.7)
  if (!env.TELEGRAM_ADMIN_CHAT_ID || String(chatId) !== env.TELEGRAM_ADMIN_CHAT_ID) {
    await ctx.reply("Голосовое управление доступно только администратору.");
    return;
  }

  // Guard ДО скачивания файла: если STT-движок не готов — честно «в настройке»
  if (!isSttConfigured()) {
    await ctx.reply(
      "Голосовой ассистент в настройке: распознавание речи ещё не подключено. " +
        "Статусы пока меняются в кабинете.",
    );
    return;
  }

  const voice = ctx.message?.voice;
  if (!voice) return;

  try {
    await ctx.replyWithChatAction("typing");

    // 1. Скачать OGG голосового (таймаут: зависший fetch стопорил бы весь поллинг)
    const file = await ctx.getFile();
    const url = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const oggBytes = new Uint8Array(
      await (await fetch(url, { signal: AbortSignal.timeout(15_000) })).arrayBuffer(),
    );

    // 2. Речь → текст (Whisper, локально)
    const transcript = await stt.transcribe(oggBytes);

    // 3. Разбор ПРАВИЛАМИ по каталогу реальных сделок/статусов (без облака)
    const context = await buildVoiceContext();
    const parsed = parseVoiceCommand(transcript, context);
    const intent = { transcript, dealNumber: parsed.dealNumber, targetStatusCode: parsed.targetStatusCode, note: null };

    // 4. Применить (со сквозным логом и трассировкой в истории статусов)
    const actor = await prisma.telegramAccount.findFirst({
      where: { chatId: BigInt(chatId), kind: "ADMIN" },
      select: { id: true, userId: true },
    });
    const result = await applyVoiceCommand(intent, {
      chatId: BigInt(chatId),
      messageId: BigInt(ctx.message?.message_id ?? 0),
      fileId: voice.file_id,
      telegramAccountId: actor?.id ?? null,
      actorUserId: actor?.userId ?? null,
    });

    if (result.ok) {
      await ctx.reply(`✅ Сделка № ${result.dealNumber}: статус → «${result.toStatusLabel}»`);
    } else {
      await ctx.reply(`Не применил: ${REASON_RU[result.reason] ?? result.reason}.\nУслышал: «${intent.transcript}»`);
    }
  } catch (e) {
    console.error("[voice] ошибка обработки:", e);
    await ctx.reply("Не удалось обработать голосовое. Попробуйте ещё раз или смените статус в кабинете.");
  }
}
