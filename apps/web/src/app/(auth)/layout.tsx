import Link from "next/link";
import type { ReactNode } from "react";

/** Центрированная карточка для /login и /register */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6 text-lg font-bold tracking-tight">
        Возврат налогов
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
