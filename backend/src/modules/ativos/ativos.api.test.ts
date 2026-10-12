import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { AppError } from "../../shared/errors/AppError.js";
import { limitadorGlobal } from "../../shared/middlewares/rate-limit.js";
import { ativosRoutes } from "./ativos.routes.js";
import { ativosService } from "./ativos.service.js";

// A camada HTTP das páginas públicas de Ativos. O serviço é simulado: o que se confere aqui é a
// rota (aberta, sem login), a validação do ticker (formato e catálogo), o formato do erro e o
// cabeçalho de cache. A regra de negócio tem o teste dela em ativos.service.test.ts, sem rede e
// sem escrever no banco.
vi.mock("./ativos.service.js", () => ({
  ativosService: {
    listarAcoes: vi.fn(),
    listarFiis: vi.fn(),
    fichaDaAcao: vi.fn(),
    fichaDoFii: vi.fn(),
    listarEtfs: vi.fn(),
    fichaDoEtf: vi.fn(),
  },
}));

const FICHA = { ticker: "VALE3", nome: "Vale S.A.", preco: 62.48 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(ativosService.listarAcoes).mockResolvedValue([{ ticker: "PETR4" }] as never);
  vi.mocked(ativosService.listarFiis).mockResolvedValue([{ ticker: "MXRF11" }] as never);
  vi.mocked(ativosService.fichaDaAcao).mockResolvedValue(FICHA as never);
  vi.mocked(ativosService.fichaDoFii).mockResolvedValue({ ticker: "MXRF11" } as never);
  vi.mocked(ativosService.listarEtfs).mockResolvedValue([{ ticker: "BOVA11" }] as never);
  vi.mocked(ativosService.fichaDoEtf).mockResolvedValue({ ticker: "BOVA11" } as never);
});

describe("rotas públicas de /ativos", () => {
  it("a listagem de ações abre sem login", async () => {
    const res = await request(app).get("/ativos/acoes");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ ticker: "PETR4" }]);
  });

  it("a listagem de FIIs abre sem login", async () => {
    const res = await request(app).get("/ativos/fiis");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ ticker: "MXRF11" }]);
  });

  it("a ficha de uma ação abre sem login", async () => {
    const res = await request(app).get("/ativos/acoes/VALE3");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(FICHA);
    expect(ativosService.fichaDaAcao).toHaveBeenCalledWith("VALE3");
  });

  it("a ficha de um FII abre sem login", async () => {
    const res = await request(app).get("/ativos/fiis/MXRF11");

    expect(res.status).toBe(200);
    expect(ativosService.fichaDoFii).toHaveBeenCalledWith("MXRF11");
  });

  it("a resposta pode ser guardada por um minuto: é dado público que muda devagar", async () => {
    const res = await request(app).get("/ativos/acoes/VALE3");

    expect(res.headers["cache-control"]).toBe("public, max-age=60");
  });

  it("não deixa cookie nenhum na resposta", async () => {
    const res = await request(app).get("/ativos/acoes");

    expect(res.headers["set-cookie"]).toBeUndefined();
  });
});

describe("rotas de ETFs", () => {
  it("a listagem e a ficha abrem sem login", async () => {
    const lista = await request(app).get("/ativos/etfs");
    expect(lista.status).toBe(200);
    expect(lista.body).toEqual([{ ticker: "BOVA11" }]);

    const ficha = await request(app).get("/ativos/etfs/bova11");
    expect(ficha.status).toBe(200);
    expect(ativosService.fichaDoEtf).toHaveBeenCalledWith("BOVA11");
    expect(ficha.headers["cache-control"]).toBe("public, max-age=60");
  });

  it("ETF fora do catálogo: 404 no formato { error }", async () => {
    vi.mocked(ativosService.fichaDoEtf).mockRejectedValue(new AppError("ETF não encontrado no catálogo", 404));
    const res = await request(app).get("/ativos/etfs/XXXX11");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("ETF não encontrado no catálogo");
  });

  it("ticker em formato inválido: 400, e o serviço nem é chamado", async () => {
    const res = await request(app).get("/ativos/etfs/BOVA.11");
    expect(res.status).toBe(400);
    expect(ativosService.fichaDoEtf).not.toHaveBeenCalled();
  });
});

