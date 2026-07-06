import { prisma } from "@tax/db";

// Liveness + проверка БД (docker healthcheck, план §3/§5); кэш запрещён
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // SELECT 1 — самый дешёвый способ убедиться, что коннект к Postgres жив
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: true });
  } catch {
    return Response.json({ ok: false, db: false }, { status: 503 });
  }
}
