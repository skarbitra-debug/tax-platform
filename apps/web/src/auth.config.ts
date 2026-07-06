import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe часть конфига Auth.js v5 (грабля: middleware исполняется в edge-runtime,
 * куда нельзя тянуть @node-rs/argon2 и Prisma). Провайдеры с Node-зависимостями
 * добавляет ТОЛЬКО auth.ts; middleware импортирует только этот файл.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  // Credentials в v5 работает только с JWT; таблиц Account/Session нет (план §1)
  session: { strategy: "jwt" },
  providers: [], // заполняет auth.ts (Node runtime)
  callbacks: {
    /**
     * При логине authorize() возвращает {id, role, realtorId, ...} —
     * кладём их в токен один раз; дальше токен самодостаточен.
     * Мгновенная блокировка BLOCKED решается НЕ здесь, а сверкой
     * User.status по БД в requireRole() (план §1, §3).
     */
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? token.sub ?? "";
        token.role = user.role;
        token.realtorId = user.realtorId ?? null;
      }
      return token;
    },
    /** Переносим кастомные поля токена в session.user (тип — src/types/next-auth.d.ts) */
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.realtorId = token.realtorId;
      return session;
    },
    /**
     * Всегда true: матрица редиректов (аноним/роль/страницы auth) реализована
     * в middleware.ts руками — там полный контроль над callbackUrl и ролями.
     */
    authorized() {
      return true;
    },
  },
} satisfies NextAuthConfig;
