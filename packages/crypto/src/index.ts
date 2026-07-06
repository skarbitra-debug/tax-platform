/**
 * @tax/crypto — шифрование секретов ФНС (AES-256-GCM, план §2).
 * Потребители: @tax/db (тип колонок Bytes), server actions M4 (FnsCredential).
 */
export {
  encryptField,
  decryptField,
  keyFromEnv,
  DecryptionFailedError,
  InvalidKeyError,
  KEY_LENGTH,
  NONCE_LENGTH,
  AUTH_TAG_LENGTH,
} from './aes';
