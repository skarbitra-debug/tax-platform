export const metadata = { title: "Возврат налога" };

/**
 * [M1] ЕДИНСТВЕННАЯ клиентская страница: объяснялка + анкета одним экраном
 * (токен живёт в URL — переходы теряют его в Telegram-WebView, план §1).
 * M0-заглушка: токен не валидируем и в разметку не выводим; SSR-валидация
 * формата (regex из @tax/core/referral) и 404 на мусор — задача M1-4.
 */
export default async function ClientReferralPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await params; // Next 15: params — Promise; токен понадобится в M1-4

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          Приглашение от вашего риэлтора
        </p>
        <h1 className="text-xl font-semibold">Возврат налога за прошлые годы</h1>
        <p className="mt-3 text-sm text-slate-600">
          Здесь появится страница для клиента: короткое объяснение условий и
          анкета из двух сумм и двух согласий (M1).
        </p>
        <p className="mt-3 text-xs text-slate-400">
          Страница в разработке — вернитесь по этой же ссылке чуть позже.
        </p>
      </div>
    </main>
  );
}
