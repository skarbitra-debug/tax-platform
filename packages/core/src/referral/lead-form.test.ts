/**
 * Тесты leadFormSchema (M1-1): валидный кейс, галки literal(true), налог ≥ суммы,
 * границы сумм, нормализация телефона, галочка ПДн, формат токена.
 * Чистая Zod-схема — БД не нужна.
 */
import { describe, expect, it } from "vitest";
import { leadFormSchema } from "./lead-form";

/** Валидная база; тесты переопределяют отдельные поля */
const valid = {
  token: "abcdefgh2345",
  submissionId: "0f1e2d3c-4b5a-4678-9abc-def012345678",
  firstName: "Анна",
  phone: "8 (926) 123-45-67",

  salePriceRub: "5000000",
  taxPaidRub: "300000",
  consentPersonalData: true,
};

/** Пути полей, на которых схема выдала ошибки */
function errorPaths(input: Record<string, unknown>): string[] {
  const result = leadFormSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((i) => i.path.join("."));
}

describe("leadFormSchema — валидный кейс", () => {
  it("парсится; телефон нормализован, суммы — числа", () => {
    const result = leadFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.phone).toBe("+79261234567");
    expect(result.data.salePriceRub).toBe(5_000_000);
    expect(result.data.taxPaidRub).toBe(300_000);
    expect(result.data.consentPersonalData).toBe(true);
    expect(result.data.firstName).toBe("Анна");
  });

  it("сообщения об ошибках — русские (уходят клиенту в UI)", () => {
    const result = leadFormSchema.safeParse({ ...valid, phone: "12345" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toMatch(/[А-Яа-яЁё]/);
  });
});

describe("галки согласий — literal(true), сервер не верит скрытым полям", () => {
  it.each([
    ["consentPersonalData", false],
    ["consentPersonalData", undefined],
    ["consentPersonalData", "on"], // сырое значение чекбокса — не true
  ])("%s = %s → ошибка на этом поле", (field, value) => {
    expect(errorPaths({ ...valid, [field]: value })).toContain(field);
  });
});

describe("соотношение сумм: налог строго меньше суммы продажи", () => {
  it("налог = сумме → ошибка на taxPaidRub", () => {
    expect(errorPaths({ ...valid, salePriceRub: "300000", taxPaidRub: "300000" })).toContain(
      "taxPaidRub",
    );
  });

  it("налог больше суммы → ошибка на taxPaidRub", () => {
    expect(errorPaths({ ...valid, salePriceRub: "300000", taxPaidRub: "400000" })).toContain(
      "taxPaidRub",
    );
  });

  it("налог меньше суммы → ок", () => {
    expect(leadFormSchema.safeParse({ ...valid, taxPaidRub: "4999999" }).success).toBe(true);
  });
});

describe("границы сумм", () => {
  it.each([
    ["salePriceRub", "99999", "ниже 100 000 ₽"],
    ["salePriceRub", "2000000001", "выше 2 млрд"],
    ["salePriceRub", "0", "ноль"],
    ["salePriceRub", "не число", "мусор"],
    ["salePriceRub", "5000000.50", "не целое"],
    ["taxPaidRub", "0", "ноль"],
    ["taxPaidRub", "-1", "отрицательный"],
    ["taxPaidRub", "2000000001", "выше 2 млрд"],
  ])("%s = %s → ошибка (%s)", (field, value) => {
    expect(errorPaths({ ...valid, [field]: value })).toContain(field);
  });

  it("граничные значения включительно: 100 000 и 2 000 000 000 — ок", () => {
    const result = leadFormSchema.safeParse({
      ...valid,
      salePriceRub: "2000000000",
      taxPaidRub: "100000",
    });
    expect(result.success).toBe(true);
  });
});

describe("телефон нормализуется схемой", () => {
  it.each([
    ["+7 926 123-45-67"],
    ["79261234567"],
    ["8(926)1234567"],
  ])("%s → +79261234567", (phone) => {
    const result = leadFormSchema.safeParse({ ...valid, phone });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.phone).toBe("+79261234567");
  });

  it.each([
    ["+380501234567", "иностранный"],
    ["9261234567", "без префикса"],
    ["привет", "мусор"],
    ["", "пусто"],
  ])("%s → ошибка на phone (%s)", (phone) => {
    expect(errorPaths({ ...valid, phone })).toContain("phone");
  });
});

describe("token и submissionId — форматы проверяются до похода в БД", () => {
  it.each([
    ["ABCDEFGH2345", "uppercase"],
    ["abcdefgh234", "короткий"],
    ["abcdefgh234l0", "запрещённые символы и длина"],
    ["", "пустой"],
  ])("token %s → ошибка (%s)", (token) => {
    expect(errorPaths({ ...valid, token })).toContain("token");
  });

  it("submissionId не-uuid → ошибка", () => {
    expect(errorPaths({ ...valid, submissionId: "not-a-uuid" })).toContain("submissionId");
  });
});
