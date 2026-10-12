import { Prisma, type Asset, type AssetIndicator, type AssetType } from "@prisma/client";
import { cnpjDoTicker } from "../assets/cnpj.js";
import {
  atualizarIndicador,
  calcularDividendYield,
  estaDesatualizado as indicadorVencido,
  somarProventos,
} from "../indicators/indicators.service.js";
import type { Cotacao, ProventoDoProvedor } from "../quotes/quotes.provider.js";
import { AppError } from "../../shared/errors/AppError.js";
import { comLimiteDeTempo, criarFila } from "./ativos.cache.js";
import {
  ACOES,
  ETFS,
  FIIS,
  acharAcao,
  acharEtf,
  acharFii,
  ehBanco,
  type AcaoDoCatalogo,
  type EtfDoCatalogo,
  type FiiDoCatalogo,
} from "./ativos.catalogo.js";
import { descricaoDe } from "./ativos.descricoes.js";
import { taxaAdministracaoAnual } from "./ativos.composicao.js";
import { fontes } from "./ativos.fontes.js";
import { buscarNoticiasDoAtivo } from "./ativos.noticias.js";
import { ativosRepository } from "./ativos.repository.js";
import { obterFotografia, VALIDADE_DO_SNAPSHOT_MS, type EstadoDoBloco, type Fotografia } from "./ativos.snapshots.js";
import type {
  AcaoFichaDto,
  AcaoResumoDto,
  Bloco,
  EtfFichaDto,
  EtfResumoDto,
  FiiFichaDto,
  FiiResumoDto,
  IndicadoresDaAcao,
  InformeDoFii,
  NoticiaDoAtivo,
  PatrimonioDoEtf,
  PontoDePreco,
  ProventoDoAtivo,
  ResultadoTrimestral,
} from "./ativos.tipos.js";

/**
 * Orquestra as páginas de Ativos: junta cotação (Yahoo), indicadores, proventos, CVM e notícias
 * de um ativo do catálogo. Regra que atravessa o arquivo: uma fonte que falha NUNCA derruba a
 * resposta. O bloco que dependia dela sai com estado "indisponivel" (ou "desatualizado", se
 * havia um dado antigo), e os outros seguem normais.
 *
 * Duas formas de espera. A ficha espera até 8 segundos por fonte, porque há uma pessoa olhando;
 * passado isso responde com o que tem, e a busca continua e grava ao terminar. O aquecimento em
 * segundo plano espera o quanto for preciso, porque não há ninguém esperando.
 */

const QUINZE_MINUTOS_MS = 15 * 60 * 1000;
const ESPERA_DA_FICHA_MS = 8_000;
const ESPERA_EM_SEGUNDO_PLANO_MS = 180_000;
const QUARENTA_E_CINCO_DIAS_MS = 45 * 24 * 60 * 60 * 1000;
const PROVENTOS_NA_FICHA = 4;

type AssetComIndicador = Asset & { indicator: AssetIndicator | null };
type ItemDoCatalogo = { ticker: string; nome: string };

const fila = criarFila((chave, erro) =>
  console.error(`[ativos] falha ao atualizar ${chave}:`, erro instanceof Error ? erro.message : erro),
);

// ---------------------------------------------------------------------------
// Pequenos conversores
// ---------------------------------------------------------------------------

const numero = (d: Prisma.Decimal | null | undefined): number | null => (d ? d.toNumber() : null);
const arredondar = (n: number, casas = 2): number => Number(n.toFixed(casas));

function variacaoDoDia(preco: number | null, anterior: number | null | undefined): number | null {
  if (preco === null || !anterior || anterior <= 0) return null;
  return arredondar((preco / anterior - 1) * 100);
}

const dataDoPregao = (c: Cotacao | null): string | null => c?.negociadoEm?.toISOString().slice(0, 10) ?? null;

function emBloco<T>(f: Fotografia<T>): Bloco<T> {
  return { estado: f.estado, atualizadoEm: f.atualizadoEm?.toISOString() ?? null, dados: f.dados };
}

