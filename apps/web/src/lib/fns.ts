import "server-only";

/** Legacy FNS access is disabled, including reads and removal of stored data. */
export function isFnsStorageConfigured(): boolean {
  return false;
}

export async function hasFnsCredential(_clientId: string): Promise<boolean> {
  return false;
}

export async function setFnsCredential(_args: {
  clientId: string;
  login: string;
  password: string;
  actorUserId: string;
}): Promise<void> {
  throw new Error("FNS_ACCESS_DISABLED");
}

export type RevealResult =
  | { ok: true; login: string; password: string }
  | { ok: false; reason: "NOT_FOUND" | "DECRYPT_FAILED" | "DISABLED" };

export async function revealFnsCredential(_args: {
  clientId: string;
  actorUserId: string;
  ip?: string | null;
}): Promise<RevealResult> {
  return { ok: false, reason: "DISABLED" };
}

export async function clearFnsCredential(_clientId: string, _actorUserId: string): Promise<void> {
  throw new Error("FNS_ACCESS_DISABLED");
}
