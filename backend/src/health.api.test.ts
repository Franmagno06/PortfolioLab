import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "./app.js";

// vi.mock sobe para o topo do arquivo, antes de qualquer const — por isso o
// interruptor nasce dentro de vi.hoisted, que sobe junto.
const estado = vi.hoisted(() => ({ bancoFora: false }));

vi.mock("./database/prisma.js", async (importarOriginal) => {
  const real = await importarOriginal<typeof import("./database/prisma.js")>();
  return {
    ...real,
    verificarConexao: async () => {
      if (estado.bancoFora) throw new Error("Can't reach database server");
      await real.verificarConexao();
    },
  };
});

// Achado 24: o Supabase do plano gratuito hiberna depois de ~1 semana parada.
// Antes, /health respondia "ok" mesmo com o banco fora do ar, e a hibernação só
// aparecia como erro na cara do usuário no login. Agora o health check consulta
// o banco, então quem monitora a API descobre primeiro.
describe("GET /health", () => {
  afterEach(() => {
    estado.bancoFora = false;
  });

  it("responde 200 com o banco no ar", async () => {
    const resposta = await request(app).get("/health");

    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({ status: "ok", database: "ok" });
  });

  it("responde 503 quando o banco não responde", async () => {
    estado.bancoFora = true;

    const resposta = await request(app).get("/health");

    expect(resposta.status).toBe(503);
    expect(resposta.body).toMatchObject({ status: "degraded", database: "erro" });
  });
});
