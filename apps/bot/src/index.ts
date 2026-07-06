// Скелет бота M0-9: grammY + long polling + чтение общей БД через @tax/db.
// ВАЖНО: импорт ./env стоит первым — ESM исполняет модули в порядке объявления,
// значит валидация окружения отрабатывает ДО инициализации @tax/db и grammY.
import { env } from "./env";
import { prisma } from "@tax/db";
import { Bot } from "grammy";

const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

// /start — smoke-проверка обоих контуров сразу: Telegram API и общая БД.
bot.command("start", async (ctx) => {
  try {
    // Демо чтения общей БД: сущность Deal (не Lead — контракт §1)
    const dealCount = await prisma.deal.count();
    await ctx.reply(`Бот платформы жив. Сделок в базе: ${dealCount}`);
  } catch (err) {
    // БД лежит — бот всё равно отвечает: long polling живёт независимо от Postgres
    console.error("[bot] prisma.deal.count() недоступен:", err);
    await ctx.reply("Бот платформы жив.");
  }
});

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
