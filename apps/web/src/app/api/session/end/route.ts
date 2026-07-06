import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Гасит сессию и уводит на /login. Нужен, чтобы разорвать редирект-цикл
 * заблокированного пользователя: requireRole() в layout (RSC) НЕ может
 * очистить куку, а middleware гонит любого с живым JWT с /login «домой».
 * Без сброса токена получалось бы /login → home → requireRole(BLOCKED) →
 * /login → … Этот роут (вне matcher middleware) чистит JWT-куку и отдаёт
 * редирект на /login?error=blocked, где middleware уже видит аноним.
 *
 * Причина в query (?reason=) — только для текста на /login, не для логики.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const reason = url.searchParams.get("reason") === "blocked" ? "blocked" : "signout";

  const store = await cookies();
  // Auth.js v5 Credentials+JWT: имя session-token различается http/https и
  // может быть разбит на чанки (.0/.1). Гасим все известные варианты.
  const names = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.session-token.0",
    "__Secure-authjs.session-token.0",
    "authjs.session-token.1",
    "__Secure-authjs.session-token.1",
  ];
  for (const name of names) {
    if (store.has(name)) store.delete(name);
  }

  const redirectTo = new URL("/login", url);
  if (reason === "blocked") redirectTo.searchParams.set("error", "blocked");
  return NextResponse.redirect(redirectTo, { status: 303 });
}
