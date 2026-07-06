import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Вход" };

/** Next 15: searchParams — Promise, обязателен await */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  return (
    <div>
      <h1 className="text-xl font-semibold">Вход для партнёров</h1>
      <p className="mt-1 text-sm text-slate-600">Личный кабинет риэлтора и администратора.</p>
      {error === "blocked" && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Доступ приостановлен. Свяжитесь с администратором платформы.
        </p>
      )}
      <LoginForm callbackUrl={callbackUrl} />
      <p className="mt-4 text-sm text-slate-600">
        Нет аккаунта?{" "}
        <Link href="/register" className="font-medium text-blue-600 hover:underline">
          Зарегистрироваться по инвайт-коду
        </Link>
      </p>
    </div>
  );
}
