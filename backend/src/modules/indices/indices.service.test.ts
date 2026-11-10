import { beforeEach, describe, expect, it, vi } from "vitest";
import { buscarSerieDiariaYahoo, buscarUltimoValorYahoo } from "../quotes/quotes.provider.js";
import { buscarSerieHistoricaB3, buscarSerieSgs } from "./indices.fontes.js";
import { indicesRepository } from "./indices.repository.js";
import { indicesService, limparCacheDosIndices } from "./indices.service.js";

// Sem rede e sem banco: fontes e repository são simulados.
vi.mock("./indices.fontes.js", () => ({
  buscarSerieSgs: vi.fn(),
  buscarSerieHistoricaB3: vi.fn(),
}));
vi.mock("../quotes/quotes.provider.js", () => ({
  buscarSerieDiariaYahoo: vi.fn(),
  buscarUltimoValorYahoo: vi.fn(),
}));
vi.mock("./indices.repository.js", () => ({
  indicesRepository: {
    gravarPonto: vi.fn(),
    listarPontos: vi.fn(),
    gravarPontosEmLote: vi.fn(),
    gravarSerieSgs: vi.fn(),
    listarSerieSgs: vi.fn(),
  },
}));

const HOJE = "2026-10-19";

beforeEach(() => {
  vi.resetAllMocks();
  limparCacheDosIndices();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${HOJE}T15:00:00Z`));

  vi.mocked(buscarSerieSgs).mockImplementation(async (codigo) => {
    if (codigo === 432) {
      return [
        { data: "2026-09-30", valor: 14.25 },
        { data: "2026-10-18", valor: 13.75 },
        { data: "2026-11-03", valor: 13.5 }, // futuro: o SGS repete a meta adiantada
      ];
    }
    if (codigo === 433) return [{ data: "2026-09-01", valor: 0.5 }];
    if (codigo === 4391) return [{ data: "2026-10-01", valor: 0.56 }];
    return [{ data: "2026-10-16", valor: 13.65 }];
  });
  vi.mocked(buscarSerieHistoricaB3).mockResolvedValue(null);
  vi.mocked(buscarSerieDiariaYahoo).mockResolvedValue([{ data: "2026-10-16", valor: 205000 }]);
  vi.mocked(buscarUltimoValorYahoo).mockResolvedValue({ data: HOJE, valor: 3953.42 });
  vi.mocked(indicesRepository.gravarPonto).mockResolvedValue(undefined);
  vi.mocked(indicesRepository.listarPontos).mockResolvedValue([{ data: HOJE, valor: 3953.42 }]);
  vi.mocked(indicesRepository.gravarPontosEmLote).mockResolvedValue(undefined);
  vi.mocked(indicesRepository.gravarSerieSgs).mockResolvedValue(undefined);
  vi.mocked(indicesRepository.listarSerieSgs).mockResolvedValue([]);
});

describe("indicesService.montarDados", () => {
  it("monta as séries mensais a partir do SGS", async () => {
    const d = await indicesService.montarDados();

    expect(d.hoje).toBe(HOJE);
    expect(d.selicMensal).toEqual([
      { data: "2026-09", valor: 14.25 },
      { data: "2026-10", valor: 13.75 },
    ]);
    expect(d.ipcaMensal).toEqual([{ data: "2026-09", valor: 0.5 }]);
    expect(d.cdiMensal).toEqual([{ data: "2026-10", valor: 0.56 }]);
    expect(d.cdiTaxaMensal).toEqual([{ data: "2026-10", valor: 13.65 }]);
    expect(d.pontos.ibovespa).toEqual([{ data: "2026-10-16", valor: 205000 }]);
  });

  it("nenhum ponto depois de hoje sai do service", async () => {
    vi.mocked(buscarSerieSgs).mockResolvedValue([
      { data: "2026-10-19", valor: 13.75 },
      { data: "2026-10-20", valor: 13.5 },
      { data: "2026-12-01", valor: 13.5 },
    ]);

    const d = await indicesService.montarDados();

    expect(d.selicMensal).toEqual([{ data: "2026-10", valor: 13.75 }]);
    expect(d.cdiTaxaMensal).toEqual([{ data: "2026-10", valor: 13.75 }]);
  });

  it("responde com séries vazias quando o BCB falha", async () => {
    vi.mocked(buscarSerieSgs).mockResolvedValue(null);

    const d = await indicesService.montarDados();

    expect(d.selicMensal).toEqual([]);
    expect(d.ipcaMensal).toEqual([]);
    expect(d.cdiMensal).toEqual([]);
    expect(d.cdiTaxaMensal).toEqual([]);
    expect(d.pontos.ibovespa.length).toBeGreaterThan(0);
  });

  it("falha do Yahoo vira série vazia e o resto continua", async () => {
    vi.mocked(buscarSerieDiariaYahoo).mockResolvedValue(null);
    vi.mocked(buscarUltimoValorYahoo).mockResolvedValue(null);
    vi.mocked(indicesRepository.listarPontos).mockResolvedValue([]);

    const d = await indicesService.montarDados();

    expect(d.pontos.ibovespa).toEqual([]);
    expect(d.pontos.sp500).toEqual([]);
    expect(d.pontos.ifix).toEqual([]);
    expect(indicesRepository.gravarPonto).not.toHaveBeenCalled();
    expect(d.selicMensal.length).toBeGreaterThan(0);
  });

  it("grava o ponto do dia do IFIX e devolve a série do banco", async () => {
    const d = await indicesService.montarDados();

    expect(indicesRepository.gravarPonto).toHaveBeenCalledWith("ifix", HOJE, 3953.42);
    expect(indicesRepository.gravarPonto).toHaveBeenCalledWith("smll", HOJE, 3953.42);
    expect(indicesRepository.gravarPonto).toHaveBeenCalledWith("idiv", HOJE, 3953.42);
    expect(d.pontos.ifix).toEqual([{ data: HOJE, valor: 3953.42 }]);
  });

  it("falha ao gravar ou ao ler o banco não derruba nem some com o resto", async () => {
    vi.mocked(indicesRepository.gravarPonto).mockRejectedValue(new Error("banco fora"));
    const d1 = await indicesService.montarDados();
    expect(d1.pontos.ifix).toEqual([{ data: HOJE, valor: 3953.42 }]);

    vi.mocked(indicesRepository.listarPontos).mockRejectedValue(new Error("banco fora"));
    const d2 = await indicesService.montarDados();
    expect(d2.pontos.ifix).toEqual([]);
    expect(d2.pontos.ibovespa.length).toBeGreaterThan(0);
  });

  it("não chama as fontes duas vezes dentro da validade do cache", async () => {
    await indicesService.montarDados();
    expect(buscarSerieSgs).toHaveBeenCalledTimes(4);
    expect(buscarSerieDiariaYahoo).toHaveBeenCalledTimes(2);
    expect(buscarUltimoValorYahoo).toHaveBeenCalledTimes(3);

    await indicesService.montarDados();

    expect(buscarSerieSgs).toHaveBeenCalledTimes(4);
    expect(buscarSerieDiariaYahoo).toHaveBeenCalledTimes(2);
    expect(buscarUltimoValorYahoo).toHaveBeenCalledTimes(3);
  });

  it("falha fica guardada por 2 minutos e depois tenta de novo", async () => {
    vi.mocked(buscarSerieSgs).mockResolvedValue(null);
    await indicesService.montarDados();
    await indicesService.montarDados();
    expect(buscarSerieSgs).toHaveBeenCalledTimes(4);

    vi.setSystemTime(new Date(`${HOJE}T15:03:00Z`));
    await indicesService.montarDados();
    expect(buscarSerieSgs).toHaveBeenCalledTimes(8);
  });

  const comTimers = () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(`${HOJE}T15:00:00Z`));
  };

  it("série lenta do SGS estoura o prazo: vai vazia agora, e a próxima chamada já traz o dado", async () => {
    comTimers();
    let liberar: (v: { data: string; valor: number }[]) => void = () => undefined;
    const lenta = new Promise<{ data: string; valor: number }[]>((r) => (liberar = r));
    vi.mocked(buscarSerieSgs).mockImplementation(async (codigo) => {
      if (codigo === 433) return lenta;
      return [{ data: "2026-10-01", valor: 1 }];
    });

    const pendente = indicesService.montarDados();
    await vi.advanceTimersByTimeAsync(15_001);
    const d1 = await pendente;
    expect(d1.ipcaMensal).toEqual([]);
    expect(d1.selicMensal.length).toBeGreaterThan(0);

    liberar([{ data: "2026-09-01", valor: 0.5 }]);
    await vi.advanceTimersByTimeAsync(0);
    const d2 = await indicesService.montarDados();
    expect(d2.ipcaMensal).toEqual([{ data: "2026-09", valor: 0.5 }]);
    expect(d2.cdiMensal).toEqual([{ data: "2026-10", valor: 1 }]);
    expect(buscarSerieSgs).toHaveBeenCalledTimes(4);
  });

  it("as quatro séries lentas: a resposta espera uns 15 s no total, não 4 x, e vem com tudo vazio", async () => {
    comTimers();
    vi.mocked(buscarSerieSgs).mockImplementation(() => new Promise(() => undefined));

    let terminou = false;
    const pendente = indicesService.montarDados().then((d) => {
      terminou = true;
      return d;
    });
    await vi.advanceTimersByTimeAsync(14_900);
    expect(terminou).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    const d = await pendente;

    expect(terminou).toBe(true);
    expect([d.selicMensal, d.ipcaMensal, d.cdiMensal, d.cdiTaxaMensal]).toEqual([[], [], [], []]);
    expect(d.pontos.ibovespa.length).toBeGreaterThan(0);
  });

  it("nunca duas chamadas ao BCB ao mesmo tempo, nem depois de a resposta desistir da série lenta", async () => {
    comTimers();
    let emVoo = 0;
    let maximo = 0;
    const liberacoes: (() => void)[] = [];
    vi.mocked(buscarSerieSgs).mockImplementation(async (codigo) => {
      emVoo++;
      maximo = Math.max(maximo, emVoo);
      await new Promise<void>((r) => liberacoes.push(r));
      emVoo--;
      return [{ data: `2026-10-0${codigo === 432 ? 1 : 2}`, valor: 1 }];
    });

    const pendente = indicesService.montarDados();
    await vi.advanceTimersByTimeAsync(15_001);
    const d1 = await pendente;
    expect(d1.selicMensal).toEqual([]);
    expect(buscarSerieSgs).toHaveBeenCalledTimes(1); // a primeira ainda ocupa a fila: as outras esperam

    for (let i = 0; i < 4; i++) {
      liberacoes.shift()?.();
      await vi.advanceTimersByTimeAsync(0);
    }

    expect(buscarSerieSgs).toHaveBeenCalledTimes(4);
    expect(maximo).toBe(1);
    const d2 = await indicesService.montarDados();
    expect(d2.selicMensal.length).toBeGreaterThan(0);
    expect(d2.ipcaMensal.length).toBeGreaterThan(0);
    expect(buscarSerieSgs).toHaveBeenCalledTimes(4);
  });

  describe("último valor bom do SGS", () => {
    const SELIC_BOA = [{ data: "2026-10-18", valor: 13.75 }];
    const SELIC_NOVA = [{ data: "2026-10-18", valor: 14 }];

    const primeiraBuscaBoa = async () => {
      vi.mocked(buscarSerieSgs).mockResolvedValue(SELIC_BOA);
      const d = await indicesService.montarDados();
      expect(d.selicMensal).toEqual([{ data: "2026-10", valor: 13.75 }]);
    };
    // validade do SGS é de 6 h: 15:00 + 6 h 1 min
    const passarSeisHoras = () => vi.setSystemTime(new Date(`${HOJE}T21:01:00Z`));

    it("vencido o cache, a renovação que estoura o prazo devolve a série boa anterior, não []", async () => {
      comTimers();
      await primeiraBuscaBoa();
      passarSeisHoras();
      vi.mocked(buscarSerieSgs).mockImplementation(() => new Promise(() => undefined));

      const pendente = indicesService.montarDados();
      await vi.advanceTimersByTimeAsync(15_001);
      const d = await pendente;

      expect(buscarSerieSgs).toHaveBeenCalledTimes(5); // houve renovação (a 1ª da fila, travada)
      expect(d.selicMensal).toEqual([{ data: "2026-10", valor: 13.75 }]);
      expect(d.cdiTaxaMensal).toEqual([{ data: "2026-10", valor: 13.75 }]);
    });

    it("renovação que falha (null) devolve a série boa anterior", async () => {
      await primeiraBuscaBoa();
      passarSeisHoras();
      vi.mocked(buscarSerieSgs).mockResolvedValue(null);

      const d = await indicesService.montarDados();

      expect(buscarSerieSgs).toHaveBeenCalledTimes(8);
      expect(d.selicMensal).toEqual([{ data: "2026-10", valor: 13.75 }]);
      expect(d.cdiTaxaMensal).toEqual([{ data: "2026-10", valor: 13.75 }]);
    });

    it("renovação que volta vazia também não apaga a série boa", async () => {
      await primeiraBuscaBoa();
      passarSeisHoras();
      vi.mocked(buscarSerieSgs).mockResolvedValue([]);

      const d = await indicesService.montarDados();

      expect(d.selicMensal).toEqual([{ data: "2026-10", valor: 13.75 }]);
    });

    it("sem valor bom anterior, falha continua vindo vazia", async () => {
      vi.mocked(buscarSerieSgs).mockResolvedValue(null);
      const d = await indicesService.montarDados();
      expect(d.selicMensal).toEqual([]);
    });

    it("uma renovação boa depois substitui o valor antigo", async () => {
      await primeiraBuscaBoa();
      passarSeisHoras();
      vi.mocked(buscarSerieSgs).mockResolvedValue(null);
      await indicesService.montarDados(); // falha: guardada 2 min
      vi.setSystemTime(new Date(`${HOJE}T21:04:00Z`));
      vi.mocked(buscarSerieSgs).mockResolvedValue(SELIC_NOVA);

      const d = await indicesService.montarDados();

      expect(d.selicMensal).toEqual([{ data: "2026-10", valor: 14 }]);
    });

    it("limparCacheDosIndices esquece também o último valor bom", async () => {
      await primeiraBuscaBoa();
      limparCacheDosIndices();
      vi.mocked(buscarSerieSgs).mockResolvedValue(null);
      const d = await indicesService.montarDados();
      expect(d.selicMensal).toEqual([]);
    });
  });

  describe("persistência de fallback do SGS e backfill da B3", () => {
    it("persiste a série mensal reduzida do SGS quando buscarSerieSgs tem sucesso", async () => {
      await indicesService.montarDados();

      expect(indicesRepository.gravarSerieSgs).toHaveBeenCalledWith(432, [
        { data: "2026-09", valor: 14.25 },
        { data: "2026-10", valor: 13.75 },
      ]);
      expect(indicesRepository.gravarSerieSgs).toHaveBeenCalledWith(433, [{ data: "2026-09", valor: 0.5 }]);
    });

    it("usa listarSerieSgs do banco quando o SGS falha e não há valor em memória", async () => {
      vi.mocked(buscarSerieSgs).mockResolvedValue(null);
      vi.mocked(indicesRepository.listarSerieSgs).mockImplementation(async (codigo) => {
        if (codigo === 432) return [{ data: "2026-09-01", valor: 14.25 }];
        if (codigo === 433) return [{ data: "2026-09-01", valor: 0.48 }];
        return [];
      });

      const d = await indicesService.montarDados();

      expect(d.selicMensal).toEqual([{ data: "2026-09", valor: 14.25 }]);
      expect(d.ipcaMensal).toEqual([{ data: "2026-09", valor: 0.48 }]);
    });

    const historico = [
      { data: "2011-01-03", valor: 1500 },
      { data: "2026-10-19", valor: 3953.42 },
    ];
    // o que produção tinha antes do backfill: semanas de leituras diárias do Yahoo e nenhum histórico
    const soLeiturasRecentes = [
      { data: "2026-10-15", valor: 3940 },
      { data: "2026-10-16", valor: 3948 },
      { data: HOJE, valor: 3953.42 },
    ];

    it("busca o histórico na B3 e grava em lote quando o banco só tem leituras recentes, mesmo que sejam várias", async () => {
      vi.mocked(indicesRepository.listarPontos)
        .mockResolvedValueOnce(soLeiturasRecentes) // ifix antes
        .mockResolvedValueOnce(historico) // smll já começa em 2011
        .mockResolvedValueOnce(historico) // idiv já começa em 2011
        .mockResolvedValueOnce(historico); // ifix relido depois de gravar
      vi.mocked(buscarSerieHistoricaB3).mockResolvedValueOnce(historico);

      const d = await indicesService.montarDados();

      expect(buscarSerieHistoricaB3).toHaveBeenCalledTimes(1);
      expect(buscarSerieHistoricaB3).toHaveBeenCalledWith("IFIX", 2011, 2026);
      expect(indicesRepository.gravarPontosEmLote).toHaveBeenCalledWith("ifix", historico);
      expect(d.pontos.ifix).toEqual(historico);
    });

    it("com o histórico já no banco (primeiro ponto em 2011), não chama a B3", async () => {
      vi.mocked(indicesRepository.listarPontos).mockResolvedValue(historico);

      await indicesService.montarDados();

      expect(buscarSerieHistoricaB3).not.toHaveBeenCalled();
      expect(indicesRepository.gravarPontosEmLote).not.toHaveBeenCalled();
    });

    it("B3 fora do ar: devolve o que o banco tem e só tenta de novo depois de 2 minutos", async () => {
      vi.mocked(indicesRepository.listarPontos).mockResolvedValue(soLeiturasRecentes);

      const d = await indicesService.montarDados();
      await indicesService.montarDados();

      expect(d.pontos.ifix).toEqual(soLeiturasRecentes);
      expect(buscarSerieHistoricaB3).toHaveBeenCalledTimes(3); // um por índice, não seis
      vi.setSystemTime(new Date(Date.now() + 2 * 60 * 1000 + 1));
      await indicesService.montarDados();
      expect(buscarSerieHistoricaB3).toHaveBeenCalledTimes(6);
    });

    it("falha ao gravar o histórico não derruba: sai o que o banco tem", async () => {
      vi.mocked(indicesRepository.listarPontos).mockResolvedValue(soLeiturasRecentes);
      vi.mocked(buscarSerieHistoricaB3).mockResolvedValue(historico);
      vi.mocked(indicesRepository.gravarPontosEmLote).mockRejectedValue(new Error("banco fora"));

      const d = await indicesService.montarDados();

      expect(d.pontos.ifix).toEqual(soLeiturasRecentes);
    });

    it("B3 lenta não segura a rota: a resposta sai no prazo com o que há, e o histórico entra quando chega", async () => {
      vi.useRealTimers();
      vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
      vi.setSystemTime(new Date(`${HOJE}T15:00:00Z`));
      let liberar: (v: { data: string; valor: number }[]) => void = () => undefined;
      const lenta = new Promise<{ data: string; valor: number }[]>((r) => (liberar = r));
      vi.mocked(buscarSerieHistoricaB3).mockReturnValue(lenta);
      vi.mocked(indicesRepository.listarPontos).mockResolvedValue(soLeiturasRecentes);

      const pendente = indicesService.montarDados();
      await vi.advanceTimersByTimeAsync(15_001);
      const d = await pendente;

      expect(d.pontos.ifix).toEqual(soLeiturasRecentes);
      expect(indicesRepository.gravarPontosEmLote).not.toHaveBeenCalled();

      liberar(historico);
      await vi.advanceTimersByTimeAsync(0);
      expect(indicesRepository.gravarPontosEmLote).toHaveBeenCalledWith("ifix", historico);
    });

    it("preencherHistoricoDaB3 espera a gravação e conta os pontos de cada índice", async () => {
      vi.mocked(indicesRepository.listarPontos)
        .mockResolvedValueOnce(soLeiturasRecentes) // ifix antes
        .mockResolvedValueOnce(historico) // smll completo
        .mockResolvedValueOnce(historico) // idiv completo
        .mockResolvedValueOnce([...historico, { data: HOJE, valor: 3953.42 }]); // ifix depois
      vi.mocked(buscarSerieHistoricaB3).mockResolvedValueOnce(historico);

      expect(await indicesService.preencherHistoricoDaB3()).toEqual({ ifix: 3, smll: 2, idiv: 2 });
      expect(indicesRepository.gravarPontosEmLote).toHaveBeenCalledTimes(1);
    });

    it("erro síncrono ao guardar a reserva do SGS não segura a resposta", async () => {
      vi.mocked(indicesRepository.gravarSerieSgs).mockImplementation(() => {
        throw new Error("cliente do banco quebrado");
      });

      const d = await indicesService.montarDados();

      expect(d.selicMensal.length).toBeGreaterThan(0);
    });
  });

  it("aquecer() espera as fontes e deixa o cache cheio: o montarDados seguinte não chama fonte nenhuma", async () => {
    await indicesService.aquecer();
    const chamadas = [buscarSerieSgs, buscarSerieDiariaYahoo, buscarUltimoValorYahoo].map((f) => vi.mocked(f).mock.calls.length);
    expect(chamadas).toEqual([4, 2, 3]);

    const d = await indicesService.montarDados();

    expect(d.selicMensal.length).toBeGreaterThan(0);
    expect([buscarSerieSgs, buscarSerieDiariaYahoo, buscarUltimoValorYahoo].map((f) => vi.mocked(f).mock.calls.length)).toEqual(chamadas);
  });

  it("aquecer() não rejeita mesmo com as fontes explodindo", async () => {
    vi.mocked(buscarSerieSgs).mockRejectedValue(new Error("x"));
    vi.mocked(buscarSerieDiariaYahoo).mockRejectedValue(new Error("x"));
    vi.mocked(buscarUltimoValorYahoo).mockRejectedValue(new Error("x"));
    await expect(indicesService.aquecer()).resolves.toBeUndefined();
  });
});
