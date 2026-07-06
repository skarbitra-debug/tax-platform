/**
 * Тесты генератора реф-токена (M1-1): формат, алфавит, длина, уникальность.
 * Чистая функция — БД не нужна.
 */
import { describe, expect, it } from "vitest";
import {
  REFERRAL_TOKEN_ALPHABET,
  REFERRAL_TOKEN_LENGTH,
  REFERRAL_TOKEN_REGEX,
  generateReferralToken,
} from "./token";

describe("REFERRAL_TOKEN_ALPHABET", () => {
  it("без визуальных двойников (i/l/o/0/1) и без повторов", () => {
    for (const forbidden of ["i", "l", "o", "0", "1"]) {
      expect(REFERRAL_TOKEN_ALPHABET).not.toContain(forbidden);
    }
    expect(new Set(REFERRAL_TOKEN_ALPHABET).size).toBe(REFERRAL_TOKEN_ALPHABET.length);
  });

  it("только lowercase: токен не ломается автозаменой мессенджеров", () => {
    expect(REFERRAL_TOKEN_ALPHABET).toBe(REFERRAL_TOKEN_ALPHABET.toLowerCase());
  });
});

describe("generateReferralToken", () => {
  it("формат: длина 12, все символы из алфавита, проходит REGEX", () => {
    for (let i = 0; i < 100; i++) {
      const token = generateReferralToken();
      expect(token).toHaveLength(REFERRAL_TOKEN_LENGTH);
      expect(token).toMatch(REFERRAL_TOKEN_REGEX);
      for (const ch of token) {
        expect(REFERRAL_TOKEN_ALPHABET).toContain(ch);
      }
    }
  });

  it("уникальность: 1000 генераций без единого повтора", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateReferralToken()));
    expect(tokens.size).toBe(1000);
  });
});

describe("REFERRAL_TOKEN_REGEX", () => {
  it("режет мусор: uppercase, запрещённые символы, неверную длину", () => {
    expect(REFERRAL_TOKEN_REGEX.test("ABCDEFGH2345")).toBe(false); // uppercase
    expect(REFERRAL_TOKEN_REGEX.test("abcdefgh234l")).toBe(false); // 'l' вне алфавита
    expect(REFERRAL_TOKEN_REGEX.test("abcdefgh2340")).toBe(false); // '0' вне алфавита
    expect(REFERRAL_TOKEN_REGEX.test("abcdefgh234")).toBe(false); // 11 символов
    expect(REFERRAL_TOKEN_REGEX.test("abcdefgh23456")).toBe(false); // 13 символов
    expect(REFERRAL_TOKEN_REGEX.test("")).toBe(false);
    expect(REFERRAL_TOKEN_REGEX.test("abcdefgh2345")).toBe(true); // валидный
  });
});
