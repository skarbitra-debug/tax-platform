import "server-only";

import { DecryptionFailedError, decryptField, encryptField, keyFromEnv } from "@tax/crypto";
import { prisma } from "@tax/db";
import { env } from "./env";

/**
 * Хранилище доступов ЛК ФНС (§7 ТЗ): логин/пароль налогоплательщика шифруются
 * AES-256-GCM в покое, ключ (FNS_ENCRYPTION_KEY) живёт ТОЛЬКО в env, не в БД.
 * AAD = clientId привязывает шифртекст к клиенту (нельзя пересадить в чужую строку).
 *
 * Доступ — только ADMIN (проверяется в вызывающих server actions). Каждое
 * ЧТЕНИЕ пишет AuditLog (§7: ограниченный доступ + аудит).
 *
 * "server-only": модуль не попадёт в клиентский бандл (иначе ключ/логика утекли бы).
 */

/** Готово ли хранилище (ключ задан). UI прячет секцию, если нет. */
export function isFnsStorageConfigured(): boolean {
  return Boolean(env().FNS_ENCRYPTION_KEY);
}

function requireKey(): Buffer {
  const raw = env().FNS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("FNS_ENCRYPTION_KEY не задан — хранилище доступов ФНС недоступно");
  }
  return keyFromEnv(raw);
}

/** Есть ли сохранённые доступы у клиента (без расшифровки) */
export async function hasFnsCredential(clientId: string): Promise<boolean> {
  const c = await prisma.fnsCredential.findUnique({ where: { clientId }, select: { id: true } });
  return c !== null;
}

/**
 * Сохранить/обновить доступы ФНС клиента. Логин и пароль шифруются раздельно,
 * каждый со своим свежим nonce (обязательное условие GCM).
 */
/**
 * Buffer<ArrayBufferLike> из @tax/crypto → Uint8Array<ArrayBuffer> для колонки
 * Bytes Prisma. Через new Uint8Array(length)+set: гарантированно ArrayBuffer-
 * backed (не SharedArrayBuffer), иначе @types/node 24 не совпадает по типу.
 */
function toBytes(b: Buffer): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(b.length);
  out.set(b);
  return out;
}

export async function setFnsCredential(args: {
  clientId: string;
  login: string;
  password: string;
  actorUserId: string;
}): Promise<void> {
  const key = requireKey();
  const login = encryptField(args.login, key, args.clientId);
  const password = encryptField(args.password, key, args.clientId);

  const bytes = {
    loginCiphertext: toBytes(login.ciphertext),
    loginNonce: toBytes(login.nonce),
    passwordCiphertext: toBytes(password.ciphertext),
    passwordNonce: toBytes(password.nonce),
  };

  await prisma.fnsCredential.upsert({
    where: { clientId: args.clientId },
    create: { clientId: args.clientId, ...bytes, keyVersion: 1, createdById: args.actorUserId },
    update: bytes,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: args.actorUserId,
      action: "fns.credential.write",
      entityType: "FnsCredential",
      entityId: args.clientId,
    },
  });
}

export type RevealResult =
  | { ok: true; login: string; password: string }
  | { ok: false; reason: "NOT_FOUND" | "DECRYPT_FAILED" };

/**
 * Расшифровать доступы для показа админу. КАЖДЫЙ вызов пишет AuditLog с актором
 * и IP (§7). Секреты уходят в браузер по HTTPS — иначе Татьяна/девочки их не
 * прочитают; это осознанная цель, не утечка.
 */
export async function revealFnsCredential(args: {
  clientId: string;
  actorUserId: string;
  ip?: string | null;
}): Promise<RevealResult> {
  const cred = await prisma.fnsCredential.findUnique({ where: { clientId: args.clientId } });
  if (!cred) return { ok: false, reason: "NOT_FOUND" };

  // Аудит ЧТЕНИЯ пишем до расшифровки — факт доступа фиксируется даже при сбое
  await prisma.auditLog.create({
    data: {
      actorUserId: args.actorUserId,
      action: "fns.credential.read",
      entityType: "FnsCredential",
      entityId: args.clientId,
      ip: args.ip ?? null,
    },
  });

  try {
    const key = requireKey();
    // Prisma отдаёт Bytes как Uint8Array — decryptField ждёт Buffer
    const login = decryptField(
      Buffer.from(cred.loginCiphertext),
      Buffer.from(cred.loginNonce),
      key,
      args.clientId,
    );
    const password = decryptField(
      Buffer.from(cred.passwordCiphertext),
      Buffer.from(cred.passwordNonce),
      key,
      args.clientId,
    );
    return { ok: true, login, password };
  } catch (e) {
    if (e instanceof DecryptionFailedError) return { ok: false, reason: "DECRYPT_FAILED" };
    throw e;
  }
}

/** Удалить доступы (обезличивание/152-ФЗ или ошибочный ввод) */
export async function clearFnsCredential(clientId: string, actorUserId: string): Promise<void> {
  await prisma.fnsCredential.deleteMany({ where: { clientId } });
  await prisma.auditLog.create({
    data: {
      actorUserId,
      action: "fns.credential.clear",
      entityType: "FnsCredential",
      entityId: clientId,
    },
  });
}
