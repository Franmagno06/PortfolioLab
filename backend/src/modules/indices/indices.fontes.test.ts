import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarSerieHistoricaB3, buscarSerieSgs } from "./indices.fontes.js";

const json = (corpo: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corpo,
});

afterEach(() => vi.unstubAllGlobals());

const desde = new Date("2011-01-01T12:00:00Z");
const ate = new Date("2026-10-19T12:00:00Z");

describe("buscarSerieSgs", () => {
  it("converte data e valor", async () => {
    const f = vi.fn().mockResolvedValue(json([{ data: "01/09/2026", valor: "0.82" }]));
    vi.stubGlobal("fetch", f);
    const r = await buscarSerieSgs(433, new Date("2026-09-01T12:00:00Z"), ate);
    expect(r).toEqual([{ data: "2026-09-01", valor: 0.82 }]);
    const url = String(f.mock.calls[0]?.[0]);
    expect(url).toContain("bcdata.sgs.433/dados?formato=json&dataInicial=01/09/2026&dataFinal=19/10/2026");
  });
  it("descarta linha com valor inválido", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json([{ data: "01/09/2026", valor: "x" }, { data: "01/10/2026", valor: "1.5" }])));
    expect(await buscarSerieSgs(433, new Date("2026-09-01T12:00:00Z"), ate)).toEqual([{ data: "2026-10-01", valor: 1.5 }]);
  });
  it("descarta linha com valor vazio em vez de virar 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json([{ data: "01/09/2026", valor: "" }, { data: "01/10/2026", valor: "  " }, { data: "01/11/2026", valor: "1.5" }])),
    );
    expect(await buscarSerieSgs(433, new Date("2026-09-01T12:00:00Z"), ate)).toEqual([{ data: "2026-11-01", valor: 1.5 }]);
  });
  it("uma chamada por janela", async () => {
    const f = vi.fn().mockResolvedValue(json([]));
    vi.stubGlobal("fetch", f);
    await buscarSerieSgs(432, desde, ate);
    expect(f).toHaveBeenCalledTimes(4);
  });
  it("status 500 numa janela dá null", async () => {
    const f = vi.fn().mockResolvedValueOnce(json([])).mockResolvedValueOnce(json([], 500)).mockResolvedValueOnce(json([], 500)).mockResolvedValue(json([]));
    vi.stubGlobal("fetch", f);
    expect(await buscarSerieSgs(432, desde, ate)).toBeNull();
  });
  it("tenta de novo uma vez: primeira chamada falha, a segunda acerta", async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValue(json([{ data: "01/09/2026", valor: "0.82" }]));
    vi.stubGlobal("fetch", f);
    expect(await buscarSerieSgs(433, new Date("2026-09-01T12:00:00Z"), ate)).toEqual([{ data: "2026-09-01", valor: 0.82 }]);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("as duas tentativas falhando dá null, sem lançar", async () => {
    const f = vi.fn().mockResolvedValueOnce(json([], 503)).mockRejectedValueOnce(new Error("rede"));
    vi.stubGlobal("fetch", f);
    expect(await buscarSerieSgs(433, new Date("2026-09-01T12:00:00Z"), ate)).toBeNull();
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("fetch rejeitando dá null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));
    expect(await buscarSerieSgs(432, desde, ate)).toBeNull();
  });
  it("resposta que não é lista dá null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ erro: "x" })));
    expect(await buscarSerieSgs(432, new Date("2026-09-01T12:00:00Z"), ate)).toBeNull();
  });
});

describe("buscarSerieHistoricaB3", () => {
  it("decodifica valores pt-BR por mês e ordena por data crescente", async () => {
    const f = vi.fn().mockResolvedValue(
      json({
        results: [
          { day: 15, rateValue1: "3.311,48", rateValue2: "3.350,10" },
          { day: 2, rateValue1: "3.290,00", rateValue2: null },
        ],
      }),
    );
    vi.stubGlobal("fetch", f);

    const r = await buscarSerieHistoricaB3("IFIX", 2024, 2024);

    expect(r).toEqual([
      { data: "2024-01-02", valor: 3290 },
      { data: "2024-01-15", valor: 3311.48 },
      { data: "2024-02-15", valor: 3350.1 },
    ]);
    const payloadEsperado = Buffer.from(JSON.stringify({ index: "IFIX", language: "pt-br", year: "2024" })).toString("base64");
    expect(String(f.mock.calls[0]?.[0])).toContain(`/GetPortfolioDay/${payloadEsperado}`);
  });

  it("ignora valores vazios, inválidos, <= 0 e datas inexistentes no calendário", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        json({
          results: [
            {
              day: 31,
              rateValue1: "3.100,00", // 2024-01-31 existe
              rateValue2: "3.200,00", // 2024-02-31 não existe
              rateValue4: "3.300,00", // 2024-04-31 não existe
              rateValue5: "0,00", // <= 0 ignorado
              rateValue6: "   ", // vazio ignorado
              rateValue7: "abc", // inválido ignorado
            },
          ],
        }),
      ),
    );

    expect(await buscarSerieHistoricaB3("SMLL", 2024, 2024)).toEqual([{ data: "2024-01-31", valor: 3100 }]);
  });

  it("tenta novamente uma vez quando o ano falha na 1ª tentativa", async () => {
    const f = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(json({ results: [{ day: 10, rateValue3: "8.500,25" }] }));
    vi.stubGlobal("fetch", f);

    expect(await buscarSerieHistoricaB3("IDIV", 2025, 2025)).toEqual([{ data: "2025-03-10", valor: 8500.25 }]);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("retorna null se nenhum ponto válido for obtido ao final", async () => {
    const f = vi.fn().mockResolvedValue(json({ results: [] }));
    vi.stubGlobal("fetch", f);

    expect(await buscarSerieHistoricaB3("IFIX", 2024, 2024)).toBeNull();
  });
});
