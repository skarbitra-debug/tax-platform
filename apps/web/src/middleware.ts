import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { isCurrentSessionGeneration, isForbiddenSeedIdentity } from "@/lib/session-policy";

/**
 * 1-й слой защиты: JWT-guard в edge-runtime.
 * КРИТИЧНО: импортируем ТОЛЬКО auth.config.ts (без Credentials/argon2/Prisma) —
 * иначе Next пытается забандлить Node-зависимости в edge и падает.
 * 2-й слой (сверка User.status по БД) — requireRole() в layouts/actions.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const user = req.auth?.user;
  const isLoggedIn = !!user && isCurrentSessionGeneration(user.sessionGeneration) &&
    !isForbiddenSeedIdentity(user.email);

  const onCabinet = path.startsWith("/cabinet");
  const onAdmin = path.startsWith("/admin");
  const onAuthPage = path === "/login" || path === "/register";

  // Аноним на защищённом → /login с возвратом на исходный URL
  if (!isLoggedIn && (onCabinet || onAdmin)) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", path + nextUrl.search);
    return Response.redirect(loginUrl);
  }

  if (isLoggedIn) {
    const home = user.role === "ADMIN" ? "/admin" : "/cabinet";
    // Залогиненный на /login|/register → домой по роли
    if (onAuthPage) return Response.redirect(new URL(home, nextUrl));
    // REALTOR на /admin → /cabinet
    if (onAdmin && user.role !== "ADMIN") {
      return Response.redirect(new URL("/cabinet", nextUrl));
    }
    // ADMIN на /cabinet → /admin
    if (onCabinet && user.role !== "REALTOR") {
      return Response.redirect(new URL("/admin", nextUrl));
    }
  }

  return undefined; // пропускаем дальше
});

// Матрица покрывает ровно эти маршруты (план §3); /r/[token] публичен
export const config = {
  matcher: ["/cabinet/:path*", "/admin/:path*", "/login", "/register"],
};
