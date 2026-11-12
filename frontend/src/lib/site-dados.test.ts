import { describe, expect, it } from "vitest";
import { ipcaEm12Meses, variacaoPct, type DadosDosIndices } from "./indices";
import { DADOS_DE_EXEMPLO } from "./indices-exemplo";
import {
  ATIVO_DE_EXEMPLO,
  atende,
  CRITERIOS_DE_EXEMPLO,
  fraseDoJuroReal,
  juroReal,
  juroRealLiquido,
  NUMEROS_DO_MES,
  numerosDoMes,
} from "./site-dados";

describe("juroReal", () => {
  it("desconta a inflação pela fórmula de Fisher, não pela subtração", () => {
    const real = juroReal(13.75, 4.22);

    expect(real).toBeGreaterThan(9.1);
    expect(real).toBeLessThan(9.2);
    // a subtração simples daria 9,53: a diferença é o motivo de usar Fisher
    expect(real).toBeLessThan(13.75 - 4.22);
  });

  it("dá zero quando a taxa empata com a inflação", () => {
    expect(juroReal(5, 5)).toBeCloseTo(0, 10);
  });

  it("com o IPCA de setembro de 2026 (4,58%) o juro real fica em 8,77%", () => {
    expect(juroReal(13.75, 4.58).toFixed(2)).toBe("8.77");
  });

});

describe("atende", () => {
  it("confere os três critérios de exemplo contra a empresa fictícia", () => {
    const resultados = CRITERIOS_DE_EXEMPLO.map((c) => atende(ATIVO_DE_EXEMPLO, c));

    // ROE 20 > 15; DY 6 não é > 6 (acima é estritamente acima); P/VP 2 não é < 1,5
    expect(resultados).toEqual([true, false, false]);
  });

  it("o limite exato não atende: acima é estritamente acima", () => {
    expect(
      atende(ATIVO_DE_EXEMPLO, { rotulo: "x", campo: "roe", comparacao: "acima", limite: 20 }),
    ).toBe(false);
  });
});

describe("ATIVO_DE_EXEMPLO: empresa fictícia, contas que fecham", () => {
  const a = ATIVO_DE_EXEMPLO;

  it("é fictícia e diz isso: sem ticker, sem data, sem fonte de mercado", () => {
    expect(a.nome).toBe("Empresa Exemplo S.A.");
    expect(a.aviso).toBe("empresa fictícia, números ilustrativos");
    expect(a.fonte).toBe("valores ilustrativos, inventados para este exemplo");
    expect("ticker" in a).toBe(false);
    const textos = JSON.stringify(a);
    expect(textos).not.toMatch(/\d{1,2} de [a-zç]+ de \d{4}|\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/);
    expect(textos).not.toMatch(/[A-Z]{4}\d{1,2}\b/); // nada com cara de ticker da B3
  });

  it("os valores por ação saem dos totais", () => {
    expect(a.lucroLiquido / a.acoes).toBe(a.lucroPorAcao);
    expect(a.patrimonioLiquido / a.acoes).toBe(a.valorPatrimonialPorAcao);
  });

  it("preço ÷ lucro por ação dá o P/L, e preço ÷ patrimônio por ação dá o P/VP", () => {
    expect(a.preco / a.lucroPorAcao).toBe(a.pl);
    expect(a.preco / a.valorPatrimonialPorAcao).toBe(a.pvp);
  });

  it("ROE, margem e dívida/EBITDA saem dos totais", () => {
    expect((a.lucroLiquido / a.patrimonioLiquido) * 100).toBe(a.roe);
    expect((a.lucroLiquido / a.receitaLiquida) * 100).toBe(a.margemLiquida);
    expect(a.dividaLiquida / a.ebitda).toBe(a.dividaEbitda);
    // o ROE também fecha com os valores por ação: 4 ÷ 20
    expect((a.lucroPorAcao / a.valorPatrimonialPorAcao) * 100).toBe(a.roe);
  });

  it("os proventos de 12 meses somam o valor por ação e dão o DY", () => {
    const somaCentavos = a.proventos12m.valores.reduce((s, v) => s + Math.round(v * 100), 0);
    expect(somaCentavos).toBe(Math.round(a.proventos12m.porUnidade * 100));
    expect(a.proventos12m.valores).toHaveLength(a.proventos12m.pagamentos);
    expect((Math.round(a.proventos12m.porUnidade * 100) / Math.round(a.preco * 100)) * 100).toBeCloseTo(a.dy12m, 10);
  });
});

