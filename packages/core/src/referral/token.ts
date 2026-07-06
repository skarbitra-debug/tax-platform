import { customAlphabet } from "nanoid";

/**
 * Реф-токен (контракт §1): единственный генератор и валидатор на всю платформу.
 * Алфавит 31 символ — lowercase + цифры БЕЗ визуальных двойников (i/l/o/0/1):
 * токен диктуют голосом и пересылают в мессенджерах, uppercase ломается
 * автозаменой. 31^12 ≈ 60 бит — перебор бессмысленен даже без rate-limit.
 */
export const REFERRAL_TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const REFERRAL_TOKEN_LENGTH = 12;

/** Regex собирается из констант — единый источник правды, рассинхрон невозможен */
export const REFERRAL_TOKEN_REGEX = new RegExp(
  `^[${REFERRAL_TOKEN_ALPHABET}]{${REFERRAL_TOKEN_LENGTH}}$`,
);

// customAlphabet использует crypto.getRandomValues — криптостойкость из коробки
const nanoid = customAlphabet(REFERRAL_TOKEN_ALPHABET, REFERRAL_TOKEN_LENGTH);

/** Новый реф-токен: 12 символов из безопасного алфавита */
export function generateReferralToken(): string {
  return nanoid();
}
