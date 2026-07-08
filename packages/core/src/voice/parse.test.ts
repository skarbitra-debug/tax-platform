import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "./parse";

// Каталог как из seed (§6): реальные статусы воронки
const ctx = {
  deals: [{ number: 12 }, { number: 5 }, { number: 23 }],
  statuses: [
    { code: "NEW", label: "Новая заявка" },
    { code: "CONTRACT_SENT", label: "Договор отправлен" },
    { code: "IN_PROGRESS", label: "В работе" },
    { code: "CORRECTION_FILED", label: "Уточнёнка подана" },
    { code: "FNS_REVIEW", label: "Проверка ФНС" },
    { code: "MONEY_ON_ENS", label: "Деньги на ЕНС" },
    { code: "CLIENT_PAID", label: "Клиент оплатил" },
    { code: "CLOSED", label: "Закрыта" },
  ],
};

describe("parseVoiceCommand (§4.7, без LLM)", () => {
  it("цифра + статус: «по сделке 12 договор отправлен»", () => {
    const r = parseVoiceCommand("по сделке 12 договор отправлен", ctx);
    expect(r.dealNumber).toBe(12);
    expect(r.targetStatusCode).toBe("CONTRACT_SENT");
  });

  it("реальный вывод Whisper с искажением: «Позделки 12 договор отправлен»", () => {
    const r = parseVoiceCommand("Позделки 12 договор отправлен", ctx);
    expect(r.dealNumber).toBe(12);
    expect(r.targetStatusCode).toBe("CONTRACT_SENT");
  });

  it("числительное словом: «двенадцатая сделка проверка фнс» → 12", () => {
    const r = parseVoiceCommand("двенадцать сделка проверка фнс", ctx);
    expect(r.dealNumber).toBe(12);
    expect(r.targetStatusCode).toBe("FNS_REVIEW");
  });

  it("составное числительное: «двадцать три» → 23", () => {
    const r = parseVoiceCommand("сделка двадцать три деньги на енс", ctx);
    expect(r.dealNumber).toBe(23);
    expect(r.targetStatusCode).toBe("MONEY_ON_ENS");
  });

  it("словоформа статуса: «клиент оплатил» / «оплата от клиента»", () => {
    expect(parseVoiceCommand("сделка 5 клиент оплатил", ctx).targetStatusCode).toBe("CLIENT_PAID");
    expect(parseVoiceCommand("по 5 закрыта", ctx).targetStatusCode).toBe("CLOSED");
  });

  it("предпочитает номер из каталога, если цифр несколько", () => {
    // 99 нет в каталоге, 12 есть — берём 12
    const r = parseVoiceCommand("не 99 а 12 в работе", ctx);
    expect(r.dealNumber).toBe(12);
    expect(r.targetStatusCode).toBe("IN_PROGRESS");
  });

  it("нет статуса в фразе → targetStatusCode null", () => {
    const r = parseVoiceCommand("по сделке 12 что там", ctx);
    expect(r.dealNumber).toBe(12);
    expect(r.targetStatusCode).toBeNull();
  });

  it("мусор → оба null", () => {
    const r = parseVoiceCommand("привет как дела", ctx);
    expect(r.dealNumber).toBeNull();
    expect(r.targetStatusCode).toBeNull();
  });

  it("служебное слово НЕ включает статус: «по этому клиенту 12 такие-то обновления» (ТЗ §4.7)", () => {
    // «клиенту» ≠ команда «Клиент оплатил»: без слова «оплатил» статус не матчится
    const r = parseVoiceCommand("по этому клиенту 12 такие-то обновления", ctx);
    expect(r.dealNumber).toBe(12);
    expect(r.targetStatusCode).toBeNull();
  });

  it("«сделка 5 новый договор» не путает «Новая заявка» с «Договор отправлен»", () => {
    // по одному слову от каждого двухсловного статуса — ни один не набирает >1/2
    const r = parseVoiceCommand("сделка 5 новый договор", ctx);
    expect(r.targetStatusCode).toBeNull();
  });

  it("не путает «Проверка ФНС» и «Новая заявка» по одному общему слову", () => {
    // «заявка» есть только в NEW — должен выбрать NEW, не другой
    expect(parseVoiceCommand("сделка 5 новая заявка", ctx).targetStatusCode).toBe("NEW");
  });
});