describe("numerosDoMes", () => {
  const ibov = DADOS_DE_EXEMPLO.pontos.ibovespa;
  const ultimo = ibov[ibov.length - 1]!;
  const mesDoUltimo = ultimo.data.slice(0, 7);
  const doMesAnterior = ibov.filter((p) => p.data.slice(0, 7) < mesDoUltimo);
  const baseDoMesAnterior = doMesAnterior[doMesAnterior.length - 1]!;

  it("sem dados cai nos números fixos e diz que não são ao vivo", () => {
    const n = numerosDoMes(null);

    expect(n.aoVivo).toBe(false);
    expect(n.selic).toBe(13.75);
    expect(n.ibovespa.pontos).toBe(NUMEROS_DO_MES.ibovespa.pontos);
    expect(n.fechamento).toBe(NUMEROS_DO_MES.fechamento);
  });

  it("com dados, lê o último ponto de cada série", () => {
    const n = numerosDoMes(DADOS_DE_EXEMPLO);
    const selic = DADOS_DE_EXEMPLO.selicMensal;
    const ipca12 = ipcaEm12Meses(DADOS_DE_EXEMPLO.ipcaMensal);
    const ifix = DADOS_DE_EXEMPLO.pontos.ifix;

    expect(n.aoVivo).toBe(true);
    expect(n.selic).toBe(selic[selic.length - 1]!.valor);
    expect(n.ipca12m).toBe(ipca12[ipca12.length - 1]!.valor);
    expect(n.ibovespa.pontos).toBe(ultimo.valor);
    expect(n.ifix.pontos).toBe(ifix[ifix.length - 1]!.valor);
  });

  it("a variação no mês é contra o último ponto do mês anterior, com 2 casas", () => {
    const esperado = Math.round(variacaoPct(baseDoMesAnterior.valor, ultimo.valor)! * 100) / 100;

    expect(numerosDoMes(DADOS_DE_EXEMPLO).ibovespa.variacaoNoMes).toBe(esperado);
  });

  it("escreve a data do último pregão e deriva os meses dela", () => {
    const n = numerosDoMes(DADOS_DE_EXEMPLO);
    const [, mm, dd] = ultimo.data.split("-");

    expect(n.fechamentoCurto).toBe(`${Number(dd)}/${Number(mm)}`);
    expect(n.fechamento.startsWith(`${Number(dd)} de `)).toBe(true);
    expect(n.rotulo).toBe(`${n.mes} de ${ultimo.data.slice(0, 4)}`);
    expect(n.mesAnterior).not.toBe(n.mes);
  });

  it("sem ponto no mês anterior não inventa variação", () => {
    const soODoMes: DadosDosIndices = {
      ...DADOS_DE_EXEMPLO,
      pontos: { ...DADOS_DE_EXEMPLO.pontos, ibovespa: [ultimo] },
    };
    const n = numerosDoMes(soODoMes);

    expect(n.aoVivo).toBe(true);
    expect(n.ibovespa.pontos).toBe(ultimo.valor);
    expect(n.ibovespa.variacaoNoMes).toBeNull();
  });

  it("base zero no mês anterior também não vira variação", () => {
    const zerado: DadosDosIndices = {
      ...DADOS_DE_EXEMPLO,
      pontos: { ...DADOS_DE_EXEMPLO.pontos, ibovespa: [{ data: "2026-09-30", valor: 0 }, ultimo] },
    };

    expect(numerosDoMes(zerado).ibovespa.variacaoNoMes).toBeNull();
  });

  it("sem Ibovespa devolve o conjunto fixo inteiro: é ele que dá a data do parágrafo", () => {
    const n = numerosDoMes({ ...DADOS_DE_EXEMPLO, pontos: { ...DADOS_DE_EXEMPLO.pontos, ibovespa: [] } });

    expect(n.aoVivo).toBe(false);
    expect(n.selic).toBe(NUMEROS_DO_MES.selic);
    expect(n.fechamento).toBe(NUMEROS_DO_MES.fechamento);
    expect(n.fixos).toBeUndefined();
  });

  it("com tudo ao vivo, nenhum indicador é marcado como fixo", () => {
    expect(numerosDoMes(DADOS_DE_EXEMPLO).fixos).toEqual({ selic: false, ipca: false, ifix: false });
  });

  describe("um indicador sem dado cai sozinho no número fixo, marcado, e o resto segue ao vivo", () => {
    const vivo = numerosDoMes(DADOS_DE_EXEMPLO);

    it("sem Selic", () => {
      const n = numerosDoMes({ ...DADOS_DE_EXEMPLO, selicMensal: [] });

      expect(n.aoVivo).toBe(true);
      expect(n.fixos).toEqual({ selic: true, ipca: false, ifix: false });
      expect(n.selic).toBe(NUMEROS_DO_MES.selic);
      expect(n.ipca12m).toBe(vivo.ipca12m);
      expect(n.ibovespa).toEqual(vivo.ibovespa);
      expect(n.fechamento).toBe(vivo.fechamento); // a data do parágrafo continua a do Ibovespa ao vivo
    });

    it.each([
      ["série vazia", []],
      ["menos de 12 meses, que não fecham a conta de 12 meses", DADOS_DE_EXEMPLO.ipcaMensal.slice(0, 5)],
    ])("sem IPCA (%s): o valor e o mês de referência vêm juntos do conjunto fixo", (_nome, ipcaMensal) => {
      const n = numerosDoMes({ ...DADOS_DE_EXEMPLO, ipcaMensal });

      expect(n.aoVivo).toBe(true);
      expect(n.fixos).toEqual({ selic: false, ipca: true, ifix: false });
      expect(n.ipca12m).toBe(NUMEROS_DO_MES.ipca12m);
      expect(n.ipcaReferencia).toBe(NUMEROS_DO_MES.ipcaReferencia);
      expect(n.selic).toBe(vivo.selic);
    });

    it("sem IFIX", () => {
      const n = numerosDoMes({ ...DADOS_DE_EXEMPLO, pontos: { ...DADOS_DE_EXEMPLO.pontos, ifix: [] } });

      expect(n.aoVivo).toBe(true);
      expect(n.fixos).toEqual({ selic: false, ipca: false, ifix: true });
      expect(n.ifix.pontos).toBe(NUMEROS_DO_MES.ifix.pontos);
      expect(n.ibovespa).toEqual(vivo.ibovespa);
    });
  });
});

