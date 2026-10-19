import { comLimiteDeTempo, criarCacheEmMemoria } from "../ativos/ativos.cache.js";
import { buscarSerieDiariaYahoo, buscarUltimoValorYahoo } from "../quotes/quotes.provider.js";
import { ateHoje, diaEmSaoPaulo, fimDeCadaMes, paraMensal, type PontoSerie } from "./indices.calculos.js";
import { buscarSerieSgs } from "./indices.fontes.js";
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
const QUINZE_MINUTOS = 15 * 60 * 1000;
const DOIS_MINUTOS = 2 * 60 * 1000;
// Quanto a rota espera por UMA série do SGS. Estourou: a série vai vazia nesta resposta, mas a busca
// continua e preenche o cache para a próxima (o [] do orçamento nunca é guardado).
const ORCAMENTO_SGS_MS = 12_000;

// Falha (null) fica guardada 2 min: sem isso, cada visita refaria a consulta a uma fonte fora do ar.
const cacheSgs = criarCacheEmMemoria<PontoSerie[] | null>(SEIS_HORAS, (v) => v === null, DOIS_MINUTOS);
const cacheSerieYahoo = criarCacheEmMemoria<PontoSerie[] | null>(QUINZE_MINUTOS, (v) => v === null, DOIS_MINUTOS);
const cacheUltimo = criarCacheEmMemoria<PontoSerie | null>(QUINZE_MINUTOS, (v) => v === null, DOIS_MINUTOS);

const DESDE_2010 = new Date("2010-01-01T15:00:00Z");
const DESDE_2011 = new Date("2011-01-01T15:00:00Z");

const SIMBOLOS_COM_HISTORICO = { ibovespa: "^BVSP", sp500: "^GSPC" } as const;
const SIMBOLOS_GRAVADOS: Record<SlugGravado, string> = { ifix: "IFIX.SA", smll: "SMLL.SA", idiv: "IDIV.SA" };

/** Só para os testes: esquece tudo o que as fontes devolveram. */
export function limparCacheDosIndices(): void {
  cacheSgs.limpar();
  cacheSerieYahoo.limpar();
  cacheUltimo.limpar();
}

function sgs(codigo: number, desde: Date, ate: Date): Promise<PontoSerie[]> {
  const busca = cacheSgs.obter(String(codigo), () => buscarSerieSgs(codigo, desde, ate).catch(() => null));
  return comLimiteDeTempo(busca, ORCAMENTO_SGS_MS, null).then((serie) => serie ?? []);
}

function serieYahoo(simbolo: string): Promise<PontoSerie[]> {
  return cacheSerieYahoo
    .obter(simbolo, () => buscarSerieDiariaYahoo(simbolo, DESDE_2011).catch(() => null))
    .then((serie) => serie ?? []);
}

/**
 * IFIX, SMLL e IDIV não têm histórico no Yahoo: cada leitura nova grava o ponto do dia e a série
 * é a que o banco acumulou. Falha da fonte ou do banco nunca derruba: o que já existe é devolvido.
 */
async function serieGravada(slug: SlugGravado): Promise<PontoSerie[]> {
  await cacheUltimo
    .obter(slug, async () => {
      const ponto = await buscarUltimoValorYahoo(SIMBOLOS_GRAVADOS[slug]).catch(() => null);
      if (ponto) await indicesRepository.gravarPonto(slug, ponto.data, ponto.valor).catch(() => undefined);
      return ponto;
    })
    .catch(() => null);
  return indicesRepository.listarPontos(slug).catch(() => []);
}

export const indicesService = {
  /** Esquenta os caches ao subir a API, sem esperar e sem nunca rejeitar. */
  aquecer(): void {
    void indicesService.montarDados().catch(() => undefined);
  },

  async montarDados(): Promise<DadosDosIndicesDto> {
    const agora = new Date();
    const hoje = diaEmSaoPaulo(agora);

    // O SGS falha de vez em quando sob rajada: as quatro séries saem uma depois da outra (e ficam 6 h
    // em cache), enquanto o Yahoo e o banco seguem em paralelo.
    const sgsEmSequencia = async () => {
      const selic = await sgs(432, DESDE_2011, agora);
      const ipca = await sgs(433, DESDE_2010, agora);
      const cdi = await sgs(4391, DESDE_2011, agora);
      const cdiTaxa = await sgs(4389, DESDE_2011, agora);
      return { selic, ipca, cdi, cdiTaxa };
    };

    const [{ selic, ipca, cdi, cdiTaxa }, ibovespa, sp500, ifix, smll, idiv] = await Promise.all([
      sgsEmSequencia(),
      serieYahoo(SIMBOLOS_COM_HISTORICO.ibovespa),
      serieYahoo(SIMBOLOS_COM_HISTORICO.sp500),
      serieGravada("ifix"),
      serieGravada("smll"),
      serieGravada("idiv"),
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
