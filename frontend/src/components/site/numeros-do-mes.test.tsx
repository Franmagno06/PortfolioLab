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

const textoDaSecao = () => screen.getByRole("region", { name: /Os números de/ }).textContent ?? "";

describe("seção dos números do mês", () => {
  it("o fallback mostra a referência fixa, dita como fixa, com o mesmo título e id", () => {
    render(<NumerosDoMesFixos />);

    const titulo = screen.getByRole("heading", { level: 2, name: "Os números de outubro de 2026" });
    expect(titulo.id).toBe("titulo-numeros");
    expect(textoDaSecao()).toContain("Referência fixa de 2 de outubro, não atualizada ao vivo");
    expect(textoDaSecao()).toContain("o Ibovespa fechou em 192.115 pontos");
    expect(textoDaSecao()).toContain("perto de 9% ao ano");
  });

  it("ao vivo lê a API com prazo de 5 s", async () => {
    lerDadosDosIndices.mockResolvedValue(null);
    render(await NumerosDoMesAoVivo());

    expect(lerDadosDosIndices).toHaveBeenCalledWith({ prazoMs: 5_000 });
    expect(textoDaSecao()).toContain("Referência fixa"); // falhou: cai no fixo
  });

  it("pregão em andamento: 'está em' e 'Cotação de', nunca 'fechou'", async () => {
    lerDadosDosIndices.mockResolvedValue(
      comIbov("2026-10-19", [
        { data: "2026-09-30", valor: 190000 },
        { data: "2026-10-19", valor: 196000 },
      ]),
    );
    render(await NumerosDoMesAoVivo());

    const texto = textoDaSecao();
    expect(texto).toContain("Cotação de 19 de outubro;");
    expect(texto).toContain("o Ibovespa está em 196.000 pontos (cotação de hoje, com atraso de cerca de 15 minutos)");
    expect(texto).toContain("3,16% acima do fim de setembro");
    expect(texto).not.toContain("fechou");
    expect(texto).not.toContain("Fechamento");
  });

  it("pregão encerrado: 'Fechamento de' e 'fechou em'", async () => {
    lerDadosDosIndices.mockResolvedValue(
      comIbov("2026-10-24", [
        { data: "2026-09-30", valor: 190000 },
        { data: "2026-10-23", valor: 197000 },
      ]),
    );
    render(await NumerosDoMesAoVivo());

    const texto = textoDaSecao();
    expect(texto).toContain("Fechamento de 23 de outubro;");
    expect(texto).toContain("o Ibovespa fechou em 197.000 pontos");
  });
});