const bloco = <T>(dados: T | null, estado: EstadoDoBloco = dados === null ? "indisponivel" : "ok"): Bloco<T> => ({
  estado,
  atualizadoEm: dados === null ? null : new Date().toISOString(),
  dados,
});

const semFotografia = <T>(): Fotografia<T> => ({ dados: null, atualizadoEm: null, estado: "indisponivel" });

function historicoDeMeses(porMes: Map<string, number>): PontoDePreco[] {
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([mes, fechamento]) => ({ mes, fechamento: arredondar(fechamento) }));
}

function proventosRecentes(lista: ProventoDoProvedor[]): ProventoDoAtivo[] {
  return lista
    .slice(-PROVENTOS_NA_FICHA)
    .reverse()
    .map((p) => ({ dataEx: p.dataEx.toISOString().slice(0, 10), valor: arredondar(p.valorPorCota, 4) }));
}

// ---------------------------------------------------------------------------
// Ativo no banco
// ---------------------------------------------------------------------------

const precoVencido = (a: Pick<Asset, "priceUpdatedAt">) =>
  !a.priceUpdatedAt || Date.now() - a.priceUpdatedAt.getTime() > QUINZE_MINUTOS_MS;

/**
 * O Asset do ativo, cadastrado na primeira visita. É preciso para guardar o cache (indicadores e
 * fotografias apontam para ele). Sem cotação e sem cadastro prévio não há como cadastrar (o
 * preço é obrigatório): devolve null, e a ficha segue sem os blocos que dependem do banco.
 */
async function garantirAsset(
  item: ItemDoCatalogo,
  tipo: AssetType,
  cotacao: Cotacao | null,
): Promise<AssetComIndicador | null> {
  const existente = await ativosRepository.findAssetWithIndicator(item.ticker);
  if (existente) {
    if (cotacao && precoVencido(existente)) {
      // oportunista: a resposta já tem o preço e não depende desta gravação
      await ativosRepository.updatePrice(item.ticker, cotacao.preco, new Date()).catch(() => undefined);
    }
    return existente;
  }
  if (!cotacao) return null;

  return ativosRepository.ensureAsset({
    ticker: item.ticker,
    name: item.nome,
    type: tipo,
    currentPrice: cotacao.preco,
    cnpj: cnpjDoTicker(item.ticker),
  });
}

// ---------------------------------------------------------------------------
// Indicadores das ações
// ---------------------------------------------------------------------------

// Uma renovação por ticker em voo: a ficha e o aquecimento pedem a mesma coisa ao Yahoo.
const renovacoesDeIndicador = new Map<string, Promise<AssetIndicator | null>>();

function renovarIndicador(asset: Pick<Asset, "id" | "ticker">): Promise<AssetIndicator | null> {
  let renovacao = renovacoesDeIndicador.get(asset.ticker);
  if (!renovacao) {
    renovacao = atualizarIndicador(asset)
      .catch((erro: unknown) => {
        console.error(`[ativos] falha ao renovar os indicadores de ${asset.ticker}:`, erro instanceof Error ? erro.message : erro);
        return null;
      })
      .finally(() => renovacoesDeIndicador.delete(asset.ticker));
    renovacoesDeIndicador.set(asset.ticker, renovacao);
  }
  return renovacao;
}

async function lerIndicadoresDaAcao(
  asset: AssetComIndicador | null,
  esperaMs: number,
): Promise<{ indicator: AssetIndicator | null; estado: EstadoDoBloco }> {
  if (!asset) return { indicator: null, estado: "indisponivel" };
  if (!indicadorVencido(asset.indicator)) return { indicator: asset.indicator, estado: "ok" };

  const renovado = await comLimiteDeTempo(renovarIndicador(asset), esperaMs, null);
  if (renovado) return { indicator: renovado, estado: "ok" };
  return asset.indicator
    ? { indicator: asset.indicator, estado: "desatualizado" }
    : { indicator: null, estado: "indisponivel" };
}

