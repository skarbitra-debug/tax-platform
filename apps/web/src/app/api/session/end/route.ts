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
  // Exact cookie names only: any numeric chunk, no lookalike/CSRF cookies.
  for (const { name } of store.getAll()) {
    if (/^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/.test(name)) {
      // Browsers reject __Secure- Set-Cookie headers without Secure, including
      // expirations. Name-only delete() loses that attribute and leaves chunks.
      store.set(name, "", { expires: new Date(0), path: "/", secure: name.startsWith("__Secure-") });
    }
  }

  const redirectTo = new URL("/login", url);
  if (reason === "blocked") redirectTo.searchParams.set("error", "blocked");
  return NextResponse.redirect(redirectTo, { status: 303 });
}
