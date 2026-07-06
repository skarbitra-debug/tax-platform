import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLead } from "@tax/core";
import { DecryptionFailedError, decryptField, encryptField, keyFromEnv } from "@tax/crypto";
import { prisma } from "@tax/db";
import { type TestRealtor, cleanupRealtor, createTestRealtor, leadInput } from "./helpers";

/**
 * Проверка хранилища доступов ФНС (§7) на уровне данных: @tax/crypto + Prisma.
 * Логику apps/web/src/lib/fns.ts (server-only, не импортируется в vitest)
 * воспроизводим здесь тем же контрактом: AES-256-GCM, AAD=clientId.
 */
describe("шифрованное хранилище ФНС (M4, §7)", () => {
  const key = keyFromEnv(Buffer.alloc(32, 7).toString("base64")); // тестовый ключ
  let r: TestRealtor;
  let clientId: string;

  beforeEach(async () => {
    r = await createTestRealtor();
    const res = await createLead(leadInput(r.token), {});
    if (res.ok) {
      const deal = await prisma.deal.findUniqueOrThrow({ where: { id: res.dealId } });
      clientId = deal.clientId;
    }
  });
  afterEach(async () => {
    await cleanupRealtor(r);
  });

  it("логин/пароль шифруются в покое и расшифровываются обратно", async () => {
    const login = encryptField("ivanov_fns", key, clientId);
    const password = encryptField("s3cret", key, clientId);
    await prisma.fnsCredential.create({
      data: {
        clientId,
        loginCiphertext: new Uint8Array(login.ciphertext),
        loginNonce: new Uint8Array(login.nonce),
        passwordCiphertext: new Uint8Array(password.ciphertext),
        passwordNonce: new Uint8Array(password.nonce),
        keyVersion: 1,
      },
    });

    const stored = await prisma.fnsCredential.findUniqueOrThrow({ where: { clientId } });
    // в БД — шифртекст, не открытый текст
    expect(Buffer.from(stored.loginCiphertext).toString("utf8")).not.toContain("ivanov_fns");
    expect(stored.loginNonce.length).toBe(12);

    const gotLogin = decryptField(Buffer.from(stored.loginCiphertext), Buffer.from(stored.loginNonce), key, clientId);
    const gotPass = decryptField(Buffer.from(stored.passwordCiphertext), Buffer.from(stored.passwordNonce), key, clientId);
    expect(gotLogin).toBe("ivanov_fns");
    expect(gotPass).toBe("s3cret");
  });

  it("AAD=clientId: расшифровка с чужим clientId падает", async () => {
    const enc = encryptField("secret-login", key, clientId);
    expect(() => decryptField(enc.ciphertext, enc.nonce, key, "wrong-client-id")).toThrow(
      DecryptionFailedError,
    );
  });

  it("удаление доступов чистит запись", async () => {
    const enc = encryptField("x", key, clientId);
    await prisma.fnsCredential.create({
      data: {
        clientId,
        loginCiphertext: new Uint8Array(enc.ciphertext),
        loginNonce: new Uint8Array(enc.nonce),
        passwordCiphertext: new Uint8Array(enc.ciphertext),
        passwordNonce: new Uint8Array(enc.nonce),
      },
    });
    await prisma.fnsCredential.deleteMany({ where: { clientId } });
    const gone = await prisma.fnsCredential.findUnique({ where: { clientId } });
    expect(gone).toBeNull();
  });
});
