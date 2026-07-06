import { describe, expect, it } from "vitest";
import { formatHandoffMessage } from "./format";

const base = {
  number: 42,
  clientFirstName: "Иван",
  clientPhone: "+79990000001",
  clientTelegram: null,
  taxPaidAmount: "455000",
  belowThreshold: false,
};

describe("formatHandoffMessage", () => {
  it("содержит номер, имя, телефон, сумму налога", () => {
    const m = formatHandoffMessage(base);
    // нормализуем неразрывные пробелы toLocaleString (U+00A0/U+202F) в обычные
    const norm = m.replace(/\s/g, " ");
    expect(norm).toContain("№ 42");
    expect(norm).toContain("Иван");
    expect(norm).toContain("+79990000001");
    expect(norm).toContain("455 000 ₽");
  });

  it("НЕ содержит риэлтора/суммы сделки (noname, только клиент)", () => {
    const m = formatHandoffMessage(base);
    expect(m.toLowerCase()).not.toContain("риэлтор");
  });

  it("telegram показывается только если задан", () => {
    expect(formatHandoffMessage(base)).not.toContain("Telegram:");
    expect(formatHandoffMessage({ ...base, clientTelegram: "ivan" })).toContain("Telegram: @ivan");
  });

  it("бейдж «ниже порога» при флаге", () => {
    expect(formatHandoffMessage({ ...base, belowThreshold: true })).toContain("Ниже порога");
  });

  it("экранирует HTML-спецсимволы (защита от инъекции в parse_mode=HTML)", () => {
    const m = formatHandoffMessage({ ...base, clientFirstName: "<b>x</b>&" });
    expect(m).toContain("&lt;b&gt;x&lt;/b&gt;&amp;");
    expect(m).not.toContain("<b>x</b>&");
  });
});
