import { Prisma } from "@prisma/client";
import type { ResultadoTrimestralGuardado } from "../ativos/ativos.tipos.js";

/**
 * P/L, P/VP, ROE e ROA de uma ação calculados com as demonstrações que a companhia entregou à CVM
 * (ITR e DFP) e o preço do Yahoo (v8/chart). É a alternativa para quando o quoteSummary do Yahoo não
 * responde, o que acontece sempre no servidor de produção (o Yahoo recusa cookie e crumb a IP de
 * datacenter). Pura: sem rede e sem banco. Os trimestres vêm da fotografia CVM_RESULTS que as
 * páginas de Ativos já guardam, então nenhum zip da CVM é lido aqui.
 *
 * Fórmulas (todas em Decimal até a saída):
 *  - lucro 12m = soma do lucro líquido dos 4 trimestres consecutivos mais recentes (atribuído aos
 *    controladores quando a companhia informa; o 4º trimestre é a DFP menos os três ITRs do ano);
 *  - patrimônio = PL consolidado da data-base mais recente menos a participação dos não controladores;
 *  - ações = capital integralizado menos as ações em tesouraria, na data-base mais recente, divididas
 *    pelo número de ações de cada papel (3 na unit TAEE11). Ação ON e PN contam igual, como no LPA;
 *  - P/L  = preço ÷ (lucro 12m ÷ ações). Negativo quando houve prejuízo: é um número legítimo;
 *  - P/VP = preço ÷ (patrimônio ÷ ações);
 *  - ROE  = lucro 12m ÷ patrimônio × 100, sobre o patrimônio da data-base (não a média do ano);
 *  - ROA  = lucro 12m ÷ ativo total × 100.
 *
 * O que não se calcula vira null, nunca um número aproximado: menos de 4 trimestres (P/L, ROE, ROA),
 * patrimônio zero ou negativo (P/VP e ROE, e também P/L, porque sem patrimônio a escala das ações
 * não se resolve; ver `acoesPorPapel`), lucro 12m igual a zero (P/L), ações ou preço ausentes.
 */

export type IndicadoresDaCvm = {
  pl: number | null;
  pvp: number | null;
  /** Pontos percentuais. */
  roe: number | null;
  /** Pontos percentuais. */
  roa: number | null;
};

const CEM = new Prisma.Decimal(100);
const MIL = new Prisma.Decimal(1000);

/**
 * Faixa de P/VP usada só para decidir a escala da quantidade de ações (ver `acoesPorPapel`). As duas
 * escalas possíveis diferem por 1000x, e a faixa [0,03; 30) também cobre um fator 1000: no máximo uma
 * delas cai dentro. Nenhuma companhia listada com patrimônio positivo negocia fora dela.
 */
const PVP_MINIMO_PLAUSIVEL = new Prisma.Decimal("0.03");
const PVP_MAXIMO_PLAUSIVEL = new Prisma.Decimal(30);

// As colunas de asset_indicators: pl e pvp são Decimal(10,2), roe e roa Decimal(7,2). Lucro perto de
// zero faria um P/L de bilhões, que estouraria a coluna e derrubaria a gravação inteira.
const LIMITE_DO_MULTIPLO = new Prisma.Decimal("99999999.99");
const LIMITE_DO_PERCENTUAL = new Prisma.Decimal("99999.99");

function saida(valor: Prisma.Decimal | null, limite: Prisma.Decimal): number | null {
  if (!valor) return null;
  const arredondado = valor.toDecimalPlaces(2);
  return arredondado.abs().gt(limite) ? null : arredondado.toNumber();
}

const decimalOuNulo = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? new Prisma.Decimal(n) : null;

/**
 * Quantas "unidades do papel negociado" a companhia tem: ações em circulação ÷ ações por papel.
 *
 * O arquivo de composição do capital da CVM não diz a escala da quantidade: cada companhia declara em
 * unidades ou em milhares (Petrobras 12.888.732.761; Vale 4.262.534, que são 4,26 bilhões). A escala
 * certa é a única, entre ×1 e ×1000, que deixa o P/VP numa faixa plausível. Se nenhuma ou as duas
 * deixarem, devolve null em vez de chutar. Exige patrimônio positivo e preço.
 */
