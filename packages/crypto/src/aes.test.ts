/**
 * Тесты контракта @tax/crypto (план §2, комментарий в FnsCredential):
 * roundtrip, привязка к AAD (защита от пересадки шифртекста), чужой ключ,
 * уникальность nonce, валидация длины ключа, целостность authTag.
 */
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AUTH_TAG_LENGTH,
  DecryptionFailedError,
  InvalidKeyError,
  KEY_LENGTH,
  NONCE_LENGTH,
  decryptField,
  encryptField,
  keyFromEnv,
} from './aes';

const key = randomBytes(KEY_LENGTH);
const aad = 'client_cktest000000000001'; // AAD = clientId по контракту

describe('encryptField / decryptField', () => {
  it('roundtrip: encrypt → decrypt возвращает исходную строку (включая кириллицу)', () => {
    const plaintext = 'логин-фнс@nalog.ру / p@ssw0rd!';
    const { ciphertext, nonce } = encryptField(plaintext, key, aad);

    expect(nonce.length).toBe(NONCE_LENGTH);
    // authTag приклеен в хвост: шифртекст = байты utf8-плейнтекста + 16 байт тега
    expect(ciphertext.length).toBe(Buffer.byteLength(plaintext, 'utf8') + AUTH_TAG_LENGTH);

    expect(decryptField(ciphertext, nonce, key, aad)).toBe(plaintext);
  });

  it('roundtrip пустой строки: шифртекст = только authTag', () => {
    const { ciphertext, nonce } = encryptField('', key, aad);
    expect(ciphertext.length).toBe(AUTH_TAG_LENGTH);
    expect(decryptField(ciphertext, nonce, key, aad)).toBe('');
  });

  it('другой AAD → DecryptionFailedError (пересадка шифртекста в чужую строку невозможна)', () => {
    const { ciphertext, nonce } = encryptField('секрет', key, aad);
    expect(() => decryptField(ciphertext, nonce, key, 'client_ДРУГОЙ')).toThrow(DecryptionFailedError);
  });

  it('другой ключ → DecryptionFailedError', () => {
    const { ciphertext, nonce } = encryptField('секрет', key, aad);
    const wrongKey = randomBytes(KEY_LENGTH);
    expect(() => decryptField(ciphertext, nonce, wrongKey, aad)).toThrow(DecryptionFailedError);
  });

  it('подмена байта шифртекста → DecryptionFailedError (authTag ловит порчу)', () => {
    const { ciphertext, nonce } = encryptField('секрет', key, aad);
    const tampered = Buffer.from(ciphertext);
    tampered[0]! ^= 0xff; // флип бита в теле шифртекста
    expect(() => decryptField(tampered, nonce, key, aad)).toThrow(DecryptionFailedError);
  });

  it('шифртекст короче authTag → DecryptionFailedError, а не сбой node:crypto', () => {
    expect(() => decryptField(Buffer.alloc(AUTH_TAG_LENGTH - 1), randomBytes(NONCE_LENGTH), key, aad)).toThrow(
      DecryptionFailedError,
    );
  });

  it('nonce уникален между двумя вызовами (критично для GCM)', () => {
    const a = encryptField('одно и то же', key, aad);
    const b = encryptField('одно и то же', key, aad);
    expect(a.nonce.equals(b.nonce)).toBe(false);
    // как следствие — и шифртексты различаются при одинаковом входе
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it('ключ неверной длины на encrypt/decrypt → InvalidKeyError', () => {
    const shortKey = randomBytes(16);
    expect(() => encryptField('x', shortKey, aad)).toThrow(InvalidKeyError);
    expect(() => decryptField(Buffer.alloc(32), randomBytes(NONCE_LENGTH), shortKey, aad)).toThrow(InvalidKeyError);
  });
});

describe('keyFromEnv', () => {
  it('валидный base64 от 32 байт → Buffer длиной 32', () => {
    const raw = randomBytes(KEY_LENGTH);
    const decoded = keyFromEnv(raw.toString('base64'));
    expect(decoded.length).toBe(KEY_LENGTH);
    expect(decoded.equals(raw)).toBe(true);
  });

  it('ключ неверной длины → InvalidKeyError', () => {
    expect(() => keyFromEnv(randomBytes(16).toString('base64'))).toThrow(InvalidKeyError); // короткий
    expect(() => keyFromEnv(randomBytes(48).toString('base64'))).toThrow(InvalidKeyError); // длинный
    expect(() => keyFromEnv('')).toThrow(InvalidKeyError); // пустой
    expect(() => keyFromEnv('не base64 вовсе!!!')).toThrow(InvalidKeyError); // мусор
  });
});
