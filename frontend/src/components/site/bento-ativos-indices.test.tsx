// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QUANTIDADE_DE_FICHAS, numerosDoBento } from "@/lib/home-dados";
import { DADOS_DE_EXEMPLO } from "@/lib/indices-exemplo";
import { BentoAtivosIndices } from "./bento-ativos-indices";

afterEach(cleanup);

const aoVivo = () => numerosDoBento(DADOS_DE_EXEMPLO);
const fixo = () => numerosDoBento(null);
const secao = () => screen.getByRole("region", { name: "Ativos e índices" });
const quadro = (nome: RegExp) => screen.getByRole("link", { name: nome });

describe("bento Ativos e índices", () => {
  it("tem o id, o h2 e a seção ligada a ele", () => {
    render(<BentoAtivosIndices dados={fixo()} />);
    expect(secao().id).toBe("ativos-e-indices");
    const h2 = screen.getByRole("heading", { level: 2, name: "Ativos e índices" });
    expect(h2.id).toBe("titulo-ativos-indices");
  });

  it("ao vivo mostra o minigráfico do Ibovespa", () => {
    const dados = aoVivo();
    expect(dados.minigraficoIbovespa).not.toBeNull();
    render(<BentoAtivosIndices dados={dados} />);

    expect(within(quadro(/Ibovespa/)).getByRole("img", { name: /Ibovespa/ })).toBeTruthy();
    expect(secao().textContent).toContain("Fontes: Banco Central, IBGE e B3, via Yahoo Finance");
    expect(secao().textContent).toContain("atraso de cerca de 15 minutos");
    expect(secao().textContent).not.toContain("Referência fixa");
  });

  it("na referência fixa não há minigráfico e a fonte diz referência fixa", () => {
    render(<BentoAtivosIndices dados={fixo()} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(secao().textContent).toContain("Referência fixa de 2 de outubro, não atualizada ao vivo");
    expect(secao().textContent).not.toContain("Yahoo Finance");
    expect(secao().textContent).not.toContain("atraso de cerca de 15");
  });

  it("os quadros de Ações, FIIs e ETFs mostram 15, 15 e 10 e levam às listas", () => {
    render(<BentoAtivosIndices dados={fixo()} />);
    expect(QUANTIDADE_DE_FICHAS).toEqual({ acoes: 15, fiis: 15, etfs: 10 });

    const casos = [
      [/^Ações/, "/ativos/acoes", "15 fichas"],
      [/^FIIs/, "/ativos/fiis", "15 fichas"],
      [/^ETFs/, "/ativos/etfs", "10 fichas"],
    ] as const;
    for (const [nome, href, fichas] of casos) {
      const link = quadro(nome);
      expect(link.getAttribute("href")).toBe(href);
      expect(link.textContent).toContain(fichas);
    }
  });

  it("os quadros dos números são links com .interativo para as páginas certas", () => {
    render(<BentoAtivosIndices dados={fixo()} />);
    const casos = [
      [/Ibovespa/, "/ativos/indices/ibovespa"],
      [/^Selic/, "/ativos/indices/selic"],
      [/^IPCA/, "/ativos/indices/ipca"],
      [/^Juro real/, "/ativos/indices/selic"],
      [/^IFIX/, "/ativos/indices/ifix"],
    ] as const;
    for (const [nome, href] of casos) {
      const link = quadro(nome);
      expect(link.getAttribute("href")).toBe(href);
      expect(link.classList.contains("interativo")).toBe(true);
    }
    for (const nome of [/^Ações/, /^FIIs/, /^ETFs/]) expect(quadro(nome).classList.contains("interativo")).toBe(true);
  });

  it("todo quadro tem a explicação de uma frase e nenhuma palavra de recomendação", () => {
    render(<BentoAtivosIndices dados={fixo()} />);
    const links = within(secao()).getAllByRole("link");
    expect(links).toHaveLength(8);
    for (const l of links) {
      expect(l.querySelector("[data-explicacao]")?.textContent?.trim().length).toBeGreaterThan(15);
    }
    expect(secao().textContent).not.toMatch(/compre|melhores|oportunidade|barato|caro\b|recomend/i);
  });

  it("a variação negativa do Ibovespa usa o coral claro: o coral de fundo claro não passa de 4,5:1 sobre o navy", () => {
    const dados = fixo();
    render(
      <BentoAtivosIndices
        dados={{ ...dados, numeros: { ...dados.numeros, ibovespa: { ...dados.numeros.ibovespa, variacaoNoMes: -1.5 } } }}
      />,
    );
    const ibovespa = quadro(/Ibovespa/);
    const variacao = ibovespa.querySelector(".text-loss-on-dark");
    expect(variacao?.textContent).toContain("-1,5%");
    expect(ibovespa.querySelector(".text-loss")).toBeNull();
  });

  it("a variação positiva do Ibovespa segue em esmeralda, com sinal", () => {
    render(<BentoAtivosIndices dados={fixo()} />);
    const variacao = quadro(/Ibovespa/).querySelector(".text-gain");
    expect(variacao?.textContent).toContain("+3,1%");
  });

  it("variação do Ibovespa: com sinal e sem nada quando é nula", () => {
    const dados = fixo();
    const { rerender } = render(<BentoAtivosIndices dados={dados} />);
    expect(quadro(/Ibovespa/).textContent).toContain("+3,1%");
    expect(quadro(/Ibovespa/).textContent).toContain("no mês");

    rerender(
      <BentoAtivosIndices
        dados={{ ...dados, numeros: { ...dados.numeros, ibovespa: { ...dados.numeros.ibovespa, variacaoNoMes: null } } }}
      />,
    );
    expect(quadro(/Ibovespa/).textContent).not.toContain("no mês");
  });
});
