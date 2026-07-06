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
          <Link href="/" className="text-lg font-bold tracking-tight text-white">
            {BRAND.name}
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-white/80 transition hover:text-white"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Стать партнёром
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>© {BRAND.name}. Закрытый пилот — доступ по приглашениям.</span>
          <span>Возврат налогов ведётся в рамках законодательства РФ.</span>
        </div>
      </footer>
    </div>
  );
}
