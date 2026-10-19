import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarSerieDiariaYahoo, buscarUltimoValorYahoo } from "./quotes.provider.js";

const json = (corpo: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corpo,
});

afterEach(() => vi.unstubAllGlobals());

describe("buscarSerieDiariaYahoo", () => {
  it("usa o símbolo escapado, sem .SA, e descarta close nulo", async () => {
    const f = vi.fn().mockResolvedValue(
      json({
        chart: {
          result: [
            {
              timestamp: [1792332000, 1792418400, 1792504800],
              indicators: { quote: [{ close: [130000, null, 131000.5] }] },
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", f);
    const r = await buscarSerieDiariaYahoo("^BVSP", new Date("2026-10-01T12:00:00Z"));
    const url = String(f.mock.calls[0]?.[0]);
    expect(url).toContain("/%5EBVSP?");
    expect(url).not.toContain(".SA");
    expect(url).toContain("interval=1d");
    expect(r).toHaveLength(2);
    expect(r?.[0]?.valor).toBe(130000);
    expect(r?.[0]?.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("chart.result ausente dá null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ chart: { result: null } })));
    expect(await buscarSerieDiariaYahoo("^BVSP", new Date("2026-10-01T12:00:00Z"))).toBeNull();
  });
  it("status de erro e rede caída dão null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 500)));
    expect(await buscarSerieDiariaYahoo("^BVSP", new Date())).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));
    expect(await buscarSerieDiariaYahoo("^BVSP", new Date())).toBeNull();
  });
});

describe("buscarUltimoValorYahoo", () => {
  it("devolve preço e o dia de São Paulo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        json({ chart: { result: [{ meta: { regularMarketPrice: 3953.42, regularMarketTime: 1792434690 } }] } }),
      ),
    );
    expect(await buscarUltimoValorYahoo("IFIX.SA")).toEqual({ data: "2026-10-19", valor: 3953.42 });
  });
  it("sem preço dá null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ chart: { result: [{ meta: {} }] } })));
    expect(await buscarUltimoValorYahoo("IFIX.SA")).toBeNull();
  });
});
