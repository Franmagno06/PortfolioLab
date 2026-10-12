import { Prisma, type AssetIndicator } from "@prisma/client";
import { buscarIndicadoresFundamentalistas, buscarProventosOuNulo } from "../quotes/quotes.provider.js";
import { indicatorsRepository } from "./indicators.repository.js";

function numeroOuNulo(d: Prisma.Decimal | null | undefined): number | null {
  return d ? d.toNumber() : null;
}

/**
 * Bancos não usam margem líquida como indicador de referência — a estrutura
 * de receita (juros, tarifas) torna a métrica pouco comparável com empresas
 * não-financeiras. O padrão de mercado é olhar ROE/ROA. A tela troca a
 * coluna "Margem líquida" por ROA quando o setor bate esta detecção.
 */
export function industriaEhBanco(industria: string | null): boolean {
  return industria !== null && /banks?/i.test(industria);
}

const DOZE_MESES_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Soma os proventos por cota. É dinheiro, então a soma é em Decimal: com `number`,
 * 0,1 + 0,2 dá 0,30000000000000004, e o erro cresce a cada parcela.
 */
export function somarProventos(proventos: { valorPorCota: number }[]): number {
  return proventos.reduce((soma, p) => soma.plus(p.valorPorCota), new Prisma.Decimal(0)).toNumber();
}

/**
 * Dividend Yield = soma dos proventos por cota pagos nos últimos 12 meses
 * ÷ preço atual. Os proventos são os do PRÓPRIO ativo, direto do Yahoo
 * (ver atualizarIndicador), e não o campo `dividendYield` dele — o motivo
 * está em quotes.provider.ts.
 */
export function calcularDividendYield(
  somaProventosUltimos12Meses: number,
  precoAtual: number | null,
): number | null {
  if (!precoAtual || precoAtual <= 0) return null;
  return (somaProventosUltimos12Meses / precoAtual) * 100;
}

// Fundamentos (lucro, patrimônio, proventos) mudam bem mais devagar que uma
// cotação — 24h evita bater no Yahoo a cada leitura da tela, e ainda assim
// mantém o cache no máximo um dia desatualizado, sem depender de alguém
// lembrar de rodar o job manual.
const VALIDADE_MS = 24 * 60 * 60 * 1000;

/**
 * Indicador gravado antes desta data tem o Dividend Yield do cálculo antigo (soma dos proventos que
 * algum usuário importou, que dava 0,00% para ativo que ninguém sincronizou). Ele seria servido como
 * "ok" por até 24h depois do deploy. Tratá-lo como vencido força a renovação na primeira leitura, sem
 * mexer em dado nenhum no banco: a regra se aposenta sozinha, quando todos já foram renovados.
 */
export const DY_CALCULADO_PELO_ATIVO_DESDE = new Date("2026-10-12T00:00:00.000Z");

/** Vencido (mais de 24h), do cálculo antigo do DY, ou nunca calculado. As páginas de Ativos usam a mesma regra. */
export function estaDesatualizado(indicator: Pick<AssetIndicator, "updatedAt"> | null): boolean {
  if (!indicator) return true; // job nunca rodou para este ativo
  if (indicator.updatedAt < DY_CALCULADO_PELO_ATIVO_DESDE) return true;
  return Date.now() - indicator.updatedAt.getTime() > VALIDADE_MS;
}

/**
 * Busca os fundamentos de UM ativo no Yahoo, calcula o Dividend Yield a
 * partir dos proventos dos últimos 12 meses do próprio ativo (também do Yahoo)
 * e grava no cache. Devolve null sem gravar nada se o provedor estiver fora do
 * ar — mantém o cache anterior, do jeito que existir, em vez de apagar um dado
 * bom por causa de uma falha pontual de rede.
 *
 * O Dividend Yield tem a mesma regra por campo: se só a consulta de proventos
 * falhou, o DY que já estava gravado fica como está. "Zero" é um valor (a empresa
 * não pagou nada em 12 meses); "não consegui perguntar" não pode virar zero.
 *
 * Antes, o DY somava os proventos que algum usuário tivesse importado. Um ativo que
 * ninguém sincronizou saía com 0,00%, e o de quem sincronizou dependia da data do clique.
 */
export async function atualizarIndicador(asset: {
  id: string;
  ticker: string;
}): Promise<AssetIndicator | null> {
  const indicadores = await buscarIndicadoresFundamentalistas(asset.ticker);
  if (!indicadores) return null;

  const proventos = await buscarProventosOuNulo(asset.ticker, new Date(Date.now() - DOZE_MESES_MS));

  const { precoAtual, ...campos } = indicadores;

  // Sem proventos (a consulta falhou) OU sem preço (o Yahoo veio sem regularMarketPrice), o DY não é
  // calculável: a chave fica de fora e o que já estava gravado é preservado. Gravar null apagaria um
  // DY bom por 24h por causa de uma resposta incompleta.
  const dividendYield = proventos === null ? null : calcularDividendYield(somarProventos(proventos), precoAtual);
  return indicatorsRepository.upsert(asset.id, {
    ...campos,
    ...(dividendYield === null ? {} : { dividendYield }),
  });
}

export type IndicadorDeAtivo = {
  ticker: string;
  name: string;
  pl: number | null;
  pvp: number | null;
  dividendYield: number | null;
  roe: number | null;
  roa: number | null;
  margemLiquida: number | null;
  /** Dívida líquida ÷ EBITDA, em vezes. Null para banco e quando o provedor não informa. */
  dividaEbitda: number | null;
  /** true = a tela deve mostrar ROA no lugar de margem líquida (padrão de mercado para bancos). */
  setorBancario: boolean;
  /** Quando os valores foram calculados pela última vez. Null se ainda não há cache. */
  atualizadoEm: string | null;
};

export const indicatorsService = {
  /**
   * Indicadores fundamentalistas das ações que o usuário tem na carteira.
   *
   * Refresh preguiçoso, no molde de quotesService.resolverPrecos: só busca
   * no Yahoo o que estiver ausente ou vencido (mais de 24h), sequencialmente
   * — não em paralelo — porque o Yahoo bloqueia rajada de requisições sem
   * chave. Uma falha pontual num ativo (rede, DB) não derruba a leitura dos
   * demais nem da carteira inteira.
   */
  async getIndicadoresDaCarteira(userId: string): Promise<IndicadorDeAtivo[]> {
    const ativos = await indicatorsRepository.ativosAcaoDoUsuario(userId);

    for (const asset of ativos) {
      if (!estaDesatualizado(asset.indicator)) continue;
      try {
        const atualizado = await atualizarIndicador(asset);
        if (atualizado) asset.indicator = atualizado;
      } catch {
        // segue com o cache anterior (ou null) — não deixa uma falha pontual
        // derrubar a leitura dos outros ativos
      }
    }

    return ativos.map((asset) => ({
      ticker: asset.ticker,
      name: asset.name,
      pl: numeroOuNulo(asset.indicator?.pl),
      pvp: numeroOuNulo(asset.indicator?.pvp),
      dividendYield: numeroOuNulo(asset.indicator?.dividendYield),
      roe: numeroOuNulo(asset.indicator?.roe),
      roa: numeroOuNulo(asset.indicator?.roa),
      margemLiquida: numeroOuNulo(asset.indicator?.margemLiquida),
      dividaEbitda: numeroOuNulo(asset.indicator?.dividaEbitda),
      setorBancario: industriaEhBanco(asset.indicator?.industria ?? null),
      atualizadoEm: asset.indicator?.updatedAt.toISOString() ?? null,
    }));
  },
};
