export const metadata = { title: "Приём заявок" };

/** Static refusal: do not resolve tokens or read customer/commission data. */
export default function ClientReferralPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <h1 className="text-xl font-semibold">Приём заявок временно недоступен.</h1>
    </main>
  );
}
