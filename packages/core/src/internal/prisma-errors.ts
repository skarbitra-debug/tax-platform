/**
 * P2002 (unique violation) без импорта Prisma-namespace — тот же приём,
 * что в apps/web/src/actions/auth.actions.ts: меньше стыковок с generated-клиентом.
 * Внутренний помощник core, из index.ts не реэкспортируется.
 */
export function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}
