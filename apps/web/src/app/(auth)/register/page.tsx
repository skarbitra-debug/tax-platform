import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Регистрация партнёра" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Регистрация партнёра</h1>
      <p className="mt-1 text-sm text-slate-600">
        Понадобится инвайт-код — его выдаёт ваше агентство.
      </p>
      <RegisterForm />
      <p className="mt-4 text-sm text-slate-600">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