export function acoesPorPapel(
  acoesTotal: Prisma.Decimal,
  acoesEmTesouraria: Prisma.Decimal,
  acoesPorUnidade: number,
  patrimonio: Prisma.Decimal,
  preco: Prisma.Decimal,
): Prisma.Decimal | null {
  const emCirculacao = acoesTotal.minus(acoesEmTesouraria);
  if (!emCirculacao.gt(0) || !patrimonio.gt(0) || !preco.gt(0) || !(acoesPorUnidade > 0)) return null;

  const candidatas = [new Prisma.Decimal(1), MIL]
    .map((escala) => emCirculacao.mul(escala).div(acoesPorUnidade))
    .filter((acoes) => {
      const pvp = preco.mul(acoes).div(patrimonio);
      return pvp.gte(PVP_MINIMO_PLAUSIVEL) && pvp.lt(PVP_MAXIMO_PLAUSIVEL);
    });
  return candidatas.length === 1 ? (candidatas[0] ?? null) : null;
}

export function calcularIndicadoresPelaCvm(entrada: {
  /** Preço do papel, do Yahoo v8/chart. Null se a cotação falhou: aí só ROE e ROA saem. */
  preco: number | null;
  /** Do mais antigo para o mais novo, como a fotografia CVM_RESULTS guarda. */
  trimestres: ResultadoTrimestralGuardado[];
  /** 1 para ON e PN; o número de ações da unit; null se é unit de composição desconhecida. */
  acoesPorUnidade: number | null;
}): IndicadoresDaCvm | null {
  const ultimo = entrada.trimestres.at(-1);
  if (!ultimo) return null;

  const lucro12m =
    entrada.trimestres.length === 4
      ? entrada.trimestres.reduce<Prisma.Decimal | null>((soma, t) => {
          const lucro = decimalOuNulo(t.lucroLiquido);
          return soma && lucro ? soma.plus(lucro) : null;
        }, new Prisma.Decimal(0))
      : null;

  const patrimonio = decimalOuNulo(ultimo.patrimonioDosControladores);
  const patrimonioPositivo = patrimonio && patrimonio.gt(0) ? patrimonio : null;
  const ativoTotal = decimalOuNulo(ultimo.ativoTotal);
  const preco = decimalOuNulo(entrada.preco);
  const acoesTotal = decimalOuNulo(ultimo.acoesTotal);
  const tesouraria = decimalOuNulo(ultimo.acoesEmTesouraria) ?? new Prisma.Decimal(0);

  const acoes =
    acoesTotal && patrimonioPositivo && preco && entrada.acoesPorUnidade !== null
      ? acoesPorPapel(acoesTotal, tesouraria, entrada.acoesPorUnidade, patrimonioPositivo, preco)
      : null;

  // preço ÷ (lucro ÷ ações) = preço × ações ÷ lucro: uma divisão só, pelo divisor já conferido
  const pl = preco && acoes && lucro12m && !lucro12m.isZero() ? preco.mul(acoes).div(lucro12m) : null;
  const pvp = preco && acoes && patrimonioPositivo ? preco.mul(acoes).div(patrimonioPositivo) : null;
  const roe = lucro12m && patrimonioPositivo ? lucro12m.div(patrimonioPositivo).mul(CEM) : null;
  const roa = lucro12m && ativoTotal && ativoTotal.gt(0) ? lucro12m.div(ativoTotal).mul(CEM) : null;

  const resultado = {
    pl: saida(pl, LIMITE_DO_MULTIPLO),
    pvp: saida(pvp, LIMITE_DO_MULTIPLO),
    roe: saida(roe, LIMITE_DO_PERCENTUAL),
    roa: saida(roa, LIMITE_DO_PERCENTUAL),
  };
  return Object.values(resultado).every((v) => v === null) ? null : resultado;
}
