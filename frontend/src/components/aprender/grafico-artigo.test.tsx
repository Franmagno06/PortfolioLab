// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatarValorArtigo, GraficoArtigo } from "./grafico-artigo";

// Mock de ResizeObserver e dimensões para o ResponsiveContainer do Recharts no JSDOM
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  globalThis.ResizeObserver = MockResizeObserver as any;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 600,
    height: 300,
    top: 0,
    left: 0,
    bottom: 300,
    right: 600,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GraficoArtigo: formatarValorArtigo", () => {
  it("formata moeda com símbolo e separadores pt-BR", () => {
    const formatado = formatarValorArtigo(1500, "moeda");
    expect(formatado).toContain("1.500,00");
    expect(formatado).toContain("R$");
  });

  it("formata percentual com vírgula e símbolo %", () => {
    expect(formatarValorArtigo(12.5, "percentual")).toBe("12,5%");
    expect(formatarValorArtigo(13.75, "percentual")).toBe("13,75%");
  });

  it("formata multiplicador com x", () => {
    expect(formatarValorArtigo(7.8, "multiplicador")).toBe("7,8x");
    expect(formatarValorArtigo(10, "multiplicador")).toBe("10x");
  });

  it("trata valores inválidos ou nulos devolvendo travessão", () => {
    expect(formatarValorArtigo(null, "moeda")).toBe("—");
    expect(formatarValorArtigo(undefined, "percentual")).toBe("—");
    expect(formatarValorArtigo(NaN, "numero")).toBe("—");
  });
});

describe("GraficoArtigo: Presets didáticos", () => {
  it("renderiza o preset juros-compostos no modo área com pílulas de cenários", () => {
    const { container } = render(<GraficoArtigo preset="juros-compostos" />);

    expect(container.querySelector('[data-grafico-artigo]')).not.toBeNull();
    expect(container.querySelector('[data-preset="juros-compostos"]')).not.toBeNull();
    expect(container.querySelector('[data-modo="area"]')).not.toBeNull();

    // Título no figcaption
    const figcaption = container.querySelector("figcaption");
    expect(figcaption?.textContent).toContain("Evolução dos juros compostos");

    // Pílulas de cenários
    const tablist = screen.getByRole("tablist", { name: "Cenários do gráfico" });
    expect(tablist).not.toBeNull();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(["10 anos", "20 anos", "30 anos"]);

    // Primeiro cenário selecionado inicialmente
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("false");

    // Indicador com Framer Motion layoutId e spring transition
    const indicador = container.querySelector('[data-layout-id="cenario-grafico-artigo"]');
    expect(indicador).not.toBeNull();
    expect(indicador?.getAttribute("data-transition")).toContain('"stiffness":400');
    expect(indicador?.getAttribute("data-transition")).toContain('"damping":30');
  });

  it("renderiza o preset pl-setorial no modo barras", () => {
    const { container } = render(<GraficoArtigo preset="pl-setorial" />);

    expect(container.querySelector('[data-modo="barras"]')).not.toBeNull();
    const figcaption = container.querySelector("figcaption");
    expect(figcaption?.textContent).toContain("Comparação de múltiplos médios entre setores");

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(["P/L Médio", "P/VP Médio"]);
  });

  it("renderiza o preset renda-fixa-curva com Selic e contratos futuros", () => {
    const { container } = render(<GraficoArtigo preset="renda-fixa-curva" />);

    expect(container.querySelector('[data-preset="renda-fixa-curva"]')).not.toBeNull();
    const figcaption = container.querySelector("figcaption");
    expect(figcaption?.textContent).toContain("Curva de juros: taxa presente vs expectativas");
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
  });

  it("renderiza o preset ir-aliquotas", () => {
    const { container } = render(<GraficoArtigo preset="ir-aliquotas" />);

    expect(container.querySelector('[data-preset="ir-aliquotas"]')).not.toBeNull();
    const figcaption = container.querySelector("figcaption");
    expect(figcaption?.textContent).toContain("Tabela comparativa de alíquotas de Imposto de Renda");
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(["Renda Variável", "Renda Fixa (Prazo)"]);
  });

  it("renderiza o preset fiis-proventos com comparação de tijolo e papel", () => {
    const { container } = render(<GraficoArtigo preset="fiis-proventos" />);

    expect(container.querySelector('[data-preset="fiis-proventos"]')).not.toBeNull();
    const figcaption = container.querySelector("figcaption");
    expect(figcaption?.textContent).toContain("Série histórica de 12 meses: FII de Tijolo vs FII de Papel");
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(["Comparativo", "FII de Tijolo", "FII de Papel"]);
  });
});

