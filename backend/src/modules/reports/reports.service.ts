import type { Asset } from "@prisma/client";
import { AppError } from "../../shared/errors/AppError.js";
import { montarPagina, type PaginacaoInput } from "../../shared/paginacao.js";
import { cnpjDoTicker } from "../assets/cnpj.js";
import { quotesService } from "../quotes/quotes.service.js";
import { ehAnaliseAtual, type Analise } from "./analise.js";
import { buscarDadosAcao, buscarDadosFii } from "./cvm.provider.js";
import {
  chaveDoPeriodo,
  parsearPeriodo,
  periodoAnterior,
  rotuloDoPeriodo,
  ultimoPeriodoEncerrado,
  type Periodo,
} from "./periodo.js";
import type { ConsultaCvmInput } from "./reports.schemas.js";
import { reportsRepository } from "./reports.repository.js";
import { montarAnalise, type DadosCvm } from "./resumo-cvm.js";

// Relatórios são as demonstrações que a CVM publica em dados abertos (ITR e DFP de companhia aberta,
// Informe Mensal de fundo imobiliário), resumidas por regra fixa. Não há upload de PDF nem IA: todo
// número da tela vem do arquivo oficial.

export const COTA_RELATORIOS = 50;

/**
 * Sem período pedido, quantos períodos para trás procurar até achar um que a CVM já publicou. A
 * companhia tem até 45 dias para o ITR e 3 meses para a DFP: logo depois do fim de um trimestre, o
 * mais recente disponível costuma ser o anterior ou o que veio antes dele.
 */
const PERIODOS_PARA_TRAS = 4;

/**
 * Ler o zip da CVM é CPU síncrona (o mesmo cuidado de ativos.snapshots.ts). Uma leitura de cada vez:
 * duas consultas simultâneas não descompactam dois arquivos ao mesmo tempo no laço de eventos.
 */
let filaDaCvm: Promise<unknown> = Promise.resolve();
function naFilaDaCvm<T>(tarefa: () => Promise<T>): Promise<T> {
  const resultado = filaDaCvm.then(tarefa, tarefa);
  filaDaCvm = resultado.catch(() => undefined);
  return resultado;
}

/** A análise de um ativo num período: do cache, se montada pelas regras atuais; senão, da CVM. */
async function analiseDoPeriodo(asset: Asset, cnpj: string, periodo: Periodo): Promise<Analise | null> {
  const chave = chaveDoPeriodo(periodo);

  const guardada = await reportsRepository.findCvmSummary(asset.id, chave);
  if (guardada && ehAnaliseAtual(guardada.analysis)) return guardada.analysis;

  const dados = await naFilaDaCvm<DadosCvm | null>(() =>
    periodo.tipo === "trimestre" ? buscarDadosAcao(cnpj, periodo) : buscarDadosFii(cnpj, periodo),
  );
  if (!dados) return null;

  const analise = montarAnalise(dados, rotuloDoPeriodo(periodo));
  // o cache é conveniência: falhar ao guardar não pode derrubar a consulta
  await reportsRepository
    .saveCvmSummary(asset.id, chave, analise)
    .catch((err: unknown) => console.error("[CVM] falha ao guardar o cache:", err));
  return analise;
}

function periodoPedido(texto: string, asset: Asset): Periodo {
  const periodo = parsearPeriodo(texto);
  if (!periodo) {
    throw new AppError("Período inválido. Use 2026-T1 ou 1T26 para trimestre, 2026-03 para mês.", 400);
  }
  if (asset.type === "ACAO" && periodo.tipo !== "trimestre") {
    throw new AppError("Ações têm demonstrações por trimestre. Informe o período como 2026-T1 ou 1T26.", 400);
  }
  if (asset.type === "FII" && periodo.tipo !== "mes") {
    throw new AppError("Fundos imobiliários têm informe por mês. Informe o período como 2026-03.", 400);
  }
  return periodo;
}

type Encontrado = { periodo: Periodo; analise: Analise };

