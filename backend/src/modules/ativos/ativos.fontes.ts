import { cnpjDoTicker } from "../assets/cnpj.js";
import {
  buscarCotacao,
  buscarHistoricoMensal,
  buscarProventosOuNulo,
  type Cotacao,
  type ProventoDoProvedor,
} from "../quotes/quotes.provider.js";
import { buscarDadosAcao, buscarDadosFii, type DadosAcao } from "../reports/cvm.provider.js";
import { criarCacheEmMemoria } from "./ativos.cache.js";
import {
  mesesConcluidos,
  montarInformeDoFii,
  resultadoDoTrimestre,
  trimestresConcluidos,
} from "./ativos.composicao.js";
import type { InformeDoFii, ResultadoTrimestral } from "./ativos.tipos.js";

/**
 * O acesso às fontes externas das páginas de Ativos. Cada função devolve o dado, ou null quando
 * a fonte falhou: quem chama decide o que mostrar. Aqui entram só ticker já validado contra o
 * catálogo, então os caches em memória têm no máximo 30 chaves.
 *
 * Validades: cotação 15 minutos (o Yahoo atrasa isso mesmo); histórico mensal e proventos 6 horas
 * (mudam no fim do dia, ou uma vez por mês).
 */

const QUINZE_MINUTOS_MS = 15 * 60 * 1000;
const SEIS_HORAS_MS = 6 * 60 * 60 * 1000;
const DOZE_MESES_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Interpretar um zip da CVM é CPU síncrona (de 0,5 a 1,5 s por trimestre, e a ficha de uma ação
 * precisa de uns seis). Sem pausa, o Node não atende mais nada nesse tempo: nem outros visitantes,
 * nem as respostas do Yahoo que a mesma ficha espera, cujos limites de tempo vencem antes de o
 * callback rodar. A pausa devolve a vez ao laço de eventos entre um trimestre e outro.
 */
const liberarOLaco = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * Quanto tempo uma falha do Yahoo fica guardada. Com a fonte bloqueando o IP, cada listagem refaria
 * de 15 a 30 consultas por visita, e o bloqueio duraria mais. Um minuto basta para a fonte respirar.
 */
const FALHA_DO_YAHOO_MS = 60 * 1000;
const nulo = <T>(v: T | null) => v === null;

const cotacoes = criarCacheEmMemoria<Cotacao | null>(QUINZE_MINUTOS_MS, nulo, FALHA_DO_YAHOO_MS);
const historicos = criarCacheEmMemoria<Map<string, number>>(SEIS_HORAS_MS, (m) => m.size === 0, FALHA_DO_YAHOO_MS);
const proventos = criarCacheEmMemoria<ProventoDoProvedor[] | null>(SEIS_HORAS_MS, nulo, FALHA_DO_YAHOO_MS);

/** Quantos trimestres anteriores tentar até achar quatro publicados. */
const TRIMESTRES_CANDIDATOS = 7;
/** Quantos meses para trás tentar até achar um informe publicado. */
const MESES_CANDIDATOS = 4;

export const fontes = {
  cotacao: (ticker: string) => cotacoes.obter(ticker, () => buscarCotacao(ticker)),

  /** Fechamento de cada mês, "AAAA-MM" → preço. Vazio se o Yahoo falhou. */
  historicoMensal: (ticker: string) => historicos.obter(ticker, () => buscarHistoricoMensal(ticker, 12)),

  /** Proventos dos últimos 12 meses do próprio ativo. Null se o Yahoo falhou; lista vazia se não pagou. */
  proventos12Meses: (ticker: string) =>
    proventos.obter(ticker, () => buscarProventosOuNulo(ticker, new Date(Date.now() - DOZE_MESES_MS))),

  /** Lucro e patrimônio dos últimos quatro trimestres publicados, do mais antigo ao mais novo. */
  async resultadosTrimestrais(ticker: string, hoje = new Date()): Promise<ResultadoTrimestral[] | null> {
    const cnpj = cnpjDoTicker(ticker);
    if (!cnpj) return null;

    // Cada trimestre é pedido uma vez só, mesmo quando o 4T precisa dos três anteriores.
    const documentos = new Map<string, Promise<DadosAcao | null>>();
    const documento = (ano: number, trimestre: 1 | 2 | 3 | 4) => {
      const chave = `${ano}-${trimestre}`;
      let promessa = documentos.get(chave);
      if (!promessa) {
        promessa = buscarDadosAcao(cnpj, { tipo: "trimestre", ano, trimestre });
        documentos.set(chave, promessa);
      }
      return promessa;
    };

    // guarda a posição de cada trimestre achado na lista de candidatos (0 = o último concluído)
    const achados: { posicao: number; resultado: ResultadoTrimestral }[] = [];
    const candidatos = trimestresConcluidos(hoje, TRIMESTRES_CANDIDATOS);
    for (const [posicao, periodo] of candidatos.entries()) {
      if (achados.length === 4) break;

      await liberarOLaco();
      const d = await documento(periodo.ano, periodo.trimestre);
      if (!d) continue; // ainda não publicado, ou a CVM falhou

      let itrs = {};
      if (periodo.trimestre === 4) {
        const doAno = {} as Record<1 | 2 | 3, DadosAcao | null>;
        for (const t of [1, 2, 3] as const) {
          await liberarOLaco();
          doAno[t] = await documento(periodo.ano, t);
        }
        itrs = doAno;
      }
      const resultado = resultadoDoTrimestre(periodo, d, itrs);
      if (resultado) achados.push({ posicao, resultado });
    }

    // buscarDadosAcao devolve null tanto para "a CVM ainda não publicou" quanto para "o download
    // falhou". Só a primeira é normal, e só para o trimestre mais novo (o ITR sai até 45 dias depois
    // do fim). Se o mais novo achado é anterior ao penúltimo concluído, ou se há buraco no meio, uma
    // busca falhou: devolve null, o que mantém o dado guardado antes (como desatualizado) em vez de
    // gravar por 24h uma série velha ou furada como se estivesse certa.
    const [maisNovo] = achados;
    if (!maisNovo || maisNovo.posicao > 1) return null;
    const consecutivos = achados.every((a, i) => i === 0 || a.posicao === (achados[i - 1]?.posicao ?? -2) + 1);
    if (!consecutivos) return null;

    return achados.map((a) => a.resultado).reverse();
  },

  /** O informe mensal mais recente publicado pela CVM para o fundo. Null se não achou nenhum. */
  async informeDoFii(ticker: string, hoje = new Date()): Promise<InformeDoFii | null> {
    const cnpj = cnpjDoTicker(ticker);
    if (!cnpj) return null;

    for (const { ano, mes } of mesesConcluidos(hoje, MESES_CANDIDATOS)) {
      await liberarOLaco();
      const dados = await buscarDadosFii(cnpj, { tipo: "mes", ano, mes });
      if (dados) return montarInformeDoFii(dados);
    }
    return null;
  },

  /** Só para testes: esvazia os caches em memória. */
  limparCaches() {
    cotacoes.limpar();
    historicos.limpar();
    proventos.limpar();
  },
};
