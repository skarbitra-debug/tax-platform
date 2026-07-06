import { applyVoiceCommand, buildVoiceContext } from "@tax/core";
import { prisma } from "@tax/db";
import type { Context } from "grammy";
import { env } from "./env";
import { parseVoiceIntent } from "./intent";
import { createStt } from "./stt";

/**
 * Обработчик голосовой команды смены статуса (§4.7).
 * Конвейер: авторизация чата → скачивание OGG → STT → разбор Claude →
 * applyVoiceCommand (двигает статус, source=TELEGRAM_VOICE, пишет
 * VoiceCommandLog). Каждый внешний шаг за сменным адаптером.
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

  if (!env.ANTHROPIC_API_KEY) {
    await ctx.reply("Голосовой ассистент не настроен: нет ключа разбора команд.");
    return;
  }

  const voice = ctx.message?.voice;
  if (!voice) return;

  try {
    await ctx.replyWithChatAction("typing");

    // 1. Скачать OGG голосового
    const file = await ctx.getFile();
    const url = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const oggBytes = new Uint8Array(await (await fetch(url)).arrayBuffer());

    // 2. Речь → текст (STT-адаптер; движок выбирается позже)
    const transcript = await stt.transcribe(oggBytes);

    // 3. Разбор намерения Claude по каталогу реальных сделок/статусов
    const context = await buildVoiceContext();
    const intent = await parseVoiceIntent(transcript, context);

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
