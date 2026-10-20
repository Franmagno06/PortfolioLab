import { describe, expect, it } from "vitest";
import { acharIndice, INDICES, type DadosDosIndices } from "./indices";
import {
  algumIndiceSemDados,
  destaqueDoIndice,
  efeitoNoBolso,
  linhaFixaDoResumo,
  notaDaFonte,
  notaDoUltimoPonto,
  historicoCurtoDoIndice,
  ordenarEFiltrar,
  paragrafoDeHoje,
  tabelaDoIndice,
  variacaoEmMeses,
} from "./indices-dados";
import { DADOS_DE_EXEMPLO } from "./indices-exemplo";

const VAZIO: DadosDosIndices = {
  atualizadoEm: "2026-10-19T12:00:00.000Z",
  hoje: "2026-10-19",
  selicMensal: [],
  ipcaMensal: [],
  cdiMensal: [],
  cdiTaxaMensal: [],
  pontos: { ibovespa: [], ifix: [], smll: [], sp500: [], idiv: [] },
};

describe("algumIndiceSemDados", () => {
  it("com todas as séries, nenhum índice está sem dado", () => {
    expect(algumIndiceSemDados(INDICES, DADOS_DE_EXEMPLO)).toBe(false);
  });

  it("uma série vazia (IPCA) basta para avisar", () => {
    expect(algumIndiceSemDados(INDICES, { ...DADOS_DE_EXEMPLO, ipcaMensal: [] })).toBe(true);
  });

  it("um índice de pontos vazio (IFIX) também avisa", () => {
    const semIfix = { ...DADOS_DE_EXEMPLO, pontos: { ...DADOS_DE_EXEMPLO.pontos, ifix: [] } };
    expect(algumIndiceSemDados(INDICES, semIfix)).toBe(true);
  });

  it("tudo vazio avisa", () => {
    expect(algumIndiceSemDados(INDICES, VAZIO)).toBe(true);
  });
});

describe("contas com os dados por parâmetro", () => {
  it("destaque de índice sem dados mostra travessão", () => {
    const vazio = { ...DADOS_DE_EXEMPLO, pontos: { ...DADOS_DE_EXEMPLO.pontos, ifix: [] } };
    expect(destaqueDoIndice(acharIndice("ifix")!, vazio).valorFormatado).toBe("—");
    expect(variacaoEmMeses("ifix", 12, vazio)).toBeNull();
  });

  it("com todas as séries vazias, nada lança e nenhum número inventado aparece", () => {
    for (const indice of INDICES) {
      const d = destaqueDoIndice(indice, VAZIO);
      expect(d.valorFormatado, indice.slug).toBe("—");
      expect(d.sparkline, indice.slug).toEqual([]);
      expect(d.secundario.texto, indice.slug).toBe("—");
      expect(Number.isFinite(d.variacao12m), indice.slug).toBe(true);
      expect(variacaoEmMeses(indice.slug, 12, VAZIO), indice.slug).toBeNull();
      expect(paragrafoDeHoje(indice, VAZIO), indice.slug).toEqual([]);
      expect(efeitoNoBolso(indice, VAZIO), indice.slug).toBe("");
      expect(tabelaDoIndice(indice, VAZIO), indice.slug).toBeNull();
      expect(notaDoUltimoPonto(indice, VAZIO), indice.slug).toBeUndefined();
      expect(() => linhaFixaDoResumo(indice, VAZIO), indice.slug).not.toThrow();
    }
    expect(ordenarEFiltrar(INDICES, "variacao", null, VAZIO)).toHaveLength(INDICES.length);
  });

  it("índice com um ponto só (IFIX no primeiro dia): valor de hoje, sem variação de 12 meses", () => {
    const dados = { ...DADOS_DE_EXEMPLO, pontos: { ...DADOS_DE_EXEMPLO.pontos, ifix: [{ data: "2026-10-19", valor: 3800 }] } };
    const d = destaqueDoIndice(acharIndice("ifix")!, dados);
    expect(d.valor).toBe(3800);
    expect(d.valorFormatado).toBe("3.800");
    expect(d.secundario).toEqual({ rotulo: "Últimos 12 meses", texto: "—", variacao: null });
    expect(d.sparkline).toEqual([3800]);
    expect(variacaoEmMeses("ifix", 12, dados)).toBeNull();
  });

  it("na ordem por variação, índice sem dados vai para o fim", () => {
    const dados = { ...DADOS_DE_EXEMPLO, pontos: { ...DADOS_DE_EXEMPLO.pontos, idiv: [] } };
    expect(ordenarEFiltrar(INDICES, "variacao", null, dados).at(-1)?.slug).toBe("idiv");
  });

  it("CDI: a taxa de hoje é o último ponto de cdiTaxaMensal, e o mês parcial não entra no ano nem nos 12 meses", () => {
    const meses = Array.from({ length: 21 }, (_, i) => {
      const n = i + 1; // 2025-02 .. 2026-10
      const ano = 2025 + Math.floor(n / 12);
      const mes = (n % 12) + 1;
      return `${ano}-${String(mes).padStart(2, "0")}`;
    });
    expect(meses[0]).toBe("2025-02");
    expect(meses.at(-1)).toBe("2026-10");
    const dados: DadosDosIndices = {
      ...VAZIO,
      hoje: "2026-10-19",
      // 1% em cada mês fechado; outubro (parcial) com 50%, que estragaria qualquer conta se entrasse
      cdiMensal: meses.map((data) => ({ data, valor: data === "2026-10" ? 50 : 1 })),
      cdiTaxaMensal: meses.map((data) => ({ data, valor: data === "2026-10" ? 14.9 : 14 })),
    };
    const cdi = acharIndice("cdi")!;
    const d = destaqueDoIndice(cdi, dados);
    expect(d.valorFormatado).toBe("14,90% a.a.");
    // 12 meses fechados (2025-10 a 2026-09) de 1%: 12,68%
    expect(d.secundario).toEqual({ rotulo: "Rendeu em 12 meses", texto: "12,68%", variacao: null });
    // 2026 até setembro: 9 meses de 1% = 9,37%; 2025 (fev a dez): 11 meses = 11,57%
    const texto = paragrafoDeHoje(cdi, dados).map((t) => (typeof t === "string" ? t : t.forte)).join("");
    expect(texto).toContain("14,90% ao ano");
    expect(texto).toContain("Em 2026, até setembro, o acumulado é de 9,37%");
    expect(texto).toContain("em 2025 inteiro, foi de 11,57%");
    expect(notaDoUltimoPonto(cdi, dados)).toBe("até setembro");
    expect(tabelaDoIndice(cdi, dados)?.linhas[0]?.celulas[1]?.texto).toBe("9,37%");
  });

  it("IPCA: o último mês da tabela e do texto é o último de ipcaMensal", () => {
    const ipca = acharIndice("ipca")!;
    const ultimo = DADOS_DE_EXEMPLO.ipcaMensal.at(-1)!;
    expect(linhaFixaDoResumo(ipca, DADOS_DE_EXEMPLO)).toEqual({ rotulo: "IPCA de setembro", texto: "0,82%" });
    expect(ultimo.data).toBe("2026-09");
    const semSetembro = { ...DADOS_DE_EXEMPLO, ipcaMensal: DADOS_DE_EXEMPLO.ipcaMensal.slice(0, -1) };
    expect(linhaFixaDoResumo(ipca, semSetembro).rotulo).toBe("IPCA de agosto");
    expect(tabelaDoIndice(ipca, semSetembro)?.linhas[0]?.chave).toBe("2026-08");
  });
});