describe("numerosDoMes: pregão em andamento", () => {
  const comIbov = (hoje: string, ibovespa: { data: string; valor: number }[]): DadosDosIndices => ({
    ...DADOS_DE_EXEMPLO,
    hoje,
    pontos: { ...DADOS_DE_EXEMPLO.pontos, ibovespa },
  });

  it("último ponto com a data de hoje: intradiário (não é fechamento)", () => {
    const n = numerosDoMes(
      comIbov("2026-10-19", [
        { data: "2026-09-30", valor: 190000 },
        { data: "2026-10-16", valor: 195000 },
        { data: "2026-10-19", valor: 196000 },
      ]),
    );

    expect(n.aoVivo).toBe(true);
    expect(n.intradiario).toBe(true);
    expect(n.fechamento).toBe("19 de outubro");
    // a conta da variação continua contra o último ponto de setembro
    expect(n.ibovespa.variacaoNoMes).toBe(3.16);
  });

  it("último ponto de ontem: fechamento", () => {
    const n = numerosDoMes(
      comIbov("2026-10-20", [
        { data: "2026-09-30", valor: 190000 },
        { data: "2026-10-19", valor: 196000 },
      ]),
    );

    expect(n.intradiario).toBe(false);
    expect(n.fechamento).toBe("19 de outubro");
  });

  it("sábado com o último pregão na sexta: fechamento", () => {
    const n = numerosDoMes(
      comIbov("2026-10-24", [
        { data: "2026-09-30", valor: 190000 },
        { data: "2026-10-23", valor: 197000 },
      ]),
    );

    expect(n.intradiario).toBe(false);
    expect(n.fechamento).toBe("23 de outubro");
  });

  it("o conjunto fixo nunca é intradiário", () => {
    expect(numerosDoMes(null).intradiario).toBe(false);
  });
});

