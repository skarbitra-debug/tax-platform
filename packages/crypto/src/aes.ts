/**
 * AES-256-GCM для секретов ФНС (план §2, модель FnsCredential).
 *
 * Формат хранения (контракт с @tax/db):
 *   - ciphertext = шифртекст || authTag(16 байт) — тег приклеен в хвост, отдельной колонки нет;
 *   - nonce = 12 байт, randomBytes на КАЖДЫЙ вызов encryptField (повтор nonce с тем же ключом
 *     фатален для GCM — раскрывает keystream и позволяет подделку тега);
 *   - AAD = clientId: шифртекст криптографически привязан к строке-владельцу,
 *     пересадка Bytes в чужую запись валится на проверке тега.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Длина ключа AES-256 — 32 байта. */
export const KEY_LENGTH = 32;
/** Длина nonce для GCM — 12 байт (рекомендация NIST SP 800-38D, без пересчёта через GHASH). */
export const NONCE_LENGTH = 12;
/** Длина authTag — полные 16 байт, усечение запрещено. */
export const AUTH_TAG_LENGTH = 16;

const ALGORITHM = 'aes-256-gcm';

/**
 * Доменная ошибка расшифровки: подмена шифртекста/тега, чужой AAD, чужой ключ.
 * Наружу не утекают детали node:crypto — вызывающий код ловит один тип.
 */
export class DecryptionFailedError extends Error {
  constructor(message = 'Расшифровка не удалась: повреждённые данные, чужой ключ или чужой AAD') {
    super(message);
    this.name = 'DecryptionFailedError';
  }
}

/** Доменная ошибка ключа: FNS_ENCRYPTION_KEY не base64 от ровно 32 байт. */
export class InvalidKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidKeyError';
  }
}

/** Внутренняя проверка ключа перед созданием шифра — ошибка понятнее, чем из createCipheriv. */
function assertKey(key: Buffer): void {
  if (key.length !== KEY_LENGTH) {
    throw new InvalidKeyError(`Ключ AES-256 должен быть ${KEY_LENGTH} байта, получено ${key.length}`);
  }
}

/**
 * Декодирует FNS_ENCRYPTION_KEY из base64 и проверяет длину.
 * Бросает InvalidKeyError, если после декодирования не ровно 32 байта
 * (ловит и мусорные строки: Buffer.from молча выкидывает не-base64 символы).
 */
export function keyFromEnv(base64: string): Buffer {
  const key = Buffer.from(base64, 'base64');
  if (key.length !== KEY_LENGTH) {
    throw new InvalidKeyError(
      `FNS_ENCRYPTION_KEY: ожидается base64 от ${KEY_LENGTH} байт, декодировано ${key.length}. ` +
        `Сгенерировать: openssl rand -base64 32`,
    );
  }
  return key;
}

/**
 * Шифрует одно поле (логин или пароль ФНС).
 * @param plaintext исходная строка (utf8)
 * @param key       32 байта (из keyFromEnv)
 * @param aad       привязка к владельцу — clientId
 * @returns ciphertext (authTag 16 байт в хвосте) и свежий nonce 12 байт
 */
export function encryptField(
  plaintext: string,
  key: Buffer,
  aad: string,
): { ciphertext: Buffer; nonce: Buffer } {
  assertKey(key);
  // Новый nonce на каждый вызов — уникальность критична (см. шапку файла)
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, nonce, { authTagLength: AUTH_TAG_LENGTH });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(), // тег в хвост — единый Buffer в колонку Bytes
  ]);
  return { ciphertext, nonce };
}

/**
 * Расшифровывает поле: отделяет authTag из хвоста, проверяет целостность и AAD.
 * Любой сбой проверки → DecryptionFailedError (единый доменный тип).
 */
export function decryptField(ciphertext: Buffer, nonce: Buffer, key: Buffer, aad: string): string {
  assertKey(key);
  // Короче одного тега — это заведомо не наш формат, не доходя до крипты
  if (ciphertext.length < AUTH_TAG_LENGTH) {
    throw new DecryptionFailedError('Шифртекст короче authTag — повреждённые данные');
  }
  const data = ciphertext.subarray(0, ciphertext.length - AUTH_TAG_LENGTH);
  const authTag = ciphertext.subarray(ciphertext.length - AUTH_TAG_LENGTH);
  try {
    const decipher = createDecipheriv(ALGORITHM, key, nonce, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    // node:crypto кидает "Unsupported state or unable to authenticate data" — заворачиваем в домен
    throw new DecryptionFailedError();
  }
}
