import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone — для прод-Docker (COPY .next/standalone), см. план §5.
  // Включается флагом (его ставит apps/web/Dockerfile): на Windows symlink
  // без прав администратора → EPERM на стадии копирования standalone-вывода.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // корень монорепо: без этого file tracing не захватывает workspace-пакеты
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // пакеты @tax/* не собираются (exports -> ./src/index.ts), транспилирует web
  transpilePackages: ["@tax/config", "@tax/core", "@tax/db"],
};

export default nextConfig;
