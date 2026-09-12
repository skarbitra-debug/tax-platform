import type { DefaultSession } from "next-auth";
// Обязательный импорт субмодуля: без него declare module "next-auth/jwt"
// не применяется (TS сопоставляет augmentation только с импортированным модулем)
import type {} from "next-auth/jwt";

/**
 * Type augmentation Auth.js v5: id/role/realtorId в session.user и JWT.
 * Роли — литеральный union, совпадающий с Prisma-enum UserRole (план §2);
 * не импортируем из @tax/db, чтобы .d.ts не тянул generated-клиент.
 */
type AppRole = "ADMIN" | "REALTOR";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      sessionGeneration?: number;
      role: AppRole;
      /** RealtorProfile.id; у ADMIN — null. Выборки ЛК фильтруют по нему */
      realtorId: string | null;
    } & DefaultSession["user"];
  }

  /** Форма объекта, который возвращает authorize() */
  interface User {
    role: AppRole;
    realtorId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    sessionGeneration?: number;
    role: AppRole;
    realtorId: string | null;
  }
}
