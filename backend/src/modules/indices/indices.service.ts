import { comLimiteDeTempo, criarCacheEmMemoria, criarFila } from "../ativos/ativos.cache.js";
import { buscarSerieDiariaYahoo, buscarUltimoValorYahoo } from "../quotes/quotes.provider.js";
import { ateHoje, diaEmSaoPaulo, fimDeCadaMes, paraMensal, type PontoSerie } from "./indices.calculos.js";
import { buscarSerieHistoricaB3, buscarSerieSgs, type IndiceB3 } from "./indices.fontes.js";
import { indicesRepository, type SlugGravado } from "./indices.repository.js";

export type DadosDosIndicesDto = {
  atualizadoEm: string;
  hoje: string;
  selicMensal: PontoSerie[];
  ipcaMensal: PontoSerie[];
  cdiMensal: PontoSerie[];
  cdiTaxaMensal: PontoSerie[];
  pontos: Record<"ibovespa" | "ifix" | "smll" | "sp500" | "idiv", PontoSerie[]>;
};

const SEIS_HORAS = 6 * 60 * 60 * 1000;
const UM_MINUTO = 60 * 1000;
const DOIS_MINUTOS = 2 * 60 * 1000;
// Quanto a rota espera, no total, pelas séries do SGS. Passou do prazo: o que não ficou pronto vai com a
// última série boa (ou do banco, ou vazio, se nunca houve uma) nesta resposta, mas a busca continua na fila e preenche
// o cache para a próxima (o [] do prazo nunca é guardado). Abaixo dos 20 s de espera do front.
const PRAZO_DA_RESPOSTA_MS = 15_000;

// Uma fila só para todo o SGS: nunca duas chamadas ao Banco Central ao mesmo tempo, mesmo que a rota
// tenha desistido de esperar uma série lenta. Rajada é o que faz o SGS falhar.
let filaSgs = criarFila();

// Falha (null) fica guardada 2 min: sem isso, cada visita refaria a consulta a uma fonte fora do ar.
const cacheSgs = criarCacheEmMemoria<PontoSerie[] | null>(SEIS_HORAS, (v) => v === null, DOIS_MINUTOS);
// Última série boa (não vazia) de cada código do SGS. Quando a renovação estoura o prazo, falha ou volta
// vazia, a resposta usa esta: o dado de ontem vale mais que nenhum. A busca segue na fila e, se der certo,
// troca este valor para as próximas respostas.
let ultimoBom = new Map<number, PontoSerie[]>();
const cacheSerieYahoo = criarCacheEmMemoria<PontoSerie[] | null>(UM_MINUTO, (v) => v === null, DOIS_MINUTOS);
const cacheUltimo = criarCacheEmMemoria<PontoSerie | null>(UM_MINUTO, (v) => v === null, DOIS_MINUTOS);
const cacheHistoricoB3 = criarCacheEmMemoria<PontoSerie[] | null>(SEIS_HORAS, (v) => v === null, DOIS_MINUTOS);

const DESDE_2010 = new Date("2010-01-01T15:00:00Z");
const DESDE_2011 = new Date("2011-01-01T15:00:00Z");

const SIMBOLOS_COM_HISTORICO = { ibovespa: "^BVSP", sp500: "^GSPC" } as const;
const SIMBOLOS_GRAVADOS: Record<SlugGravado, string> = { ifix: "IFIX.SA", smll: "SMLL.SA", idiv: "IDIV.SA" };
const CODIGO_B3: Record<SlugGravado, IndiceB3> = { ifix: "IFIX", smll: "SMLL", idiv: "IDIV" };
// Primeiro ano pedido à B3: os três índices já têm série diária em 2011 (conferido em 10/11/2026).
const PRIMEIRO_ANO_B3 = 2011;

/** Só para os testes: esquece tudo o que as fontes devolveram. */
export function limparCacheDosIndices(): void {
  cacheSgs.limpar();
  cacheSerieYahoo.limpar();
  cacheUltimo.limpar();
  cacheHistoricoB3.limpar();
  ultimoBom = new Map();
  filaSgs = criarFila(); // uma busca travada de um teste não pode segurar a fila do próximo
}

