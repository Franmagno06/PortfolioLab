import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { calcularAporte, rebalanceService } from "./rebalance.service.js";

// O desafio da página inicial. Rota pública e sem banco: nenhum teste aqui
// cria usuário nem toca na DATABASE_URL — o app só é importado para as rotas.

const carteira = [
  { ticker: "MXRF11", nome: "Maxi Renda", preco: 10, quantidade: 100, meta: 50 },
  { ticker: "BBAS3", nome: "Banco do Brasil", preco: 25, quantidade: 60, meta: 50 },
];

describe("POST /rebalance/exemplo", () => {
  it("responde sem login", async () => {
    const res = await request(app).post("/rebalance/exemplo").send({ amount: 500, ativos: carteira });

    expect(res.status).toBe(200);
  });

  it("devolve o mesmo resultado do algoritmo real para a mesma carteira", async () => {
    const res = await request(app).post("/rebalance/exemplo").send({ amount: 500, ativos: carteira });

    // patrimônio 100×10 + 60×25 = 2.500; MXRF11 vale 1.000 e BBAS3 1.500
    const esperado = calcularAporte(
      [
        { ticker: "MXRF11", name: "Maxi Renda", precoAtual: 10, valorAtual: 1000, alvoPct: 50 },
        { ticker: "BBAS3", name: "Banco do Brasil", precoAtual: 25, valorAtual: 1500, alvoPct: 50 },
      ],
      500,
      2500,
    );
    expect(res.body.compras).toEqual(esperado.compras);
    expect(res.body.alocacao).toEqual(esperado.alocacao);
  });

  it("manda o aporte para quem está abaixo da meta", async () => {
    const res = await request(app).post("/rebalance/exemplo").send({ amount: 500, ativos: carteira });

    // meta de 1.500 cada (50% de 3.000): MXRF11 tem déficit de 500, BBAS3 de 0
    expect(res.body.compras).toEqual([
      expect.objectContaining({ ticker: "MXRF11", quantidade: 50, total: 500 }),
    ]);
  });

  it("recusa metas somando mais de 100%", async () => {
    const res = await request(app)
      .post("/rebalance/exemplo")
      .send({ amount: 500, ativos: carteira.map((a) => ({ ...a, meta: 60 })) });

    expect(res.status).toBe(400);
  });

  it("recusa carteira grande demais e valor absurdo", async () => {
    const treze = Array.from({ length: 13 }, (_, i) => ({ ...carteira[0], ticker: `ABCD${i}`, meta: 1 }));

    expect((await request(app).post("/rebalance/exemplo").send({ amount: 500, ativos: treze })).status).toBe(400);
    expect(
      (await request(app).post("/rebalance/exemplo").send({ amount: 1e9, ativos: carteira })).status,
    ).toBe(400);
  });

  it("recusa preço com mais de duas casas, que forçaria arredondar no meio da conta", async () => {
    const res = await request(app)
      .post("/rebalance/exemplo")
      .send({ amount: 500, ativos: [{ ...carteira[0], preco: 9.085 }, carteira[1]] });

    expect(res.status).toBe(400);
  });

  it("aceita preço com centavos que o float não representa exato (9,08)", async () => {
    const res = await request(app)
      .post("/rebalance/exemplo")
      .send({ amount: 500, ativos: [{ ...carteira[0], preco: 9.08 }, carteira[1]] });

    expect(res.status).toBe(200);
  });

  it("a simulação real continua exigindo login", async () => {
    const res = await request(app).post("/rebalance/simulate").send({ amount: 500 });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Os números impressos na página inicial (frontend/src/lib/carteira-exemplo.ts).
// Se um destes testes quebrar, a página está mostrando uma conta que o
// algoritmo não faz mais: atualize COMPRAS_DE_OUTUBRO e o E2E junto.
// ---------------------------------------------------------------------------

const CARTEIRA_DE_SETEMBRO = [
  { ticker: "MXRF11", nome: "Maxi Renda", preco: 9.08, quantidade: 400, meta: 20 },
  { ticker: "HGLG11", nome: "CSHG Logística", preco: 147.6, quantidade: 10, meta: 20 },
  { ticker: "BBAS3", nome: "Banco do Brasil", preco: 23.6, quantidade: 100, meta: 15 },
  { ticker: "TAEE11", nome: "Taesa", preco: 42.74, quantidade: 20, meta: 15 },
  { ticker: "BOVA11", nome: "ETF do Ibovespa", preco: 187.58, quantidade: 10, meta: 15 },
  { ticker: "IVVB11", nome: "ETF do S&P 500", preco: 455.12, quantidade: 2, meta: 15 },
];

describe("carteira de exemplo da página inicial", () => {
  it("outubro: a folha do topo da página inicial", () => {
    const r = rebalanceService.simularExemplo({ amount: 1000, ativos: CARTEIRA_DE_SETEMBRO });

    expect(r.compras.map((c) => [c.ticker, c.quantidade, c.total])).toEqual([
      ["TAEE11", 16, 683.84],
      ["HGLG11", 2, 295.2],
    ]);
    expect(r.restante).toBe(20.96);
    expect(r.ignorados.map((i) => i.ticker)).toEqual(["IVVB11"]);
  });

  it("novembro: a resposta do desafio, depois das compras de outubro", () => {
    const comprasDeOutubro: Record<string, number> = { TAEE11: 16, HGLG11: 2 };
    const novembro = CARTEIRA_DE_SETEMBRO.map((a) => ({
      ...a,
      quantidade: a.quantidade + (comprasDeOutubro[a.ticker] ?? 0),
    }));

    const r = rebalanceService.simularExemplo({ amount: 1000, ativos: novembro });

    expect(r.compras.map((c) => [c.ticker, c.quantidade, c.total])).toEqual([
      ["IVVB11", 1, 455.12],
      ["HGLG11", 2, 295.2],
      ["TAEE11", 5, 213.7],
    ]);
    expect(r.restante).toBe(35.98);
    expect(r.ignorados.map((i) => i.ticker)).toEqual(["BOVA11"]);
  });
});
