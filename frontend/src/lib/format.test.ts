import { describe, expect, it } from "vitest";
import {
  quantidadeTexto,
  brlOuTraco,
  brl,
  brlComCasas,
  brlSemCentavos,
  contagemCompacta,
  dataCurta,
  mesAno,
  mesCurto,
  multiplo,
  numero,
  pct,
  percentual,
  reaisCompactos,
  tempoRelativo,
  vezesPorExtenso,
} from "./format";

// \s no regex do JS casa também o espaço não-quebrável (U+00A0) que
// toLocaleString("pt-BR", {style:"currency"}) usa entre "R$" e o valor —
// normalizamos para não depender de qual caractere de espaço a ICU escolhe.
const semEspacosEspeciais = (s: string) => s.replace(/\s/g, " ");

describe("brl", () => {
  it("formata em reais com duas casas e separador de milhar", () => {
    expect(semEspacosEspeciais(brl(1234.5))).toBe("R$ 1.234,50");
  });

  it("formata zero", () => {
    expect(semEspacosEspeciais(brl(0))).toBe("R$ 0,00");
  });

  it("formata negativo", () => {
    expect(semEspacosEspeciais(brl(-42))).toBe("-R$ 42,00");
  });
});

describe("brlComCasas", () => {
  it("fixa as casas decimais, no mesmo estilo do brl", () => {
    expect(semEspacosEspeciais(brlComCasas(3.0065, 4))).toBe("R$ 3,0065");
    expect(semEspacosEspeciais(brlComCasas(3, 4))).toBe("R$ 3,0000");
    expect(semEspacosEspeciais(brlComCasas(1234.5, 2))).toBe(semEspacosEspeciais(brl(1234.5)));
  });

  it("usa o mesmo espaço que não separa do brl", () => {
    expect(brlComCasas(1, 2)).toBe(brl(1));
  });
});

describe("brlOuTraco", () => {
  it("mostra o valor em reais, ou traço quando a fonte não informou", () => {
    expect(brlOuTraco(null)).toBe("—");
    expect(brlOuTraco(1234.5)).toBe(brl(1234.5));
  });
});

describe("pct", () => {
  it("prefixa positivo com +", () => {
    expect(pct(12.34)).toBe("+12,3%");
  });

  it("não duplica sinal em negativo", () => {
    expect(pct(-5.67)).toBe("-5,7%");
  });

  it("zero recebe o prefixo +", () => {
    expect(pct(0)).toBe("+0,0%");
  });
});

describe("tempoRelativo", () => {
  it("menos de um minuto: agora", () => {
    expect(tempoRelativo(new Date().toISOString())).toBe("agora");
  });

  it("minutos", () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(tempoRelativo(iso)).toBe("há 5 min");
  });

  it("uma hora exata usa singular", () => {
    const iso = new Date(Date.now() - 60 * 60_000).toISOString();
    expect(tempoRelativo(iso)).toBe("há 1 hora");
  });

  it("horas no plural", () => {
    const iso = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(tempoRelativo(iso)).toBe("há 3 horas");
  });

  it("um dia exato usa singular", () => {
    const iso = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    expect(tempoRelativo(iso)).toBe("há 1 dia");
  });

  it("30 dias ou mais vira data absoluta", () => {
    const iso = new Date(Date.now() - 31 * 24 * 60 * 60_000).toISOString();
    expect(tempoRelativo(iso)).toBe(new Date(iso).toLocaleDateString("pt-BR"));
  });
});

describe("numero", () => {
  it("agrupa milhar com ponto, inclusive em quatro dígitos", () => {
    expect(numero(192115)).toBe("192.115");
    expect(numero(3772)).toBe("3.772");
  });

  it("fixa as casas decimais com vírgula", () => {
    expect(numero(20.84, 1)).toBe("20,8");
    expect(numero(15.1, 1)).toBe("15,1");
  });
});

describe("percentual", () => {
  it("não acrescenta sinal, ao contrário de pct()", () => {
    expect(percentual(7.02)).toBe("7,0%");
    expect(percentual(20.9)).toBe("20,9%");
  });

  it("aceita outras casas, para taxa e variação de índice", () => {
    expect(percentual(13.75, 2)).toBe("13,75%");
    expect(percentual(3.1, 2)).toBe("3,10%");
    expect(percentual(9, 0)).toBe("9%");
  });
});

describe("brlSemCentavos", () => {
  it("formata valor redondo sem os centavos", () => {
    expect(semEspacosEspeciais(brlSemCentavos(1000))).toBe("R$ 1.000");
  });
});

describe("vezesPorExtenso", () => {
  it("escreve a contagem por extenso até doze", () => {
    expect(vezesPorExtenso(1)).toBe("uma vez");
    expect(vezesPorExtenso(4)).toBe("quatro vezes");
  });

  it("acima de doze, usa algarismos", () => {
    expect(vezesPorExtenso(13)).toBe("13 vezes");
  });
});

describe("dataCurta", () => {
  it("troca AAAA-MM-DD por dd/mm/aaaa sem depender do fuso", () => {
    expect(dataCurta("2026-10-09")).toBe("09/10/2026");
    expect(dataCurta("2026-01-01")).toBe("01/01/2026");
  });

  it("ignora a hora quando vem um ISO completo", () => {
    expect(dataCurta("2026-03-20T00:00:00.000Z")).toBe("20/03/2026");
  });
});

describe("reaisCompactos", () => {
  it("usa bilhões a partir de 1 bi e milhões abaixo disso", () => {
    expect(semEspacosEspeciais(reaisCompactos(3.2))).toBe("R$ 3,2 bi");
    expect(semEspacosEspeciais(reaisCompactos(0.7))).toBe("R$ 700 mi");
  });
});

describe("contagemCompacta", () => {
  it("escreve mil e mi em vez do número inteiro", () => {
    expect(contagemCompacta(985_000)).toBe("985 mil");
    expect(contagemCompacta(1_250_000)).toBe("1,3 mi");
    expect(contagemCompacta(430)).toBe("430");
  });
});

describe("multiplo", () => {
  it("escreve o múltiplo com vírgula e o x colado", () => {
    expect(multiplo(0.6)).toBe("0,6x");
    expect(multiplo(2.65, 2)).toBe("2,65x");
  });
});

describe('mesCurto e mesAno', () => {
  it('escrevem o mês em três letras, em português', () => {
    expect(mesCurto('2025-11')).toBe('nov');
    expect(mesCurto('2026-01')).toBe('jan');
    expect(mesAno('2026-10')).toBe('out/2026');
  });
});

describe("quantidadeTexto", () => {
  it("inteira sem casas, fracionária com as que tem, string do Decimal aceita", () => {
    expect(quantidadeTexto(10)).toBe("10");
    expect(quantidadeTexto("10.00000000")).toBe("10");
    expect(quantidadeTexto("0.5")).toBe("0,5");
    expect(quantidadeTexto(1000)).toBe("1.000");
  });
});
