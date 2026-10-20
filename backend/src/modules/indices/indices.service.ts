import { comLimiteDeTempo, criarCacheEmMemoria, criarFila } from "../ativos/ativos.cache.js";
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
// Quanto a rota espera, no total, pelas séries do SGS. Passou do prazo: o que não ficou pronto vai com a
// última série boa (ou vazio, se nunca houve uma) nesta resposta, mas a busca continua na fila e preenche
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
  ultimoBom = new Map();
  filaSgs = criarFila(); // uma busca travada de um teste não pode segurar a fila do próximo
}

function sgs(codigo: number, desde: Date, ate: Date, limite: number): Promise<PontoSerie[]> {
  const bons = ultimoBom; // a busca de antes de um limparCacheDosIndices não escreve no mapa novo
  const busca = cacheSgs.obter(
    String(codigo),
    () =>
      new Promise<PontoSerie[] | null>((resolve) => {
        const enfileirou = filaSgs.adicionar(String(codigo), async () => {
          const serie = await buscarSerieSgs(codigo, desde, ate).catch(() => null);
          if (serie && serie.length > 0) bons.set(codigo, serie);
          resolve(serie);
        });
        if (!enfileirou) resolve(null);
      }),
  );
  return comLimiteDeTempo(busca, Math.max(0, limite - Date.now()), null).then((serie) =>
    serie && serie.length > 0 ? serie : (ultimoBom.get(codigo) ?? []),
  );
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
  /** Esquenta os caches ao subir a API. Nunca rejeita; quem não quer esperar usa `void`. */
  async aquecer(): Promise<void> {
    await indicesService.montarDados().catch(() => undefined);
  },

  async montarDados(): Promise<DadosDosIndicesDto> {
    const agora = new Date();
    const hoje = diaEmSaoPaulo(agora);

    // Prazo único da resposta. As quatro séries do SGS entram na fila serial e a fila as busca uma de cada vez.
    const limite = Date.now() + PRAZO_DA_RESPOSTA_MS;

    const [selic, ipca, cdi, cdiTaxa, ibovespa, sp500, ifix, smll, idiv] = await Promise.all([
      sgs(432, DESDE_2011, agora, limite),
      sgs(433, DESDE_2010, agora, limite),
      sgs(4391, DESDE_2011, agora, limite),
      sgs(4389, DESDE_2011, agora, limite),
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
