import { defineConfig } from "vitest/config";

// Интеграционные тесты требуют DATABASE_URL к МИГРИРОВАННОЙ и ЗАСИЖЕННОЙ БД.
// Запускаются отдельным CI-джобом с postgres-сервисом (не в общем no-DB прогоне).
// Последовательно (не параллельно): тесты создают/чистят свои данные в общей БД.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
