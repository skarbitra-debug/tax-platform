// Скелет бота M0-9: grammY + long polling + чтение общей БД через @tax/db.
// ВАЖНО: импорт ./env стоит первым — ESM исполняет модули в порядке объявления,
// значит валидация окружения отрабатывает ДО инициализации @tax/db и grammY.
import { env } from "./env";
import { prisma } from "@tax/db";
import { Bot } from "grammy";
import { isSttConfigured } from "./stt";
import { handleVoice } from "./voice";

const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

// /start — smoke-проверка обоих контуров сразу: Telegram API и общая БД.
bot.command("start", async (ctx) => {
  try {
    // Демо чтения общей БД: сущность Deal (не Lead — контракт §1)
    const dealCount = await prisma.deal.count();
    const voice = isSttConfigured() ? "голосовое управление статусами включено" : "голосовой ассистент в настройке";
    await ctx.reply(`Бот платформы жив. Сделок в базе: ${dealCount}.\n${voice}`);
  } catch (err) {
    // БД лежит — бот всё равно отвечает: long polling живёт независимо от Postgres
    console.error("[bot] prisma.deal.count() недоступен:", err);
    await ctx.reply("Бот платформы жив.");
  }
});

// Голосовая команда смены статуса (§4.7) — только из чата Татьяны
bot.on("message:voice", handleVoice);

/**
 * Привязка чата Татьяны к её User: без записи TelegramAccount(kind=ADMIN)
 * голосовые смены статусов оставались бы в истории без автора
 * (changedById=null). Идемпотентный upsert при старте; админ на пилоте
 * один — берём User с role=ADMIN из seed. Сбой не критичен для поллинга.
 */
async function ensureAdminTelegramAccount(): Promise<void> {
  if (!env.TELEGRAM_ADMIN_CHAT_ID) return;
  try {
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    await prisma.telegramAccount.upsert({
      where: { chatId: BigInt(env.TELEGRAM_ADMIN_CHAT_ID) },
      update: { kind: "ADMIN", userId: admin?.id ?? null, isActive: true },
      create: {
        chatId: BigInt(env.TELEGRAM_ADMIN_CHAT_ID),
        kind: "ADMIN",
        title: "Чат администратора",
        userId: admin?.id ?? null,
      },
    });
  } catch (err) {
    console.error("[bot] не удалось привязать админ-чат к User:", err);
  }
}
void ensureAdminTelegramAccount();

// Ошибка в обработчике апдейта не должна ронять процесс поллинга
bot.catch((err) => {
  console.error(
    `[bot] ошибка при обработке апдейта ${err.ctx.update.update_id}:`,
    err.error,
  );
});

// Long polling: порт и TLS не нужны (план §5), вебхук не используется в пилоте
void bot.start({
  onStart: (me) =>
    console.log(`[bot] @${me.username} запущен (long polling, ${env.NODE_ENV})`),
});
