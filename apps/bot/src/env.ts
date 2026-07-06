// Единственная точка доступа к окружению бота (контракт §1: прямой
// process.env в приложениях запрещён). Схемой владеет @tax/config:
// новая переменная появляется сначала в Zod-схеме и .env.example, потом здесь.
// TELEGRAM_CHANNEL_ID в M0 не используется — в botEnvSchema он optional (M0-9).
import { botEnvSchema, loadEnv } from "@tax/config";

// Падает на старте с перечнем недостающих переменных (DoD M0-2) —
// до инициализации grammY и Prisma.
export const env = loadEnv(botEnvSchema);
