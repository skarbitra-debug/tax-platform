import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";

/**
 * [M5] Тёмная премиум-обёртка витрины (референс http://78.17.16.24).
 * Тёмный фон включается ТОЛЬКО здесь — рабочие панели (ЛК/админка) остаются
 * светлыми (свой layout). Шапка — стекло поверх тёмного, подвал — приглушённый.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="landing flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="whitespace-nowrap text-base font-bold tracking-tight text-white sm:text-lg">
            {BRAND.name}
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-full px-2.5 py-2 text-sm font-medium text-white/80 transition hover:text-white sm:px-4"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 sm:px-4"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Стать партнёром
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <span>© {BRAND.name}. Закрытый пилот — доступ по приглашениям.</span>
          <span>Возврат налогов ведётся в рамках законодательства РФ.</span>
        </div>
      </footer>
    </div>
  );
}
