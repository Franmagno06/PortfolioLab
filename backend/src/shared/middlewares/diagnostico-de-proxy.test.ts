import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { criarDiagnosticoDeProxy } from "./diagnostico-de-proxy.js";

describe("diagnóstico do X-Forwarded-For", () => {
  function app(linhas: string[]) {
    const a = express();
    a.use(criarDiagnosticoDeProxy(3, (l) => linhas.push(l)));
    a.get("/", (_req, res) => {
      res.json({});
    });
    return a;
  }

  it("registra a contagem uma vez por formato, sem nenhum IP", async () => {
    const linhas: string[] = [];
    const a = app(linhas);
    await request(a).get("/").set("x-forwarded-for", "200.1.2.3, 76.76.21.9, 172.70.1.1");
    await request(a).get("/").set("x-forwarded-for", "201.9.9.9, 76.76.21.9, 172.70.1.1");
    await request(a).get("/");

    expect(linhas).toEqual([
      "[proxy] X-Forwarded-For com 3 endereço(s); TRUST_PROXY=3",
      "[proxy] X-Forwarded-For com 0 endereço(s); TRUST_PROXY=3",
    ]);
    expect(linhas.join(" ")).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });
});

describe("TRUST_PROXY=3 na cadeia de produção", () => {
  // visitante → Vercel (sobrescreve o XFF com o visitante) → Cloudflare (acrescenta a Vercel) →
  // proxy do Render (acrescenta a Cloudflare; o socket é ele). Ver .env.example.
  function app(trust: number) {
    const a = express();
    a.set("trust proxy", trust);
    a.get("/", (req, res) => {
      res.json({ ip: req.ip });
    });
    return a;
  }
  const PELA_VERCEL = "200.1.2.3, 76.76.21.9, 172.70.1.1";

  it("com 3, req.ip é o visitante", async () => {
    const res = await request(app(3)).get("/").set("x-forwarded-for", PELA_VERCEL);
    expect(res.body.ip).toBe("200.1.2.3");
  });

  it("com o 1 de antes, req.ip era a borda da Cloudflare, a mesma para todos", async () => {
    const res = await request(app(1)).get("/").set("x-forwarded-for", PELA_VERCEL);
    expect(res.body.ip).toBe("172.70.1.1");
  });
});
