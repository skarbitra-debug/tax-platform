import { redirect } from "next/navigation";
import { prisma } from "@tax/db";
import { auth } from "@/auth";

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

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, status: true },
  });

  // Удалён или не ACTIVE (BLOCKED/PENDING) → гасим JWT и уводим на /login.
  // НЕ redirect("/login") напрямую: живой токен → middleware вернул бы «домой»
  // → сюда → бесконечный цикл. Route-хендлер вне matcher чистит куку.
  if (!dbUser || dbUser.status !== "ACTIVE") {
    redirect("/api/session/end?reason=blocked");
  }

  // Роль сверяем тоже по БД (свежее токена); не своя зона → домой по роли
  if (dbUser.role !== role) {
    redirect(dbUser.role === "ADMIN" ? "/admin" : "/cabinet");
  }

  return session;
}
