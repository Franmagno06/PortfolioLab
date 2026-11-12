import { mesCurto } from "./format";

/**
 * A tela de Relatórios mostra as demonstrações que a CVM publica (ITR e DFP de companhia aberta,
 * Informe Mensal de FII), já resumidas pelo backend. Aqui fica o que a tela faz com a lista: agrupar
 * por ativo, ordenar os períodos e montar a tabela que põe um período ao lado do outro. Tudo puro,
 * testado em relatorios.test.ts.
 */

/**
 * Um ponto marcado por corte fixo no backend (resumo-cvm.ts). `criterio` é a regra que o gerou; falta nas
 * análises anteriores à versão 3. "info" só existe nessas análises antigas.
 */
export type Alerta = { titulo: string; severidade: "info" | "atencao" | "critico"; detalhe: string; criterio?: string };
export type Destaque = { titulo: string; detalhe: string; criterio?: string };
export type BlocoDoResumo = { titulo: string; itens: string[] };

export type Analise = {
  /** Presente nas análises montadas pelas regras atuais do backend; ausente nas antigas. */
  versao?: number;
  tipoDocumento: string;
  /** Resumo em blocos (versão 3 em diante). */
  blocos?: BlocoDoResumo[];
  /** Resumo em lista solta: análises da versão 2 e relatórios antigos de PDF. */
  resumoExecutivo?: string[];
  /** "Destaques do período" (versão 3 em diante). */
  destaques?: Destaque[];
  alertas: Alerta[];
  /** `definicao` vem da versão 3 em diante. */
  indicadores: { nome: string; valor: string; definicao?: string }[];
  /** Data-base do documento, "AAAA-MM-DD". */
  dataReferencia?: string;
  /** Página do documento no sistema da CVM. */
  link?: string | null;
};

export type Relatorio = {
  id: string;
  fileName: string;
  createdAt: string;
  analysis: Analise | null;
  source: "CVM" | "PDF";
  /** "2026-T1" (trimestre) ou "2026-03" (mês). */
  period: string | null;
  asset: { ticker: string; name?: string; type?: string } | null;
};

export type GrupoDeAtivo = {
  ticker: string;
  nome: string | null;
  tipo: string | null;
  /** Do mais recente para o mais antigo, um por período. */
  periodos: Relatorio[];
};