/** O período pedido, ou o mais recente que a CVM já tem. */
async function encontrar(asset: Asset, cnpj: string, input: ConsultaCvmInput): Promise<Encontrado> {
  if (input.periodo) {
    const periodo = periodoPedido(input.periodo, asset);
    const analise = await analiseDoPeriodo(asset, cnpj, periodo);
    if (!analise) {
      throw new AppError(
        `A CVM ainda não tem dados de ${asset.ticker} para ${rotuloDoPeriodo(periodo)}. ` +
          `O documento pode não ter sido entregue, ou a consulta à CVM falhou: tente de novo em alguns minutos.`,
        404,
      );
    }
    return { periodo, analise };
  }

  const hoje = new Date();
  let periodo: Periodo =
    asset.type === "ACAO" ? ultimoPeriodoEncerrado("trimestre", hoje) : ultimoPeriodoEncerrado("mes", hoje);
  for (let i = 0; i < PERIODOS_PARA_TRAS; i++) {
    const analise = await analiseDoPeriodo(asset, cnpj, periodo);
    if (analise) return { periodo, analise };
    periodo = periodoAnterior(periodo);
  }
  throw new AppError(
    `Não encontramos demonstrações recentes de ${asset.ticker} na CVM. ` +
      `A consulta pode ter falhado: tente de novo em alguns minutos.`,
    404,
  );
}

export const reportsService = {
  /**
   * Traz da CVM as demonstrações de um ativo, do período pedido ou do mais recente publicado, e as
   * guarda na conta. Pedir de novo o mesmo ativo e período devolve o relatório que já existe
   * (`novo: false`), sem gastar a cota.
   */
  async consultar(userId: string, input: ConsultaCvmInput) {
    const asset = await quotesService.buscarOuCadastrar(input.ticker);
    if (!asset) {
      throw new AppError(`Ativo ${input.ticker} não encontrado`, 404);
    }
    if (asset.type !== "ACAO" && asset.type !== "FII") {
      throw new AppError(
        "Só ações e fundos imobiliários entregam demonstrações à CVM. ETFs e renda fixa não têm relatório aqui.",
        400,
      );
    }
    const cnpj = asset.cnpj ?? cnpjDoTicker(asset.ticker);
    if (!cnpj) {
      throw new AppError(`Não temos o CNPJ de ${asset.ticker}, necessário para localizar o documento na CVM.`, 400);
    }

    const { periodo, analise } = await encontrar(asset, cnpj, input);
    const chave = chaveDoPeriodo(periodo);
    const dto = (r: { id: string; fileName: string; createdAt: Date }) => ({
      id: r.id,
      fileName: r.fileName,
      source: "CVM" as const,
      period: chave,
      asset: { ticker: asset.ticker, name: asset.name, type: asset.type },
      createdAt: r.createdAt,
      analysis: analise,
    });

    const existente = await reportsRepository.findCvmByUserAssetPeriod(userId, asset.id, chave);
    if (existente) {
      // regras novas desde que o relatório foi guardado: a linha passa a mostrar a análise atual
      if (!ehAnaliseAtual(existente.analysis)) await reportsRepository.updateAnalysis(existente.id, analise);
      return { relatorio: dto(existente), novo: false };
    }

    const guardados = await reportsRepository.countByUser(userId);
    if (guardados >= COTA_RELATORIOS) {
      throw new AppError(
        `Você atingiu o limite de ${COTA_RELATORIOS} relatórios guardados. Apague algum antes de consultar outro.`,
        429,
      );
    }

    const relatorio = await reportsRepository.create({
      userId,
      fileName: `${asset.ticker} ${rotuloDoPeriodo(periodo)}`,
      source: "CVM",
      assetId: asset.id,
      period: chave,
      extractedText: null,
      analysis: analise,
    });
    return { relatorio: dto(relatorio), novo: true };
  },

  async list(userId: string, { limite, cursor }: PaginacaoInput) {
    const linhas = await reportsRepository.findManyByUser(userId, {
      take: limite + 1,
      ...(cursor ? { cursor } : {}),
    });
    return montarPagina(linhas, limite);
  },

  async remove(userId: string, reportId: string) {
    const relatorio = await reportsRepository.findByIdAndUser(reportId, userId);
    if (!relatorio) {
      throw new AppError("Relatório não encontrado", 404);
    }
    await reportsRepository.delete(reportId);
  },
};

export type { Analise };
