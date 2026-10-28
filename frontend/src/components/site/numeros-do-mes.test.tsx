// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DadosDosIndices } from "@/lib/indices";
import { DADOS_DE_EXEMPLO } from "@/lib/indices-exemplo";
import { NumerosDoMesAoVivo, NumerosDoMesFixos } from "./numeros-do-mes";

const lerDadosDosIndices = vi.hoisted(() => vi.fn());
vi.mock("@/lib/indices-api", () => ({ lerDadosDosIndices }));

afterEach(() => {
  cleanup();
  lerDadosDosIndices.mockReset();
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
});
