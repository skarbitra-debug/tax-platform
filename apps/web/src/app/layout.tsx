import type { Metadata } from "next";
import type { ReactNode } from "react";
import { env, flagOn } from "@/lib/env";
import "./globals.css";

/**
 * Закрытый пилот: при PILOT_NOINDEX глушим индексацию на всех страницах
 * (план §5, ТЗ §1/§7). Функция, а не const — значение зависит от env.
 */
export function generateMetadata(): Metadata {
  const noindex = flagOn(env().PILOT_NOINDEX);
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
