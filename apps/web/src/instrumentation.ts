/**
 * Валидация env при старте сервера (Next instrumentation hook).
 * Падает с перечнем недостающих/битых переменных — DoD M0-2/M0-6.
 */
export async function register() {
  // NEXT_RUNTIME — служебная переменная самого Next, не часть env-контракта
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { webEnvSchema } = await import("@tax/config");
    const parsed = webEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const lines = parsed.error.issues.map(
        (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
      );
      console.error(`[env] Невалидное окружение @tax/web:\n${lines.join("\n")}`);
      throw new Error("Env-валидация не пройдена — см. перечень выше и .env.example");
    }
  }
}
