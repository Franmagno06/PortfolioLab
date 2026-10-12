import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { comLimiteDeTempo, criarCacheEmMemoria, criarFila } from "./ativos.cache.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("criarCacheEmMemoria", () => {
  it("a segunda consulta dentro da validade não busca de novo", async () => {
    const cache = criarCacheEmMemoria<number | null>(1000);
    const buscar = vi.fn(async () => 42);

    expect(await cache.obter("PETR4", buscar)).toBe(42);
    expect(await cache.obter("PETR4", buscar)).toBe(42);

    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("consultas simultâneas da mesma chave dividem uma busca só", async () => {
    const cache = criarCacheEmMemoria<number | null>(1000);
    const buscar = vi.fn(async () => 7);

    const resultados = await Promise.all([
      cache.obter("VALE3", buscar),
      cache.obter("VALE3", buscar),
      cache.obter("VALE3", buscar),
    ]);

    expect(resultados).toEqual([7, 7, 7]);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("chaves diferentes não se misturam", async () => {
    const cache = criarCacheEmMemoria<string | null>(1000);

    expect(await cache.obter("A", async () => "a")).toBe("a");
    expect(await cache.obter("B", async () => "b")).toBe("b");
  });

  it("passada a validade, busca de novo", async () => {
    const cache = criarCacheEmMemoria<number | null>(1000);
    const buscar = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    expect(await cache.obter("X", buscar)).toBe(1);
    vi.advanceTimersByTime(1001);
    expect(await cache.obter("X", buscar)).toBe(2);
  });

  it("falha (null) não fica guardada: a próxima consulta tenta de novo", async () => {
    const cache = criarCacheEmMemoria<number | null>(60_000);
    const buscar = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(5);

    expect(await cache.obter("X", buscar)).toBeNull();
    expect(await cache.obter("X", buscar)).toBe(5);
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("lista vazia é resposta válida e fica guardada (um ativo que não pagou nada)", async () => {
    const cache = criarCacheEmMemoria<number[] | null>(60_000);
    const buscar = vi.fn(async () => [] as number[]);

    await cache.obter("X", buscar);
    await cache.obter("X", buscar);

    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("busca que lança erro não fica guardada, e o erro chega a quem perguntou", async () => {
    const cache = criarCacheEmMemoria<number | null>(60_000);
    const buscar = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce(9);

    await expect(cache.obter("X", buscar)).rejects.toThrow("rede");
    expect(await cache.obter("X", buscar)).toBe(9);
  });

  it("ehFalha customizado: mapa vazio é falha", async () => {
    const cache = criarCacheEmMemoria<Map<string, number>>(60_000, (m) => m.size === 0);
    const buscar = vi.fn().mockResolvedValueOnce(new Map()).mockResolvedValueOnce(new Map([["2026-10", 1]]));

    await cache.obter("X", buscar);
    const segundo = await cache.obter("X", buscar);

    expect(segundo.size).toBe(1);
  });

  it("cache negativo: com validadeDaFalhaMs, a falha fica guardada por pouco tempo e depois tenta de novo", async () => {
    const cache = criarCacheEmMemoria<number | null>(60_000, (v) => v === null, 5_000);
    const buscar = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(8);

    expect(await cache.obter("X", buscar)).toBeNull();
    vi.advanceTimersByTime(4_000);
    expect(await cache.obter("X", buscar)).toBeNull(); // dentro dos 5 s: não pergunta de novo à fonte
    expect(buscar).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1_500);
    expect(await cache.obter("X", buscar)).toBe(8); // passou: tenta, e o sucesso passa a valer a validade inteira
    vi.advanceTimersByTime(30_000);
    expect(await cache.obter("X", buscar)).toBe(8);
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("cache negativo desligado (padrão): a falha é esquecida na hora, como antes", async () => {
    const cache = criarCacheEmMemoria<number | null>(60_000);
    const buscar = vi.fn().mockResolvedValue(null);

    await cache.obter("X", buscar);
    await cache.obter("X", buscar);

    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("espiar devolve o que está guardado e válido, sem buscar", async () => {
    const cache = criarCacheEmMemoria<number | null>(1000);
    expect(cache.espiar("X")).toBeUndefined();

    await cache.obter("X", async () => 3);
    expect(await cache.espiar("X")).toBe(3);

    vi.advanceTimersByTime(1001);
    expect(cache.espiar("X")).toBeUndefined();
  });
});

describe("criarFila", () => {
  it("roda as tarefas uma de cada vez, na ordem em que entraram", async () => {
    vi.useRealTimers();
    const fila = criarFila();
    const ordem: string[] = [];
    const tarefa = (nome: string, ms: number) => async () => {
      ordem.push(`${nome}:inicio`);
      await new Promise((r) => setTimeout(r, ms));
      ordem.push(`${nome}:fim`);
    };

    fila.adicionar("a", tarefa("a", 20));
    fila.adicionar("b", tarefa("b", 1));
    await fila.ociosa();

    // b só começa depois de a terminar, mesmo sendo mais rápida
    expect(ordem).toEqual(["a:inicio", "a:fim", "b:inicio", "b:fim"]);
  });

  it("chave que já está na fila não entra de novo", async () => {
    vi.useRealTimers();
    const fila = criarFila();
    const tarefa = vi.fn(async () => undefined);

    expect(fila.adicionar("PETR4", tarefa)).toBe(true);
    expect(fila.adicionar("PETR4", tarefa)).toBe(false);
    await fila.ociosa();

    expect(tarefa).toHaveBeenCalledTimes(1);
  });

  it("depois que a tarefa termina, a mesma chave pode entrar outra vez", async () => {
    vi.useRealTimers();
    const fila = criarFila();
    const tarefa = vi.fn(async () => undefined);

    fila.adicionar("PETR4", tarefa);
    await fila.ociosa();
    expect(fila.adicionar("PETR4", tarefa)).toBe(true);
    await fila.ociosa();

    expect(tarefa).toHaveBeenCalledTimes(2);
  });

  it("uma tarefa que falha é avisada e não trava as seguintes", async () => {
    vi.useRealTimers();
    const aoFalhar = vi.fn();
    const fila = criarFila(aoFalhar);
    const depois = vi.fn(async () => undefined);

    fila.adicionar("quebra", async () => {
      throw new Error("Yahoo fora do ar");
    });
    fila.adicionar("segue", depois);
    await fila.ociosa();

    expect(aoFalhar).toHaveBeenCalledWith("quebra", expect.any(Error));
    expect(depois).toHaveBeenCalledTimes(1);
    expect(fila.tamanho()).toBe(0);
  });
});

describe("comLimiteDeTempo", () => {
  it("devolve o resultado quando chega a tempo", async () => {
    const resultado = comLimiteDeTempo(Promise.resolve("ok"), 1000, "estourou");
    expect(await resultado).toBe("ok");
  });

  it("devolve o valor de estouro quando passa do tempo, sem esperar a promessa original", async () => {
    const lenta = new Promise<string>((resolve) => setTimeout(() => resolve("tarde"), 5000));
    const resultado = comLimiteDeTempo(lenta, 1000, "estourou");

    vi.advanceTimersByTime(1001);

    expect(await resultado).toBe("estourou");
  });
});