/**
 * Reserva para depois de um reinício: sem ela, uma API recém-subida com o SGS fora do ar responde vazio.
 * Guarda a série já mensal (190 linhas por código, não 4 mil). Nunca rejeita: é chamada com `void` de dentro
 * da fila, e um erro aqui não pode segurar a resposta nem as buscas seguintes.
 */
async function guardarReservaDoSgs(codigo: number, serie: PontoSerie[], hoje: string): Promise<void> {
  try {
    const mensal = codigo === 432 || codigo === 4389 ? fimDeCadaMes(ateHoje(serie, hoje)) : paraMensal(serie);
    await indicesRepository.gravarSerieSgs(codigo, mensal);
  } catch {
    // banco fora do ar: a série boa continua em memória
  }
}

async function sgs(codigo: number, desde: Date, ate: Date, limite: number, hoje: string): Promise<PontoSerie[]> {
  const bons = ultimoBom; // a busca de antes de um limparCacheDosIndices não escreve no mapa novo
  const busca = cacheSgs.obter(
    String(codigo),
    () =>
      new Promise<PontoSerie[] | null>((resolve) => {
        const enfileirou = filaSgs.adicionar(String(codigo), async () => {
          const serie = await buscarSerieSgs(codigo, desde, ate).catch(() => null);
          if (serie && serie.length > 0) {
            bons.set(codigo, serie);
            void guardarReservaDoSgs(codigo, serie, hoje);
          }
          resolve(serie);
        });
        if (!enfileirou) resolve(null);
      }),
  );
  const serie = await comLimiteDeTempo(busca, Math.max(0, limite - Date.now()), null);
  if (serie && serie.length > 0) return serie;
  const emMemoria = ultimoBom.get(codigo);
  if (emMemoria && emMemoria.length > 0) return emMemoria;
  // a reserva do banco já é mensal ("AAAA-MM-01"); as reduções de montarDados aceitam as duas formas
  const doBanco = await indicesRepository.listarSerieSgs(codigo).catch(() => []);
  if (doBanco.length > 0 && !bons.has(codigo)) bons.set(codigo, doBanco);
  return doBanco;
}

function serieYahoo(simbolo: string): Promise<PontoSerie[]> {
  return cacheSerieYahoo
    .obter(simbolo, () => buscarSerieDiariaYahoo(simbolo, DESDE_2011).catch(() => null))
    .then((serie) => serie ?? []);
}

/**
 * Falta histórico quando o banco não tem ponto nenhum ou quando o mais antigo é posterior ao primeiro ano
 * que a B3 publica. Contar pontos não serve: um banco que acumulou só as leituras diárias do Yahoo tem
 * dezenas de pontos e nenhum histórico.
 */
function faltaHistorico(pontos: PontoSerie[]): boolean {
  const primeiro = pontos[0];
  return !primeiro || Number(primeiro.data.slice(0, 4)) > PRIMEIRO_ANO_B3;
}

/**
 * Busca o histórico diário na B3 e grava o que o banco ainda não tem (só acrescenta, nunca apaga). Uma busca
 * por índice em voo; o resultado bom vale 6 h e a falha, da B3 ou da gravação, 2 min. Devolve o que gravou,
 * ou null.
 */
function preencherHistorico(slug: SlugGravado, hoje: string): Promise<PontoSerie[] | null> {
  return cacheHistoricoB3
    .obter(slug, async () => {
      const historico = await buscarSerieHistoricaB3(CODIGO_B3[slug], PRIMEIRO_ANO_B3, Number(hoje.slice(0, 4))).catch(
        () => null,
      );
      if (!historico || historico.length === 0) return null;
      return indicesRepository.gravarPontosEmLote(slug, historico).then(
        () => historico,
        () => null,
      );
    })
    .catch(() => null);
}

