import Link from "next/link";

/** 404: формулировка «работаем по приглашениям» — закрытость пилота (план §4) */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <h1 className="text-xl font-semibold">Страница не найдена</h1>
      <p className="max-w-md text-sm text-slate-600">
        Мы работаем по приглашениям. Если вам дали ссылку — проверьте, что она
        скопирована целиком, или запросите новую у вашего риэлтора.
      </p>
      <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
        На главную
      </Link>
    </main>
  );
}