function indicadoresDaAcaoDto(indicator: AssetIndicator | null, banco: boolean): IndicadoresDaAcao | null {
  if (!indicator) return null;
  return {
    pl: numero(indicator.pl),
    pvp: numero(indicator.pvp),
    dy12m: numero(indicator.dividendYield),
    roe: numero(indicator.roe),
    roa: numero(indicator.roa),
    margemLiquida: banco ? null : numero(indicator.margemLiquida),
    // banco não tem EBITDA com sentido: a razão não se aplica, mesmo que o Yahoo devolva algo
    dividaEbitda: banco ? null : numero(indicator.dividaEbitda),
  };
}

// ---------------------------------------------------------------------------
// Montagem das respostas
// ---------------------------------------------------------------------------

function resumoDaAcao(
  item: AcaoDoCatalogo,
  cotacao: Cotacao | null,
  asset: AssetComIndicador | null,
): AcaoResumoDto {
  const preco = cotacao?.preco ?? numero(asset?.currentPrice) ?? null;
  const indicator = asset?.indicator ?? null;
  return {
    ticker: item.ticker,
    nome: item.nome,
    setor: item.setor,
    especie: item.especie,
    preco: preco === null ? null : arredondar(preco),
    variacaoDia: variacaoDoDia(preco, cotacao?.fechamentoAnterior),
    pl: numero(indicator?.pl),
    pvp: numero(indicator?.pvp),
    dy12m: numero(indicator?.dividendYield),
    roe: numero(indicator?.roe),
  };
}

/** P/VP do FII: preço da cota ÷ valor patrimonial da cota do último informe da CVM. */
function pvpDoFii(preco: number | null, valorPatrimonialCota: number | null | undefined): number | null {
  if (preco === null || !valorPatrimonialCota || valorPatrimonialCota <= 0) return null;
  return new Prisma.Decimal(preco).div(valorPatrimonialCota).toDecimalPlaces(2).toNumber();
}

function dy12mDoFii(proventos: ProventoDoProvedor[] | null, preco: number | null): number | null {
  if (proventos === null) return null;
  const dy = calcularDividendYield(somarProventos(proventos), preco);
  return dy === null ? null : arredondar(dy);
}

/** Rendimento do último pagamento ÷ preço. Só vale se o último pagamento é recente: fundo mensal. */
function dyMensalDoFii(proventos: ProventoDoProvedor[] | null, preco: number | null): number | null {
  const ultimo = proventos?.at(-1);
  if (!ultimo || preco === null || preco <= 0) return null;
  if (Date.now() - ultimo.dataEx.getTime() > QUARENTA_E_CINCO_DIAS_MS) return null;
  return arredondar((ultimo.valorPorCota / preco) * 100);
}

function resumoDoFii(
  item: FiiDoCatalogo,
  cotacao: Cotacao | null,
  asset: AssetComIndicador | null,
  proventos: ProventoDoProvedor[] | null,
  valorPatrimonialCota: number | null,
): FiiResumoDto {
  const preco = cotacao?.preco ?? numero(asset?.currentPrice) ?? null;
  return {
    ticker: item.ticker,
    nome: item.nome,
    tipo: item.tipo,
    segmento: item.segmento,
    preco: preco === null ? null : arredondar(preco),
    variacaoDia: variacaoDoDia(preco, cotacao?.fechamentoAnterior),
    dy12m: dy12mDoFii(proventos, preco),
    pvp: pvpDoFii(preco, valorPatrimonialCota),
  };
}

/**
 * Variação do preço em 12 meses: a cota de hoje contra o fechamento do mês anterior ao mesmo mês do ano
 * passado (de hoje, 12/10/2026, contra o fim de set/2025: cerca de 12 meses e meio). O histórico é pedido
 * com 13 meses, o que dá 14 fechamentos, e a base é o mais antigo deles.
 */
function retorno12mDoEtf(preco: number | null, porMes: Map<string, number>): number | null {
  if (preco === null || porMes.size < 14) return null;
  const antigo = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).at(-14)?.[1];
  if (!antigo || antigo <= 0) return null;
  return arredondar((preco / antigo - 1) * 100);
}

