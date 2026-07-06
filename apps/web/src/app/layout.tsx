import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pilotNoindexFromEnv } from "@tax/config";
import "./globals.css";

/**
 * Закрытый пилот: при PILOT_NOINDEX глушим индексацию на всех страницах
 * (план §5, ТЗ §1/§7). Читаем флаг build-safe (без полного парса env) —
 * generateMetadata выполняется и на пререндере статических страниц, где
 * секретов ещё нет. Полная валидация env — в instrumentation.ts (рантайм).
 */
export function generateMetadata(): Metadata {
  const noindex = pilotNoindexFromEnv();
  return {
    title: {
      default: "Возврат налогов — партнёрская платформа",
      template: "%s — Возврат налогов",
    },
    description: "Закрытая платформа возврата налогов прошлых лет для партнёров-риэлторов.",
    ...(noindex
      ? { robots: { index: false, follow: false, nocache: true } }
      : {}),
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
