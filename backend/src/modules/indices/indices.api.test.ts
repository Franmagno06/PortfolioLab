import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { buscarSerieDiariaYahoo, buscarUltimoValorYahoo } from "../quotes/quotes.provider.js";
import { buscarSerieSgs } from "./indices.fontes.js";
import { indicesRepository } from "./indices.repository.js";
import { limparCacheDosIndices } from "./indices.service.js";

// Fontes e repository simulados: nada de rede e nada escrito em index_points (o histórico real do IFIX fica intacto).
vi.mock("./indices.fontes.js", () => ({ buscarSerieSgs: vi.fn() }));
vi.mock("../quotes/quotes.provider.js", async (original) => ({
  ...(await original<typeof import("../quotes/quotes.provider.js")>()),
  buscarSerieDiariaYahoo: vi.fn(),
  buscarUltimoValorYahoo: vi.fn(),
}));
vi.mock("./indices.repository.js", () => ({
  indicesRepository: { gravarPonto: vi.fn(), listarPontos: vi.fn() },
}));

const CHAVES = ["atualizadoEm", "hoje", "selicMensal", "ipcaMensal", "cdiMensal", "cdiTaxaMensal", "pontos"];

beforeEach(() => {
  vi.resetAllMocks();
  limparCacheDosIndices();
});

describe("GET /indices/dados", () => {
  it("abre sem cookie e traz as sete chaves do DTO", async () => {
    vi.mocked(buscarSerieSgs).mockResolvedValue([{ data: "2026-01-01", valor: 1 }]);
    vi.mocked(buscarSerieDiariaYahoo).mockResolvedValue([{ data: "2026-01-02", valor: 100 }]);
    vi.mocked(buscarUltimoValorYahoo).mockResolvedValue({ data: "2026-01-02", valor: 10 });
    vi.mocked(indicesRepository.gravarPonto).mockResolvedValue(undefined);
    vi.mocked(indicesRepository.listarPontos).mockResolvedValue([]);

    const res = await request(app).get("/indices/dados");

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([...CHAVES].sort());
    expect(Object.keys(res.body.pontos).sort()).toEqual(["ibovespa", "idiv", "ifix", "smll", "sp500"]);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("com todas as fontes falhando responde 200, nunca 500", async () => {
    vi.mocked(buscarSerieSgs).mockResolvedValue(null);
    vi.mocked(buscarSerieDiariaYahoo).mockResolvedValue(null);
    vi.mocked(buscarUltimoValorYahoo).mockResolvedValue(null);
    vi.mocked(indicesRepository.listarPontos).mockRejectedValue(new Error("banco fora"));

    const res = await request(app).get("/indices/dados");

    expect(res.status).toBe(200);
    expect(res.body.selicMensal).toEqual([]);
    expect(res.body.pontos.ibovespa).toEqual([]);
    expect(res.body.pontos.ifix).toEqual([]);
  });
});
