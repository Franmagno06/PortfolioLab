import { describe, expect, it } from "vitest";
import {
  ARMADILHAS,
  DICAS,
  leituraDivida,
  leituraDy,
  leituraDyMensal,
  leituraGestao,
  leituraMargem,
  leituraPl,
  leituraPvpAcao,
  leituraPvpFii,
  leituraRoa,
  leituraRoe,
} from "./indicadores-explicados";

const normalizar = (s: string) => s.replace(/\s/g, " ");

describe("leituras dos indicadores", () => {
  it("P/L: traduz em anos de lucro", () => {
    expect(leituraPl(6.9)).toBe("Pelo preço de hoje, o lucro de cerca de 7 anos pagaria a ação.");
    expect(leituraPl(0.6)).toContain("1 ano ");
  });

  it("P/L: prejuízo e dado ausente têm frase própria", () => {
    expect(leituraPl(-3)).toContain("prejuízo");
    expect(leituraPl(null)).toContain("não está disponível");
  });

  it("P/VP, DY, ROE, margem e ROA falam em reais por R$ 100 ou R$ 1", () => {
    expect(normalizar(leituraPvpAcao(1.3))).toBe("Você paga R$ 1,30 para cada R$ 1,00 de patrimônio contábil da empresa.");
    expect(normalizar(leituraDy(8.4))).toBe("Nos últimos 12 meses, pagou R$ 8,40 de proventos para cada R$ 100 do preço de hoje.");
    expect(normalizar(leituraRoe(18.2))).toBe("De cada R$ 100 do patrimônio, a empresa gerou R$ 18,20 de lucro em um ano.");
    expect(normalizar(leituraMargem(21.5))).toBe("De cada R$ 100 vendidos, R$ 21,50 viram lucro depois de tudo.");
    expect(normalizar(leituraRoa(1.7))).toBe("De cada R$ 100 em ativos, o banco gerou R$ 1,70 de lucro em um ano.");
  });

  it("todo indicador ausente diz que o dado não está disponível", () => {
    for (const frase of [leituraPvpAcao(null), leituraDy(null), leituraRoe(null), leituraMargem(null), leituraRoa(null), leituraDivida(null), leituraPvpFii(null)]) {
      expect(frase).toContain("não está disponível");
    }
  });

  it("dívida/EBITDA: meses abaixo de 1x, anos acima, e caixa maior que a dívida", () => {
    expect(leituraDivida(0.6)).toBe("Em cerca de 7 meses de geração de caixa, a empresa quitaria a dívida líquida.");
    expect(leituraDivida(2.8)).toBe("Em cerca de 2,8 anos de geração de caixa, a empresa quitaria a dívida líquida.");
    expect(leituraDivida(-0.3)).toBe("A empresa tem mais caixa do que dívida.");
  });

  it("FII: rendimento mensal, P/VP e tipo de gestão", () => {
    expect(normalizar(leituraDyMensal(1))).toBe("Em um mês, o fundo pagou R$ 1,00 de rendimento a cada R$ 100 de cota.");
    expect(normalizar(leituraPvpFii(1.01))).toBe("Você paga R$ 1,01 para cada R$ 1,00 do patrimônio do fundo.");
    expect(leituraGestao("Ativa")).toContain("escolhem e trocam");
    expect(leituraGestao("Passiva")).toContain("índice");
  });

  it("FII sem rendimento mensal ou sem tipo de gestão informado diz que o dado não está disponível", () => {
    expect(leituraDyMensal(null)).toContain("não está disponível");
    expect(leituraGestao(null)).toContain("não está disponível");
    expect(leituraGestao("Outra")).toContain("não está disponível");
  });
});

describe("dicas e armadilhas", () => {
  it("toda dica tem nome e texto, e o texto cabe num tooltip curto", () => {
    for (const [id, dica] of Object.entries(DICAS)) {
      expect(dica.rotulo, id).not.toBe("");
      expect(dica.texto.length, id).toBeGreaterThan(20);
      expect(dica.texto.length, id).toBeLessThan(220);
    }
  });

  it("nenhum texto promete retorno nem diz que um ativo é bom ou barato (Resolução CVM 20)", () => {
    const textos = [...Object.values(DICAS).map((d) => d.texto), ...Object.values(ARMADILHAS)].join(" ").toLowerCase();
    for (const proibida of ["recomend", "oportunidade", "compre", "vale a pena", "barato demais", "garantid"]) {
      expect(textos).not.toContain(proibida);
    }
  });

  it("as três armadilhas pedidas existem", () => {
    expect(ARMADILHAS.pl).toContain("distorcer o P/L");
    expect(ARMADILHAS.dyAcao).toContain("preço caindo");
    expect(ARMADILHAS.pvpFii).toContain("P/VP abaixo de 1");
  });
});
