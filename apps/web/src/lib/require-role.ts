import { redirect } from "next/navigation";
import { prisma } from "@tax/db";
import { auth } from "@/auth";
import { isCurrentSessionGeneration, isForbiddenSeedIdentity } from "./session-policy";

type AppRole = "ADMIN" | "REALTOR";

/**
 * 2-й слой защиты (план §1, §3): JWT живёт до 30 дней, поэтому роль/статус
 * из токена недостаточны. Сверяем User.status по БД для ОБЕИХ ролей —
 * BLOCKED с живым JWT получает отказ немедленно. Один SELECT по PK —
 * на пилоте бесплатно.
 *
 * Вызывается в каждом защищённом layout и КАЖДОМ server action.
 * Возвращает session — вызывающий код берёт realtorId/имя из неё.
 */
export async function requireRole(role: AppRole) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!isCurrentSessionGeneration(session.user.sessionGeneration)) {
    redirect("/api/session/end?reason=blocked");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, status: true, email: true, realtorProfile: { select: { id: true } } },
  });

  // Удалён или не ACTIVE (BLOCKED/PENDING) → гасим JWT и уводим на /login.
  // НЕ redirect("/login") напрямую: живой токен → middleware вернул бы «домой»
  // → сюда → бесконечный цикл. Route-хендлер вне matcher чистит куку.
  if (!dbUser || dbUser.status !== "ACTIVE" || isForbiddenSeedIdentity(dbUser.email)) {
    redirect("/api/session/end?reason=blocked");
  }

  const realtorId = dbUser.realtorProfile?.id ?? null;
  if (
    dbUser.role !== session.user.role || realtorId !== session.user.realtorId ||
    (dbUser.role === "REALTOR" && !realtorId)
  ) {
    redirect("/api/session/end?reason=blocked");
  }

  // Роль сверяем тоже по БД (свежее токена); не своя зона → домой по роли
  if (dbUser.role !== role) {
    redirect(dbUser.role === "ADMIN" ? "/admin" : "/cabinet");
  }

  return { ...session, user: { ...session.user, role: dbUser.role, realtorId } };
}