describe("GraficoArtigo: Acessibilidade", () => {
  it("possui role='img' com aria-label descritivo e texto para leitor de tela", () => {
    const { container } = render(<GraficoArtigo preset="juros-compostos" />);

    const img = screen.getByRole("img");
    expect(img).not.toBeNull();
    const ariaLabel = img.getAttribute("aria-label");
    expect(ariaLabel).toBeDefined();
    expect(ariaLabel).toContain("Gráfico de área");
    expect(ariaLabel).toContain("Evolução dos juros compostos");
    expect(ariaLabel).toContain("Total investido");

    const srOnly = container.querySelector(".sr-only");
    expect(srOnly?.textContent).toBe(ariaLabel);
  });

  it("expande a tabela de dados acessível ao interagir com o details", () => {
    const { container } = render(<GraficoArtigo preset="ir-aliquotas" />);

    const details = container.querySelector("details");
    expect(details).not.toBeNull();

    const summary = container.querySelector("summary");
    expect(summary?.textContent).toContain("Ver dados do gráfico em tabela");

    // Antes de abrir, a tabela não está montada no DOM
    expect(container.querySelector("table")).toBeNull();

    // Abre o details disparando evento de toggle
    if (details) {
      details.open = true;
      fireEvent(details, new Event("toggle"));
    }

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(table?.querySelector("caption")).not.toBeNull();
    expect(table?.textContent).toContain("Ações (até 20k/mês)");
    expect(table?.textContent).toContain("Day Trade");
  });
});

describe("GraficoArtigo: Alternância de cenários e interatividade", () => {
  it("alterna de cenário ao clicar em outra pílula", () => {
    const { container } = render(<GraficoArtigo preset="juros-compostos" />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("false");

    // Clica no cenário "20 anos"
    fireEvent.click(tabs[1]!);

    expect(tabs[0]?.getAttribute("aria-selected")).toBe("false");
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");

    // O indicador deslizante com spring agora está na tab ativa
    const indicador = tabs[1]?.querySelector('[data-layout-id="cenario-grafico-artigo"]');
    expect(indicador).not.toBeNull();

    // Abre a tabela e verifica os dados do novo cenário (20 anos possui até Ano 20)
    const details = container.querySelector("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));

    expect(container.querySelector("table")?.textContent).toContain("Ano 20");
  });

  it("responde a eventos de pointermove e pointerleave sem lançar erros", () => {
    render(<GraficoArtigo preset="pl-setorial" />);

    const img = screen.getByRole("img");
    expect(() => {
      fireEvent.pointerMove(img);
      fireEvent.pointerLeave(img);
    }).not.toThrow();
  });

  it("renderiza corretamente com dados manuais customizados", () => {
    const dadosCustom = [
      { categoria: "A", valor: 100 },
      { categoria: "B", valor: 250 },
    ];
    const seriesCustom = [{ chave: "valor", nome: "Métrica X", cor: "#1e9e63" }];

    const { container } = render(
      <GraficoArtigo
        modo="barras"
        titulo="Gráfico Customizado"
        descricao="Teste de props manuais"
        formato="moeda"
        dados={dadosCustom}
        series={seriesCustom}
        eixoX="categoria"
      />,
    );

    const figcaption = container.querySelector("figcaption");
    expect(figcaption?.textContent).toContain("Gráfico Customizado");
    expect(container.textContent).toContain("Teste de props manuais");
    expect(container.querySelector('[data-modo="barras"]')).not.toBeNull();
  });
});
