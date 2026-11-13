import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { CABECALHO_DO_SEGREDO, criarIpDoVisitante } from "./ip-do-visitante.js";

const SEGREDO = "s".repeat(40);
// visitante → Vercel → Cloudflare → proxy do Render (o socket do teste faz o papel do proxy do Render)
const PELA_VERCEL = "200.1.2.3, 76.76.21.9, 172.70.1.1";

function app(opcoes: { saltos: number; segredo?: string }) {
  const a = express();
  a.use(criarIpDoVisitante(opcoes));
  a.get("/", (req, res) => {
    res.json({ ip: req.ipDoVisitante, segredoVisivel: req.headers[CABECALHO_DO_SEGREDO] ?? null });
  });
  return a;
}

describe("IP do visitante", () => {
  it("com o segredo da Vercel, os 3 saltos valem e sai o visitante", async () => {
    const res = await request(app({ saltos: 3, segredo: SEGREDO }))
      .get("/")
      .set("x-forwarded-for", PELA_VERCEL)
      .set(CABECALHO_DO_SEGREDO, SEGREDO);
    expect(res.body.ip).toBe("200.1.2.3");
  });

  it("chamando o Render direto, sem o segredo: o IP forjado no X-Forwarded-For é ignorado", async () => {
    // o atacante manda "1.2.3.4, 5.6.7.8"; a Cloudflare acrescenta o IP real dele e o Render o da borda
    const res = await request(app({ saltos: 3, segredo: SEGREDO }))
      .get("/")
      .set("x-forwarded-for", "1.2.3.4, 5.6.7.8, 99.99.99.99, 172.70.1.1");
    expect(res.body.ip).toBe("99.99.99.99");
  });

  it("segredo errado vale o mesmo que nenhum", async () => {
    const res = await request(app({ saltos: 3, segredo: SEGREDO }))
      .get("/")
      .set("x-forwarded-for", "1.2.3.4, 99.99.99.99, 172.70.1.1")
      .set(CABECALHO_DO_SEGREDO, "x".repeat(40));
    expect(res.body.ip).toBe("99.99.99.99");
  });

  it("o cabeçalho do segredo não segue adiante na requisição", async () => {
    const res = await request(app({ saltos: 3, segredo: SEGREDO })).get("/").set(CABECALHO_DO_SEGREDO, SEGREDO);
    expect(res.body.segredoVisivel).toBeNull();
  });

  it("sem segredo configurado (desenvolvimento), conta os saltos como o trust proxy do Express", async () => {
    const res = await request(app({ saltos: 1 })).get("/").set("x-forwarded-for", "10.0.0.7");
    expect(res.body.ip).toBe("10.0.0.7");
  });

  it("cadeia mais curta que os saltos: fica no endereço mais distante que há", async () => {
    const res = await request(app({ saltos: 3, segredo: SEGREDO })).get("/").set(CABECALHO_DO_SEGREDO, SEGREDO);
    expect(res.body.ip).toMatch(/127\.0\.0\.1|::1/);
  });
});