describe("nota da fonte e histórico curto", () => {
  it("diz a fonte e a data do último ponto: dia para pontos, mês para taxas", () => {
    const ibov = acharIndice("ibovespa")!;
    const ultimo = DADOS_DE_EXEMPLO.pontos.ibovespa.at(-1)!;
    const [ano, mes, dia] = ultimo.data.split("-");
    expect(notaDaFonte(ibov, DADOS_DE_EXEMPLO)).toBe(`Fonte: B3 (Ibovespa), via Yahoo Finance. Dados até ${dia}/${mes}/${ano}.`);
    expect(notaDaFonte(acharIndice("ipca")!, DADOS_DE_EXEMPLO)).toBe(
      "Fonte: IBGE, via Banco Central (SGS 13522 e 433). Dados até 09/2026.",
    );
  });

  it("sem nenhum ponto, só a fonte, sem inventar data", () => {
    expect(notaDaFonte(acharIndice("ifix")!, VAZIO)).toBe("Fonte: B3 (IFIX), via Yahoo Finance.");
  });

  it("histórico curto: só índice de pontos com um único ponto, com a data desse ponto", () => {
    const um = { ...DADOS_DE_EXEMPLO, pontos: { ...DADOS_DE_EXEMPLO.pontos, ifix: [{ data: "2026-10-19", valor: 3800 }] } };
    expect(historicoCurtoDoIndice(acharIndice("ifix")!, um)).toEqual({ desde: "19/10/2026" });
    expect(historicoCurtoDoIndice(acharIndice("ibovespa")!, um)).toBeUndefined();
    expect(historicoCurtoDoIndice(acharIndice("ifix")!, VAZIO)).toBeUndefined();
    expect(historicoCurtoDoIndice(acharIndice("selic")!, VAZIO)).toBeUndefined();
  });
});

describe("valores em reais das fichas passam por format.brl", () => {
  const semEspacosEspeciais = (s: string) => s.replace(/ /g, " ");

  it("efeito no bolso do IPCA e do CDI em reais com centavos", () => {
    const ipca = semEspacosEspeciais(efeitoNoBolso(acharIndice("ipca")!, DADOS_DE_EXEMPLO));
    const cdi = semEspacosEspeciais(efeitoNoBolso(acharIndice("cdi")!, DADOS_DE_EXEMPLO));

    expect(ipca).toMatch(/o que custava R\$ 100,00 há um ano custa cerca de R\$ \d{3},\d{2} hoje/);
    expect(cdi).toMatch(/R\$ 1\.000,00 num título que paga 100% do CDI viram cerca de R\$ 1\.\d{3},\d{2} em um ano/);
  });
});
