import { useSyncExternalStore } from "react";

export type Simulacao = {
  valorAporte: number;
  patrimonioAtual: number;
  /** Patrimônio depois do aporte, contando só o que virou ativo. */
  patrimonioFinal: number;
  /** Base do cálculo do déficit: patrimônio mais o aporte inteiro. */
  patrimonioProjetado: number;
  compras: {
    ticker: string;
    name: string;
    deficit: number;
    quantidade: number;
    precoUnitario: number;
    total: number;
  }[];
  totalGasto: number;
  restante: number;
  alocacao: { ticker: string; alvoPct: number; atualPct: number; aposAportePct: number }[];
  /** Patrimônio dos ativos COM meta — o denominador da simulação. */
  patrimonioConsiderado: number;
  somaMetas: number;
  foraDaSimulacao: { valor: number; ativos: { ticker: string; valor: number }[] };
};

export type SimulacaoGuardada = {
  /** O valor digitado no campo, como texto, para devolver o campo igual. */
  valor: string;
  resultado: Simulacao;
  /** ISO 8601 — quando o cálculo foi feito. */
  calculadoEm: string;
  /** As metas mudaram depois do cálculo: o resultado já não reflete a carteira. */
  metasAlteradas: boolean;
};

/*
 * Por que isto existe: o resultado da simulação vivia num useState da página.
 * Ao navegar para outra tela, o Next desmonta o componente e o estado morre
 * junto — voltar à Simulação mostrava a tela vazia de novo.
 *
 * O sessionStorage dura enquanto a aba estiver aberta (sobrevive a navegação e
 * a F5) e some ao fechá-la: guarda o cálculo sem deixar dado financeiro no
 * computador para sempre. O logout apaga explicitamente (ver sidebar.tsx).
 *
 * useSyncExternalStore é a forma do React de ler um valor que vive FORA dele.
 * Ler o sessionStorage direto no useState quebraria a hidratação: no servidor
 * não existe sessionStorage, e o HTML pré-renderizado divergiria do cliente.
 */
const CHAVE = "portfoliolab:simulacao";

const ouvintes = new Set<() => void>();

// getSnapshot precisa devolver a MESMA referência enquanto nada mudar, senão o
// React entra em laço de renderização. Por isso o objeto lido é guardado junto
// com o texto bruto que o gerou, e só é reconstruído quando o texto muda.
let cache: { bruto: string | null; valor: SimulacaoGuardada | null } = {
  bruto: null,
  valor: null,
};

function lerBruto(): string | null {
  try {
    return sessionStorage.getItem(CHAVE);
  } catch {
    return null; // modo privado com storage bloqueado
  }
}

function getSnapshot(): SimulacaoGuardada | null {
  const bruto = lerBruto();
  if (bruto !== cache.bruto) {
    let valor: SimulacaoGuardada | null = null;
    try {
      valor = bruto ? (JSON.parse(bruto) as SimulacaoGuardada) : null;
    } catch {
      valor = null; // conteúdo corrompido: trata como vazio
    }
    cache = { bruto, valor };
  }
  return cache.valor;
}

function getServerSnapshot(): null {
  return null;
}

function subscribe(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function gravar(valor: SimulacaoGuardada | null) {
  try {
    if (valor) sessionStorage.setItem(CHAVE, JSON.stringify(valor));
    else sessionStorage.removeItem(CHAVE);
  } catch {
    // storage cheio ou bloqueado: a tela segue funcionando, só não lembra
  }
  ouvintes.forEach((avisar) => avisar());
}

export function useSimulacaoGuardada() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function guardarSimulacao(valor: string, resultado: Simulacao) {
  gravar({ valor, resultado, calculadoEm: new Date().toISOString(), metasAlteradas: false });
}

/** Chamado ao salvar ou adicionar meta: o cálculo guardado fica desatualizado. */
export function marcarMetasAlteradas() {
  const atual = getSnapshot();
  if (atual && !atual.metasAlteradas) gravar({ ...atual, metasAlteradas: true });
}

export function esquecerSimulacao() {
  gravar(null);
}