function resumoDoEtf(
  item: EtfDoCatalogo,
  cotacao: Cotacao | null,
  asset: AssetComIndicador | null,
  porMes: Map<string, number>,
  proventos: ProventoDoProvedor[] | null,
): EtfResumoDto {
  const preco = cotacao?.preco ?? numero(asset?.currentPrice) ?? null;
  return {
    ticker: item.ticker,
    nome: item.nome,
    categoria: item.categoria,
    indice: item.indice,
    preco: preco === null ? null : arredondar(preco),
    variacaoDia: variacaoDoDia(preco, cotacao?.fechamentoAnterior),
    retorno12m: retorno12mDoEtf(preco, porMes),
    dy12m: dy12mDoFii(proventos, preco),
  };
}

async function patrimonioDoEtf(item: EtfDoCatalogo, esperaMs: number): Promise<Bloco<PatrimonioDoEtf>> {
  const todos = await comLimiteDeTempo(fontes.patrimonioDosEtfs(), esperaMs, null);
  return bloco(todos?.get(item.cnpj) ?? null);
}

// ---------------------------------------------------------------------------
// Aquecimento em segundo plano
// ---------------------------------------------------------------------------

/** Deixa em cache tudo que a ficha e a listagem de uma ação usam. Nunca lança. */
async function aquecerAcao(item: AcaoDoCatalogo): Promise<void> {
  const cotacao = await fontes.cotacao(item.ticker);
  const asset = await garantirAsset(item, "ACAO", cotacao);
  if (!asset) return;

  await lerIndicadoresDaAcao(asset, ESPERA_EM_SEGUNDO_PLANO_MS);
  await Promise.all([fontes.historicoMensal(item.ticker), fontes.proventos12Meses(item.ticker)]);
  await obterFotografia({
    assetId: asset.id,
    tipo: "CVM_RESULTS",
    buscar: () => fontes.resultadosTrimestrais(item.ticker),
    esperaMaximaMs: ESPERA_EM_SEGUNDO_PLANO_MS,
  });
  await obterFotografia({
    assetId: asset.id,
    tipo: "NEWS",
    buscar: () => buscarNoticiasDoAtivo(item.ticker, item.nome),
    esperaMaximaMs: ESPERA_EM_SEGUNDO_PLANO_MS,
  });
}

async function aquecerFii(item: FiiDoCatalogo): Promise<void> {
  const cotacao = await fontes.cotacao(item.ticker);
  const asset = await garantirAsset(item, "FII", cotacao);
  if (!asset) return;

  await Promise.all([fontes.historicoMensal(item.ticker), fontes.proventos12Meses(item.ticker)]);
  await obterFotografia({
    assetId: asset.id,
    tipo: "CVM_FUND_REPORT",
    buscar: () => fontes.informeDoFii(item.ticker),
    esperaMaximaMs: ESPERA_EM_SEGUNDO_PLANO_MS,
  });
  await obterFotografia({
    assetId: asset.id,
    tipo: "NEWS",
    buscar: () => buscarNoticiasDoAtivo(item.ticker, item.nome),
    esperaMaximaMs: ESPERA_EM_SEGUNDO_PLANO_MS,
  });
}

async function aquecerEtf(item: EtfDoCatalogo): Promise<void> {
  const cotacao = await fontes.cotacao(item.ticker);
  const asset = await garantirAsset(item, "ETF", cotacao);
  await Promise.all([fontes.historicoMensal(item.ticker), fontes.proventos12Meses(item.ticker), fontes.patrimonioDosEtfs()]);
  if (!asset) return;
  await obterFotografia({
    assetId: asset.id,
    tipo: "NEWS",
    buscar: () => buscarNoticiasDoAtivo(item.ticker, item.nome),
    esperaMaximaMs: ESPERA_EM_SEGUNDO_PLANO_MS,
  });
}

