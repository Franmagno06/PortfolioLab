// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DadosDosIndices } from "@/lib/indices";
import { DADOS_DE_EXEMPLO } from "@/lib/indices-exemplo";
import { NumerosDoMesAoVivo, NumerosDoMesFixos } from "./numeros-do-mes";

const lerDadosDosIndices = vi.hoisted(() => vi.fn());
vi.mock("@/lib/indices-api", () => ({ lerDadosDosIndices }));
const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiPublica: api }));

afterEach(() => {
  cleanup();
  lerDadosDosIndices.mockReset();
  api.mockReset();
});

const comIbov = (hoje: string, ibovespa: { data: string; valor: number }[]): DadosDosIndices => ({
  ...DADOS_DE_EXEMPLO,
  hoje,
  pontos: { ...DADOS_DE_EXEMPLO.pontos, ibovespa },
});

const textoDaSecao = () => screen.getByRole("region", { name: "Ativos e índices" }).textContent ?? "";

describe("seção dos números do mês (bento Ativos e índices)", () => {
  it("o fallback mostra a referência fixa, dita como fixa, com o id e o título do bento", () => {
    render(<NumerosDoMesFixos />);

    const titulo = screen.getByRole("heading", { level: 2, name: "Ativos e índices" });
    expect(titulo.id).toBe("titulo-ativos-indices");
    expect(textoDaSecao()).toContain("Referência fixa de 2 de outubro, não atualizada ao vivo");
    expect(textoDaSecao()).toContain("192.115");
    expect(textoDaSecao()).toContain("8,77%"); // juro real da referência fixa (Fisher)
  });

  it("ao vivo lê a API com prazo de 5 s", async () => {
    lerDadosDosIndices.mockResolvedValue(null);
    api.mockRejectedValue(new Error("fora do ar"));
    render(await NumerosDoMesAoVivo());

    expect(lerDadosDosIndices).toHaveBeenCalledWith({ prazoMs: 5_000 });
    expect(textoDaSecao()).toContain("Referência fixa"); // falhou: cai no fixo
  });

  it("pregão em andamento: 'Cotação de', nunca 'Fechamento'", async () => {
    lerDadosDosIndices.mockResolvedValue(
      comIbov("2026-10-19", [
        { data: "2026-09-30", valor: 190000 },
        { data: "2026-10-19", valor: 196000 },
      ]),
    );
    render(await NumerosDoMesAoVivo());

    const texto = textoDaSecao();
    expect(texto).toContain("Cotação de 19 de outubro;");
    expect(texto).toContain("atraso de cerca de 15 minutos");
    expect(texto).toContain("196.000");
    expect(texto).toContain("+3,2%");
    expect(texto).not.toContain("Fechamento");
  });

  it("pregão encerrado: 'Fechamento de'", async () => {
    lerDadosDosIndices.mockResolvedValue(
      comIbov("2026-10-24", [
        { data: "2026-09-30", valor: 190000 },
        { data: "2026-10-23", valor: 197000 },
      ]),
    );
    render(await NumerosDoMesAoVivo());

    const texto = textoDaSecao();
    expect(texto).toContain("Fechamento de 23 de outubro;");
    expect(texto).toContain("197.000");
    expect(texto).not.toContain("Cotação de");
  });

  describe("quando o servidor não consegue os índices a tempo (API fria ou lenta)", () => {
    const fechamentoDe23 = () =>
      comIbov("2026-10-24", [
        { data: "2026-09-30", valor: 190000 },
        { data: "2026-10-23", valor: 197000 },
      ]);

    it("abre com a referência fixa e troca pelos números reais quando o navegador consegue buscá-los", async () => {
      lerDadosDosIndices.mockResolvedValue(null);
      api.mockResolvedValue(fechamentoDe23());
      render(await NumerosDoMesAoVivo());
      expect(textoDaSecao()).toContain("Referência fixa");

      await waitFor(() => expect(textoDaSecao()).toContain("Fechamento de 23 de outubro;"));
      expect(textoDaSecao()).toContain("197.000");
      expect(textoDaSecao()).not.toContain("Referência fixa");
    });

    it("o navegador pede /indices/dados e desiste em 25 s (nem antes, nem depois)", async () => {
      vi.useFakeTimers();
      try {
        lerDadosDosIndices.mockResolvedValue(null);
        api.mockImplementation(() => new Promise(() => {})); // API que nunca responde
        render(await NumerosDoMesAoVivo());

        expect(api).toHaveBeenCalledTimes(1);
        expect(api.mock.calls[0]?.[0]).toBe("/indices/dados");
        const sinal = api.mock.calls[0]?.[1]?.signal as AbortSignal;
        act(() => vi.advanceTimersByTime(24_999));
        expect(sinal.aborted).toBe(false);
        act(() => vi.advanceTimersByTime(1));
        expect(sinal.aborted).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("se o navegador também falha, continua na referência fixa, dita como fixa", async () => {
      lerDadosDosIndices.mockResolvedValue(null);
      const falha = Promise.reject(new Error("fora do ar"));
      falha.catch(() => undefined);
      api.mockReturnValue(falha);
      render(await NumerosDoMesAoVivo());

      await act(async () => {
        await falha.catch(() => undefined);
      });
      expect(textoDaSecao()).toContain("Referência fixa de 2 de outubro, não atualizada ao vivo");
      expect(screen.getByRole("status").textContent).toBe("");
    });

    it("resposta com formato estranho (deploy no meio, proxy) é ignorada: fica a referência fixa, sem quebrar a página", async () => {
      lerDadosDosIndices.mockResolvedValue(null);
      const estranha = Promise.resolve({});
      api.mockReturnValue(estranha);
      render(await NumerosDoMesAoVivo());

      await act(async () => {
        await estranha;
      });
      expect(textoDaSecao()).toContain("Referência fixa");
    });

    it("avisa o leitor de tela quando os números trocam", async () => {
      lerDadosDosIndices.mockResolvedValue(null);
      api.mockResolvedValue(fechamentoDe23());
      render(await NumerosDoMesAoVivo());
      expect(screen.getByRole("status").textContent).toBe("");

      await waitFor(() => expect(screen.getByRole("status").textContent).toContain("atualizados"));
    });

    it("enquanto espera, guarda o lugar do minigráfico do Ibovespa (a troca não empurra a página)", async () => {
      lerDadosDosIndices.mockResolvedValue(null);
      api.mockImplementation(() => new Promise(() => {}));
      const { container } = render(await NumerosDoMesAoVivo());

      expect(container.querySelector("[data-lugar-do-minigrafico]")).not.toBeNull();
    });

    it("resposta incompleta do servidor (sem Selic, por exemplo) não é refeita no navegador: fica a referência fixa", async () => {
      lerDadosDosIndices.mockResolvedValue({ ...DADOS_DE_EXEMPLO, selicMensal: [] });
      render(await NumerosDoMesAoVivo());

      expect(api).not.toHaveBeenCalled();
      expect(textoDaSecao()).toContain("Referência fixa");
    });

    it("se o servidor conseguiu, o navegador nem pergunta", async () => {
      lerDadosDosIndices.mockResolvedValue(fechamentoDe23());
      render(await NumerosDoMesAoVivo());

      expect(api).not.toHaveBeenCalled();
    });
  });
});