const ehTrimestre = (chave: string) => /^\d{4}-T[1-4]$/.test(chave);
const ehMes = (chave: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(chave);

/**
 * Relatório de demonstração oficial: veio da CVM, tem ativo e período, e a análise foi montada pelas
 * regras atuais. O resto (PDF enviado quando a tela aceitava upload, análise de versão antiga) é
 * mostrado à parte, só para leitura, sem entrar em comparação.
 */
export function ehOficial(r: Relatorio): r is Relatorio & { period: string; asset: NonNullable<Relatorio["asset"]>; analysis: Analise } {
  return (
    r.source === "CVM" &&
    r.asset !== null &&
    r.period !== null &&
    (ehTrimestre(r.period) || ehMes(r.period)) &&
    typeof r.analysis?.versao === "number"
  );
}

/** "2026-T1" vira "1T26"; "2026-03" vira "mar/26". Chave fora do formato sai como veio. */
export function rotuloDoPeriodo(chave: string): string {
  if (ehTrimestre(chave)) return `${chave.slice(6)}T${chave.slice(2, 4)}`;
  if (ehMes(chave)) return `${mesCurto(chave)}/${chave.slice(2, 4)}`;
  return chave;
}

/** O 4º trimestre vem da DFP, que traz o exercício inteiro, e não só os três últimos meses. */
export function ehAnoInteiro(chave: string): boolean {
  return /^\d{4}-T4$/.test(chave);
}

/**
 * O período logo antes: "2026-T1" → "2025-T4"; "2026-01" → "2025-12". Null se a chave não for um período.
 * É o que o botão "Carregar período anterior" pede ao backend.
 */
export function periodoAnterior(chave: string): string | null {
  const ano = Number(chave.slice(0, 4));
  if (ehTrimestre(chave)) {
    const tri = Number(chave.slice(6));
    return tri === 1 ? `${ano - 1}-T4` : `${ano}-T${tri - 1}`;
  }
  if (ehMes(chave)) {
    const mes = Number(chave.slice(5, 7));
    return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, "0")}`;
  }
  return null;
}

/**
 * Os relatórios oficiais agrupados por ativo, em ordem alfabética de ticker. Dentro do ativo, do período
 * mais recente para o mais antigo. Se a conta tiver dois relatórios do mesmo ativo e período (dado
 * antigo), fica o criado por último. Não altera a lista recebida.
 */
export function agruparPorAtivo(relatorios: Relatorio[]): GrupoDeAtivo[] {
  const grupos = new Map<string, Map<string, Relatorio>>();
  for (const r of relatorios) {
    if (!ehOficial(r)) continue;
    const doAtivo = grupos.get(r.asset.ticker) ?? new Map<string, Relatorio>();
    const jaTem = doAtivo.get(r.period);
    if (!jaTem || r.createdAt > jaTem.createdAt) doAtivo.set(r.period, r);
    grupos.set(r.asset.ticker, doAtivo);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ticker, doAtivo]) => {
      // a chave ordena como texto: "2025-T4" < "2026-T1", "2026-03" < "2026-10"
      const periodos = [...doAtivo.values()].sort((a, b) => (b.period ?? "").localeCompare(a.period ?? ""));
      const comNome = periodos.find((p) => p.asset?.name)?.asset;
      return { ticker, nome: comNome?.name ?? null, tipo: periodos[0]?.asset?.type ?? null, periodos };
    });
}

/** O que sobrou fora dos grupos: relatórios antigos, que a tela mostra só para leitura. */
export function relatoriosAntigos(relatorios: Relatorio[]): Relatorio[] {
  return relatorios.filter((r) => !ehOficial(r) && r.analysis !== null);
}

export type TabelaComparativa = {
  /**
   * Do período mais recente (à esquerda, colado ao nome do indicador) para o mais antigo. No celular só
   * cabe uma coluna sem rolar: tem de ser a do período que a pessoa acabou de abrir.
   */
  colunas: { id: string; periodo: string; rotulo: string; anoInteiro: boolean }[];
  /** Uma linha por indicador; `valores` na ordem das colunas, null onde o período não traz o indicador. */
  /** `definicao`: a do período mais recente que a traz; null em análise antiga. */
  linhas: { nome: string; definicao: string | null; valores: (string | null)[] }[];
};

/**
 * Põe os períodos de um ativo lado a lado. Entram os `maximo` mais recentes. As linhas seguem a ordem
 * dos indicadores do período mais recente; indicador que só existe em período antigo entra depois.
 * Devolve null com menos de dois períodos: uma coluna só não compara nada.
 */
export function tabelaComparativa(periodos: Relatorio[], maximo = 4): TabelaComparativa | null {
  const recentes = periodos.filter(ehOficial).slice(0, maximo);
  if (recentes.length < 2) return null;

  const nomes: string[] = [];
  for (const r of recentes) {
    for (const i of r.analysis.indicadores) if (!nomes.includes(i.nome)) nomes.push(i.nome);
  }
  return {
    colunas: recentes.map((r) => ({
      id: r.id,
      periodo: r.period,
      rotulo: rotuloDoPeriodo(r.period),
      anoInteiro: ehAnoInteiro(r.period),
    })),
    linhas: nomes.map((nome) => ({
      nome,
      definicao:
        recentes.map((r) => r.analysis.indicadores.find((i) => i.nome === nome)?.definicao).find((d) => !!d) ?? null,
      valores: recentes.map((r) => r.analysis.indicadores.find((i) => i.nome === nome)?.valor ?? null),
    })),
  };
}

/**
 * O resumo do documento em blocos. Análise da versão 3 traz os blocos com título; a antiga (lista solta)
 * vira um bloco só, sem título. Bloco sem item não entra.
 */
export function blocosDoResumo(a: Analise): { titulo: string | null; itens: string[] }[] {
  if (a.blocos && a.blocos.length > 0) return a.blocos.filter((b) => b.itens.length > 0);
  const itens = a.resumoExecutivo ?? [];
  return itens.length > 0 ? [{ titulo: null, itens }] : [];
}

export type GrupoDePontos = {
  chave: "destaque" | "atencao" | "critico" | "info";
  titulo: string;
  itens: { titulo: string; detalhe: string; criterio: string | null }[];
};

const TITULOS_DOS_GRUPOS: Record<GrupoDePontos["chave"], string> = {
  destaque: "Destaques do período",
  atencao: "Pontos de atenção",
  critico: "Pontos críticos",
  // só nas análises antigas: a versão 3 levou esses fatos para o resumo
  info: "Para saber",
};

/**
 * Os pontos marcados pelos cortes fixos, nos grupos e na ordem da tela: destaques, atenção, críticos (e
 * "Para saber", só em análise antiga). Grupo sem ponto não entra.
 */
export function gruposDePontos(a: Analise): GrupoDePontos[] {
  const ponto = (p: { titulo: string; detalhe: string; criterio?: string }) => ({
    titulo: p.titulo,
    detalhe: p.detalhe,
    criterio: p.criterio ?? null,
  });
  const grupos: GrupoDePontos[] = [
    { chave: "destaque", titulo: TITULOS_DOS_GRUPOS.destaque, itens: (a.destaques ?? []).map(ponto) },
    ...(["atencao", "critico", "info"] as const).map((chave) => ({
      chave,
      titulo: TITULOS_DOS_GRUPOS[chave],
      itens: a.alertas.filter((x) => x.severidade === chave).map(ponto),
    })),
  ];
  return grupos.filter((g) => g.itens.length > 0);
}