const agendarEtf = (item: EtfDoCatalogo) => fila.adicionar(`etf:${item.ticker}`, () => aquecerEtf(item));
const agendarAcao = (item: AcaoDoCatalogo) => fila.adicionar(`acao:${item.ticker}`, () => aquecerAcao(item));
const agendarFii = (item: FiiDoCatalogo) => fila.adicionar(`fii:${item.ticker}`, () => aquecerFii(item));

// ---------------------------------------------------------------------------
// API do módulo
// ---------------------------------------------------------------------------

export const ativosService = {
  /**
   * A listagem de ações. Lê o que já está guardado (indicadores no banco, cotação em cache de 15
   * minutos) e responde na hora; o que falta ou venceu é renovado em segundo plano, um ativo de
   * cada vez, e aparece na próxima leitura. Só a cotação é pedida na hora (em paralelo), porque é
   * barata e é o que mais muda.
   */
  async listarAcoes(): Promise<AcaoResumoDto[]> {
    const assets = await ativosRepository.findAssetsWithIndicator(ACOES.map((a) => a.ticker));
    const porTicker = new Map<string, AssetComIndicador>(assets.map((a) => [a.ticker, a]));
    const cotacoes = await Promise.all(
      ACOES.map((a) => comLimiteDeTempo(fontes.cotacao(a.ticker), ESPERA_DA_FICHA_MS, null)),
    );

    return ACOES.map((item, i) => {
      const asset = porTicker.get(item.ticker) ?? null;
      if (!asset || indicadorVencido(asset.indicator)) agendarAcao(item);
      return resumoDaAcao(item, cotacoes[i] ?? null, asset);
    });
  },

  /** A listagem de FIIs, com a mesma estratégia. O P/VP vem da fotografia do informe da CVM, já guardada. */
  async listarFiis(): Promise<FiiResumoDto[]> {
    const assets = await ativosRepository.findAssetsWithIndicator(FIIS.map((f) => f.ticker));
    const porTicker = new Map<string, AssetComIndicador>(assets.map((a) => [a.ticker, a]));
    const informes = await ativosRepository.findSnapshotsByType(
      assets.map((a) => a.id),
      "CVM_FUND_REPORT",
    );
    const informePorAsset = new Map(
      informes.map((s) => [
        s.assetId,
        { valorPatrimonialCota: (s.data as { valorPatrimonialCota?: number | null }).valorPatrimonialCota ?? null, atualizadoEm: s.updatedAt },
      ]),
    );

    const [cotacoes, proventos] = await Promise.all([
      Promise.all(FIIS.map((f) => comLimiteDeTempo(fontes.cotacao(f.ticker), ESPERA_DA_FICHA_MS, null))),
      Promise.all(FIIS.map((f) => comLimiteDeTempo(fontes.proventos12Meses(f.ticker), ESPERA_DA_FICHA_MS, null))),
    ]);

    return FIIS.map((item, i) => {
      const asset = porTicker.get(item.ticker) ?? null;
      const informe = asset ? informePorAsset.get(asset.id) : undefined;
      // renova também o informe vencido: só olhar "se existe" deixaria o P/VP da listagem velho
      // para sempre, se ninguém abrisse a ficha
      const vencido = informe && Date.now() - informe.atualizadoEm.getTime() > VALIDADE_DO_SNAPSHOT_MS.CVM_FUND_REPORT;
      if (!asset || !informe || vencido) agendarFii(item);
      return resumoDoFii(item, cotacoes[i] ?? null, asset, proventos[i] ?? null, informe?.valorPatrimonialCota ?? null);
    });
  },

  /**
   * A listagem de ETFs. Não depende do banco: cotação, histórico e proventos vêm do Yahoo, em cache
   * na memória, e o resumo sai pronto na hora.
   */
  async listarEtfs(): Promise<EtfResumoDto[]> {
    return Promise.all(
      ETFS.map(async (item) => {
        const [cotacao, historico, proventos] = await Promise.all([
          comLimiteDeTempo(fontes.cotacao(item.ticker), ESPERA_DA_FICHA_MS, null),
          comLimiteDeTempo(fontes.historicoMensal(item.ticker), ESPERA_DA_FICHA_MS, new Map<string, number>()),
          comLimiteDeTempo(fontes.proventos12Meses(item.ticker), ESPERA_DA_FICHA_MS, null),
        ]);
        return resumoDoEtf(item, cotacao, null, historico, proventos);
      }),
    );
  },

  /** A ficha de um ETF do catálogo. Ticker que não é do catálogo é 404, antes de qualquer fonte externa. */
  async fichaDoEtf(ticker: string): Promise<EtfFichaDto> {
    const item = acharEtf(ticker);
    if (!item) throw new AppError("ETF não encontrado no catálogo", 404);

    const [cotacao, historico, proventos] = await Promise.all([
      comLimiteDeTempo(fontes.cotacao(item.ticker), ESPERA_DA_FICHA_MS, null),
      comLimiteDeTempo(fontes.historicoMensal(item.ticker), ESPERA_DA_FICHA_MS, new Map<string, number>()),
      comLimiteDeTempo(fontes.proventos12Meses(item.ticker), ESPERA_DA_FICHA_MS, null),
    ]);

    const asset = await garantirAsset(item, "ETF", cotacao);
    const [patrimonio, noticias] = await Promise.all([
      patrimonioDoEtf(item, ESPERA_DA_FICHA_MS),
      asset
        ? obterFotografia({
            assetId: asset.id,
            tipo: "NEWS",
            buscar: () => buscarNoticiasDoAtivo(item.ticker, item.nome),
          })
        : semFotografia<NoticiaDoAtivo[]>(),
    ]);

    return {
      ...resumoDoEtf(item, cotacao, asset, historico, proventos),
      descricao: descricaoDe(item.ticker),
      fechamentoEm: dataDoPregao(cotacao),
      patrimonio,
      historico: bloco(historico.size > 0 ? historicoDeMeses(historico) : null),
      proventos: bloco(proventos === null ? null : proventosRecentes(proventos)),
      noticias: emBloco(noticias),
    };
  },

  /** A ficha de uma ação do catálogo. Ticker que não é do catálogo é 404, antes de qualquer fonte externa. */
  async fichaDaAcao(ticker: string): Promise<AcaoFichaDto> {
    const item = acharAcao(ticker);
    if (!item) throw new AppError("Ação não encontrada no catálogo", 404);

    const banco = ehBanco(item);
    const [cotacao, historico, proventos] = await Promise.all([
      comLimiteDeTempo(fontes.cotacao(item.ticker), ESPERA_DA_FICHA_MS, null),
      comLimiteDeTempo(fontes.historicoMensal(item.ticker), ESPERA_DA_FICHA_MS, new Map<string, number>()),
      comLimiteDeTempo(fontes.proventos12Meses(item.ticker), ESPERA_DA_FICHA_MS, null),
    ]);

    const asset = await garantirAsset(item, "ACAO", cotacao);
    const [indicadores, resultados, noticias] = await Promise.all([
      lerIndicadoresDaAcao(asset, ESPERA_DA_FICHA_MS),
      asset
        ? obterFotografia({
            assetId: asset.id,
            tipo: "CVM_RESULTS",
            buscar: () => fontes.resultadosTrimestrais(item.ticker),
          })
        : semFotografia<ResultadoTrimestral[]>(),
      asset
        ? obterFotografia({
            assetId: asset.id,
            tipo: "NEWS",
            buscar: () => buscarNoticiasDoAtivo(item.ticker, item.nome),
          })
        : semFotografia<NoticiaDoAtivo[]>(),
    ]);

    const assetAtual = asset && indicadores.indicator ? { ...asset, indicator: indicadores.indicator } : asset;
    const dadosDosIndicadores = indicadoresDaAcaoDto(indicadores.indicator, banco);

    return {
      ...resumoDaAcao(item, cotacao, assetAtual),
      descricao: descricaoDe(item.ticker),
      fechamentoEm: dataDoPregao(cotacao),
      banco,
      indicadores: {
        estado: indicadores.estado,
        atualizadoEm: indicadores.indicator?.updatedAt.toISOString() ?? null,
        dados: dadosDosIndicadores,
      },
      historico: bloco(historico.size > 0 ? historicoDeMeses(historico) : null),
      proventos: bloco(proventos === null ? null : proventosRecentes(proventos)),
      resultados: emBloco(resultados),
      noticias: emBloco(noticias),
    };
  },

  /** A ficha de um FII do catálogo. Ticker que não é do catálogo é 404, antes de qualquer fonte externa. */
  async fichaDoFii(ticker: string): Promise<FiiFichaDto> {
    const item = acharFii(ticker);
    if (!item) throw new AppError("FII não encontrado no catálogo", 404);

    const [cotacao, historico, proventos] = await Promise.all([
      comLimiteDeTempo(fontes.cotacao(item.ticker), ESPERA_DA_FICHA_MS, null),
      comLimiteDeTempo(fontes.historicoMensal(item.ticker), ESPERA_DA_FICHA_MS, new Map<string, number>()),
      comLimiteDeTempo(fontes.proventos12Meses(item.ticker), ESPERA_DA_FICHA_MS, null),
    ]);

    const asset = await garantirAsset(item, "FII", cotacao);
    const [informe, noticias] = await Promise.all([
      asset
        ? obterFotografia({
            assetId: asset.id,
            tipo: "CVM_FUND_REPORT",
            buscar: () => fontes.informeDoFii(item.ticker),
          })
        : semFotografia<InformeDoFii>(),
      asset
        ? obterFotografia({
            assetId: asset.id,
            tipo: "NEWS",
            buscar: () => buscarNoticiasDoAtivo(item.ticker, item.nome),
          })
        : semFotografia<NoticiaDoAtivo[]>(),
    ]);

    const dadosDoInforme = informe.dados;
    const resumo = resumoDoFii(item, cotacao, asset, proventos, dadosDoInforme?.valorPatrimonialCota ?? null);
    // o preço bruto, e não o resumo.preco já arredondado: arredondar no meio da conta desloca o DY
    const precoBruto = cotacao?.preco ?? numero(asset?.currentPrice) ?? null;

    return {
      ...resumo,
      descricao: descricaoDe(item.ticker),
      fechamentoEm: dataDoPregao(cotacao),
      indicadores: {
        dyMensal: dyMensalDoFii(proventos, precoBruto),
        dy12m: resumo.dy12m,
        pvp: resumo.pvp,
        patrimonioLiquido: dadosDoInforme?.patrimonioLiquido ?? null,
        cotistas: dadosDoInforme?.cotistas ?? null,
        taxaAdministracao: taxaAdministracaoAnual(dadosDoInforme?.taxaAdministracaoMes ?? null),
        gestao: dadosDoInforme?.tipoGestao ?? null,
      },
      informe: {
        estado: informe.estado,
        atualizadoEm: informe.atualizadoEm?.toISOString() ?? null,
        competencia: dadosDoInforme?.competencia ?? null,
      },
      composicao: {
        estado: informe.estado,
        atualizadoEm: informe.atualizadoEm?.toISOString() ?? null,
        dados: dadosDoInforme?.composicao ?? null,
      },
      historico: bloco(historico.size > 0 ? historicoDeMeses(historico) : null),
      proventos: bloco(proventos === null ? null : proventosRecentes(proventos)),
      noticias: emBloco(noticias),
    };
  },

  /**
   * Põe os 30 ativos do catálogo na fila de renovação, um por vez. Chamado uma vez ao subir a
   * API em produção, para a primeira visita depois de um deploy não encontrar tudo vazio. Só
   * renova o que está ausente ou vencido, então reiniciar a API não repete o trabalho todo.
   * Não espera nada: devolve na hora, e a fila roda sozinha.
   */
  aquecerCatalogo(): void {
    for (const item of ACOES) agendarAcao(item);
    for (const item of FIIS) agendarFii(item);
    for (const item of ETFS) agendarEtf(item);
  },

  /** Resolve quando a fila de renovação esvazia. Para testes e para o desligamento. */
  aguardarFila: () => fila.ociosa(),
};
