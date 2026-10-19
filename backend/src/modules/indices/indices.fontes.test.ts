import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarSerieSgs } from "./indices.fontes.js";

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
