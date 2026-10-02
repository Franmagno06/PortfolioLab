import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { calcularAporte } from "./rebalance.service.js";

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