describe("ticker da rota", () => {
  it("em minúsculas, chega ao serviço em maiúsculas", async () => {
    await request(app).get("/ativos/acoes/vale3");

    expect(ativosService.fichaDaAcao).toHaveBeenCalledWith("VALE3");
  });

  it("ticker válido que não é do catálogo: 404 no formato { error }", async () => {
    vi.mocked(ativosService.fichaDaAcao).mockRejectedValue(new AppError("Ação não encontrada no catálogo", 404));

    const res = await request(app).get("/ativos/acoes/XXXX9");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Ação não encontrada no catálogo" });
  });

  it("FII fora do catálogo: 404 com a mensagem de FII", async () => {
    vi.mocked(ativosService.fichaDoFii).mockRejectedValue(new AppError("FII não encontrado no catálogo", 404));

    const res = await request(app).get("/ativos/fiis/XXXX11");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("FII não encontrado no catálogo");
  });

  it.each([
    ["curto demais", "AB"],
    ["com ponto", "VALE.3"],
    ["com caminho", "..%2F..%2Fetc"],
    ["com interrogação", "VALE3%3Fx%3D1"],
    ["longo demais", "ABCDEFGHIJKLM"],
    ["com espaço", "VALE%203"],
  ])("ticker %s: 400, e o serviço (que chegaria às fontes externas) nem é chamado", async (_nome, ticker) => {
    const res = await request(app).get(`/ativos/acoes/${ticker}`);

    expect(res.status).toBe(400);
    expect(ativosService.fichaDaAcao).not.toHaveBeenCalled();
  });

  it("o mesmo vale para a ficha de FII", async () => {
    const res = await request(app).get("/ativos/fiis/..%2Fx");

    expect(res.status).toBe(400);
    expect(ativosService.fichaDoFii).not.toHaveBeenCalled();
  });
});

describe("o que /ativos NÃO abre", () => {
  it("só aceita leitura: POST, PUT e DELETE não existem", async () => {
    for (const metodo of ["post", "put", "delete", "patch"] as const) {
      const res = await request(app)[metodo]("/ativos/acoes/VALE3");
      expect(res.status, metodo).toBe(404);
    }
  });

  it("não existe rota para um ativo arbitrário fora de /acoes e /fiis", async () => {
    const res = await request(app).get("/ativos/VALE3");

    expect(res.status).toBe(404);
  });

  it("as rotas protegidas continuam pedindo login (a abertura de /ativos não vazou)", async () => {
    for (const rota of ["/indicators", "/portfolio", "/news", "/assets"]) {
      const res = await request(app).get(rota);
      expect(res.status, rota).toBe(401);
    }
  });
});

describe("ordem de montagem no app", () => {
  it("/ativos é montado ANTES do limitador global: tráfego público não gasta o teto de todos os usuários", () => {
    // o Next serve todos os visitantes do mesmo IP, então o contador global é de todo mundo junto.
    // Se /ativos passasse por ele, martelar essas rotas esgotaria o teto e derrubaria login e carteira.
    const pilha = (app as unknown as { router: { stack: { handle: unknown }[] } }).router.stack;
    const posicaoDoGlobal = pilha.findIndex((c) => c.handle === limitadorGlobal);
    const posicaoDoAtivos = pilha.findIndex((c) => c.handle === ativosRoutes);

    expect(posicaoDoGlobal).toBeGreaterThan(-1);
    expect(posicaoDoAtivos).toBeGreaterThan(-1);
    expect(posicaoDoAtivos).toBeLessThan(posicaoDoGlobal);
  });
});