describe("juroRealLiquido", () => {
  it("13,75% com 15% de IR viram 11,6875% líquidos, e o juro real cai para 6,80%", () => {
    expect(juroRealLiquido(13.75, 4.58).toFixed(2)).toBe("6.80");
    expect(juroReal(13.75 * 0.85, 4.58)).toBeCloseTo(juroRealLiquido(13.75, 4.58), 12);
  });
});

describe("fraseDoJuroReal", () => {
  const juntar = (f: { antes: string; destaque: string; depois: string }) => f.antes + f.destaque + f.depois;

  it("juro real positivo (13,75% e 4,58%): perto de 9% antes do imposto e de 7% depois de 15% de IR", () => {
    const f = fraseDoJuroReal(13.75, 4.58);
    expect(f.destaque).toBe("perto de 9% ao ano antes do imposto");
    expect(juntar(f)).toBe(
      "Descontada a inflação, a Selic de hoje paga perto de 9% ao ano antes do imposto (perto de 7% depois de 15% de IR, a menor alíquota da renda fixa). Taxa passada não garante a futura.",
    );
    expect(juntar(f)).not.toContain("régua");
  });

  it("os números do conjunto fixo dão os mesmos 9% e 7%", () => {
    expect(Math.round(juroReal(NUMEROS_DO_MES.selic, NUMEROS_DO_MES.ipca12m))).toBe(9);
    expect(Math.round(juroRealLiquido(NUMEROS_DO_MES.selic, NUMEROS_DO_MES.ipca12m))).toBe(7);
  });

  it("positivo antes do IR e negativo depois: diz que fica abaixo da inflação depois do imposto", () => {
    const f = fraseDoJuroReal(5.5, 5);
    expect(f.destaque).toBe("menos de 1% ao ano antes do imposto");
    expect(f.depois).toBe(" (abaixo da inflação depois de 15% de IR, a menor alíquota da renda fixa). Taxa passada não garante a futura.");
  });

  it("juro real zero: não cobre a inflação, sem '-0'", () => {
    const f = fraseDoJuroReal(5, 5);
    expect(f.destaque).toBe("não cobre a inflação");
    expect(juntar(f)).not.toContain("-0");
    expect(f.depois).toBe(": o juro real está em 0,0% ao ano, antes do imposto. Taxa passada não garante a futura.");
  });

  it("juro real negativo: não cobre a inflação e mostra o número negativo", () => {
    const f = fraseDoJuroReal(4, 6);
    expect(f.destaque).toBe("não cobre a inflação");
    expect(f.depois).toBe(": o juro real está em -1,9% ao ano, antes do imposto. Taxa passada não garante a futura.");
    expect(juntar(f)).not.toContain("régua");
  });

  it("negativo pequeno que arredonda para zero não vira '-0,0%'", () => {
    const f = fraseDoJuroReal(5, 5.02);
    expect(f.depois).toContain(": o juro real está em 0,0% ao ano");
  });

  it("positivo abaixo de meio ponto: não diz 'perto de 0%'", () => {
    const f = fraseDoJuroReal(5.3, 5);
    expect(f.destaque).toBe("menos de 1% ao ano antes do imposto");
  });
});