/**
 * IFIX, SMLL e IDIV não têm histórico no Yahoo: cada leitura nova grava o ponto do dia, e o que falta para
 * trás vem do endpoint público da B3. A B3 são 16 chamadas por índice, uma por ano: a resposta só espera por
 * elas até `limite`. Passou disso, sai com o que o banco já tem e a busca segue em segundo plano, gravando
 * para a próxima resposta. Falha da fonte ou do banco nunca derruba: o que já existe é devolvido.
 */
async function serieGravada(slug: SlugGravado, hoje: string, limite: number): Promise<PontoSerie[]> {
  await cacheUltimo
    .obter(slug, async () => {
      const ponto = await buscarUltimoValorYahoo(SIMBOLOS_GRAVADOS[slug]).catch(() => null);
      if (ponto) await indicesRepository.gravarPonto(slug, ponto.data, ponto.valor).catch(() => undefined);
      return ponto;
    })
    .catch(() => null);

  const pontos = await indicesRepository.listarPontos(slug).catch(() => []);
  if (!faltaHistorico(pontos)) return pontos;

  const gravado = await comLimiteDeTempo(preencherHistorico(slug, hoje), Math.max(0, limite - Date.now()), null);
  if (!gravado) return pontos;
  return indicesRepository.listarPontos(slug).catch(() => pontos);
}

export const indicesService = {
  /** Esquenta os caches ao subir a API. Nunca rejeita; quem não quer esperar usa `void`. */
  async aquecer(): Promise<void> {
    await indicesService.montarDados().catch(() => undefined);
  },

  /**
   * Espera o histórico da B3 chegar ao banco, sem prazo: para o script de backfill, nunca para uma rota.
   * Devolve quantos pontos cada índice tem no banco ao final.
   */
  async preencherHistoricoDaB3(): Promise<Record<SlugGravado, number>> {
    const hoje = diaEmSaoPaulo(new Date());
    const contar = async (slug: SlugGravado): Promise<number> => {
      const antes = await indicesRepository.listarPontos(slug).catch(() => []);
      if (!faltaHistorico(antes)) return antes.length;
      await preencherHistorico(slug, hoje);
      return (await indicesRepository.listarPontos(slug).catch(() => antes)).length;
    };
    const [ifix, smll, idiv] = await Promise.all([contar("ifix"), contar("smll"), contar("idiv")]);
    return { ifix, smll, idiv };
  },

  async montarDados(): Promise<DadosDosIndicesDto> {
    const agora = new Date();
    const hoje = diaEmSaoPaulo(agora);

    // Prazo único da resposta. As quatro séries do SGS entram na fila serial e a fila as busca uma de cada vez.
    const limite = Date.now() + PRAZO_DA_RESPOSTA_MS;

    const [selic, ipca, cdi, cdiTaxa, ibovespa, sp500, ifix, smll, idiv] = await Promise.all([
      sgs(432, DESDE_2011, agora, limite, hoje),
      sgs(433, DESDE_2010, agora, limite, hoje),
      sgs(4391, DESDE_2011, agora, limite, hoje),
      sgs(4389, DESDE_2011, agora, limite, hoje),
      serieYahoo(SIMBOLOS_COM_HISTORICO.ibovespa),
      serieYahoo(SIMBOLOS_COM_HISTORICO.sp500),
      serieGravada("ifix", hoje, limite),
      serieGravada("smll", hoje, limite),
      serieGravada("idiv", hoje, limite),
    ]);

    return {
      atualizadoEm: agora.toISOString(),
      hoje,
      // o SGS 432 publica a meta já com data futura (próxima reunião do Copom)
      selicMensal: fimDeCadaMes(ateHoje(selic, hoje)),
      ipcaMensal: paraMensal(ipca),
      cdiMensal: paraMensal(cdi),
      cdiTaxaMensal: fimDeCadaMes(ateHoje(cdiTaxa, hoje)),
      pontos: { ibovespa, ifix, smll, sp500, idiv },
    };
  },
};
