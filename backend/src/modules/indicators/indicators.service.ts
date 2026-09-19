import { Prisma, type AssetIndicator } from "@prisma/client";
import { buscarIndicadoresFundamentalistas } from "../quotes/quotes.provider.js";
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

/**
 * Dividend Yield = soma dos proventos por cota pagos nos últimos 12 meses
 * (módulo Proventos) ÷ preço atual. Não usa o campo `dividendYield` do
 * Yahoo — ver o motivo em quotes.provider.ts.
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

function estaDesatualizado(indicator: Pick<AssetIndicator, "updatedAt"> | null): boolean {
  if (!indicator) return true; // job nunca rodou para este ativo
  return Date.now() - indicator.updatedAt.getTime() > VALIDADE_MS;
}

/**
 * Busca os fundamentos de UM ativo no Yahoo, calcula o Dividend Yield a
 * partir dos Proventos já importados e grava no cache. Devolve null sem
 * gravar nada se o provedor estiver fora do ar — mantém o cache anterior,
 * do jeito que existir, em vez de apagar um dado bom por causa de uma
 * falha pontual de rede.
 */
export async function atualizarIndicador(asset: {
  id: string;
  ticker: string;
}): Promise<AssetIndicator | null> {
  const indicadores = await buscarIndicadoresFundamentalistas(asset.ticker);
  if (!indicadores) return null;

  const somaProventos = await indicatorsRepository.somaProventosUltimos12Meses(asset.id);
  const dividendYield = calcularDividendYield(somaProventos, indicadores.precoAtual);

  const { precoAtual: _precoAtual, ...campos } = indicadores;
  return indicatorsRepository.upsert(asset.id, { ...campos, dividendYield });
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
      setorBancario: industriaEhBanco(asset.indicator?.industria ?? null),
      atualizadoEm: asset.indicator?.updatedAt.toISOString() ?? null,
    }));
  },
};
