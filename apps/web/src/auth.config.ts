import type { NextAuthConfig } from "next-auth";
import { CURRENT_SESSION_GENERATION, isCurrentSessionGeneration, isForbiddenSeedIdentity } from "@/lib/session-policy";

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
    /** Only a successful Credentials sign-in can issue a new generation. */
    jwt({ token, user, account, trigger }) {
      if (trigger === "signIn" && user && account?.provider === "credentials") {
        if (
          typeof user.id !== "string" || !user.id.trim() ||
          (user.role !== "ADMIN" && user.role !== "REALTOR") ||
          isForbiddenSeedIdentity(user.email)
        ) return null;
        token.id = user.id;
        token.role = user.role;
        token.realtorId = user.realtorId ?? null;
        token.sessionGeneration = CURRENT_SESSION_GENERATION;
      }
      // Ignore all client update/session payloads; revoked tokens stay revoked.
      if (!isCurrentSessionGeneration(token.sessionGeneration) || isForbiddenSeedIdentity(token.email)) return null;
      return token;
    },
    /** Переносим кастомные поля токена в session.user (тип — src/types/next-auth.d.ts) */
    session({ session, token }) {
      session.user.sessionGeneration = isCurrentSessionGeneration(token.sessionGeneration)
        ? token.sessionGeneration : undefined;
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
