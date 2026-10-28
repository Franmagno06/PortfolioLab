import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { interpretarDataDoFeed } from "./rss.js";

vi.mock("./rss.js", async (original) => ({
  ...(await original<typeof import("./rss.js")>()),
  buscarNoticias: vi.fn(),
}));
vi.mock("./news.repository.js", () => ({
  newsRepository: { saveMany: vi.fn(), findSince: vi.fn(), deleteOlderThan: vi.fn() },
}));

import { atualizarHistorico, noticiasDosUltimosDias, reiniciarHistorico } from "./news.historico.js";
import { newsRepository } from "./news.repository.js";
import { buscarNoticias } from "./rss.js";

const noticia = { titulo: "VALE3 sobe", resumo: "", link: "https://exemplo.com/1", fonte: "InfoMoney", publicadoEm: "2026-10-09T12:00:00.000Z" };

beforeEach(() => {
  reiniciarHistorico();
  vi.mocked(buscarNoticias).mockReset();
  vi.mocked(newsRepository.saveMany).mockReset();
  vi.mocked(newsRepository.deleteOlderThan).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("atualizarHistorico", () => {
  it("lê os feeds, guarda as matérias e apaga as com mais de 14 dias", async () => {
    vi.mocked(buscarNoticias).mockResolvedValue([noticia]);
    await atualizarHistorico();
    expect(newsRepository.saveMany).toHaveBeenCalledWith([noticia]);
    expect(newsRepository.deleteOlderThan).toHaveBeenCalledOnce();
  });

  it("não vai de novo aos feeds dentro de 10 minutos, e junta chamadas simultâneas", async () => {
    vi.mocked(buscarNoticias).mockResolvedValue([noticia]);
    await Promise.all([atualizarHistorico(), atualizarHistorico()]);
    await atualizarHistorico();
    expect(buscarNoticias).toHaveBeenCalledOnce();
  });

  it("feeds fora do ar: não grava nada, não lança e não repete a cada visita", async () => {
    vi.mocked(buscarNoticias).mockResolvedValue([]);
    await atualizarHistorico();
    await atualizarHistorico();
    expect(newsRepository.saveMany).not.toHaveBeenCalled();
    expect(buscarNoticias).toHaveBeenCalledOnce();
  });

  it("banco indisponível: registra o erro e não lança", async () => {
    vi.mocked(buscarNoticias).mockResolvedValue([noticia]);
    vi.mocked(newsRepository.saveMany).mockRejectedValue(new Error("banco fora"));
    await expect(atualizarHistorico()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("noticiasDosUltimosDias", () => {
  it("converte as linhas do banco para o formato do feed", async () => {
    vi.mocked(newsRepository.findSince).mockResolvedValue([
      { id: "1", url: "https://exemplo.com/1", title: "VALE3 sobe", summary: "", source: "InfoMoney", publishedAt: new Date("2026-10-09T12:00:00.000Z"), fetchedAt: new Date() },
    ] as never);
    expect(await noticiasDosUltimosDias()).toEqual([noticia]);
  });
});

describe("interpretarDataDoFeed", () => {
  it("data com fuso é respeitada", () => {
    expect(interpretarDataDoFeed("Fri, 09 Oct 2026 12:00:00 +0000")).toBe("2026-10-09T12:00:00.000Z");
  });

  it("data ISO sem fuso é lida como horário de Brasília", () => {
    expect(interpretarDataDoFeed("2026-10-09T09:00:00")).toBe("2026-10-09T12:00:00.000Z");
  });

  it("data ISO sem fuso é lida como Brasília em qualquer fuso do servidor, com ou sem fração de segundo", () => {
    const original = process.env.TZ;
    try {
      for (const tz of ["UTC", "America/Sao_Paulo", "Asia/Tokyo"]) {
        process.env.TZ = tz;
        expect(interpretarDataDoFeed("2026-10-09T09:00:00"), tz).toBe("2026-10-09T12:00:00.000Z");
        expect(interpretarDataDoFeed("2026-10-09T09:00:00.500"), tz).toBe("2026-10-09T12:00:00.500Z");
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it("data inválida vira o instante atual, e não quebra", () => {
    expect(new Date(interpretarDataDoFeed("lixo")).getTime()).not.toBeNaN();
  });
});
