/** Increment only through a reviewed release; never upgrade an existing token. */
export const CURRENT_SESSION_GENERATION: number = 1;

export function isCurrentSessionGeneration(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value === CURRENT_SESSION_GENERATION;
}

export function isForbiddenSeedIdentity(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  return normalized === "realtor.dev@example.com" || normalized === "admin@example.com";
}
