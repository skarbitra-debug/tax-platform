import { defineConfig } from "tsup";

// Сборка бота в один ESM-бандл (план §5: пакеты монорепо не собираются,
// bot бандлит их сам).
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node22",
  clean: true,
  sourcemap: true,
  // Prisma бандлить нельзя: сгенерированный клиент (packages/db/generated/client)
  // тянет нативные биндинги и wasm — остаётся внешним, в прод-образ доезжает
  // через `pnpm deploy` (M0-10). Матчим и сам @prisma/client, и путь генератора.
  external: ["@prisma/client", /generated[\\/]client/],
  // Workspace-пакеты — TS-исходники по контракту §1: втягиваем в бандл целиком.
  noExternal: [/^@tax\//],
});
