/**
 * Duas ferramentas pequenas das páginas de Ativos, sem estado de negócio.
 *
 * 1. criarCacheEmMemoria: guarda o resultado de uma consulta externa por um
 *    tempo, e deixa UMA consulta por chave em voo. Cem visitas simultâneas à
 *    mesma ficha viram uma chamada ao Yahoo, não cem.
 *
 * 2. criarFila: roda tarefas de uma em uma, em segundo plano. É como o
 *    catálogo é aquecido sem rajada: o Yahoo bloqueia IP que faz muitas
 *    consultas de uma vez.
 *
 * O cache em memória nunca cresce além do catálogo (30 tickers): as chaves
 * vêm sempre de ticker já validado contra ativos.catalogo.ts. Não é para
 * guardar chave que o usuário escolhe.
 */

type Entrada<T> = { em: number; valor: Promise<T>; falha?: boolean };

export type CacheEmMemoria<T> = {
  /** O valor guardado, se ainda válido; senão busca, guarda (se não for falha) e devolve. */
  obter(chave: string, buscar: () => Promise<T>): Promise<T>;
  /** O valor guardado e ainda válido, sem buscar nada. Undefined se não houver. */
  espiar(chave: string): Promise<T> | undefined;
  limpar(): void;
};

/**
 * `ehFalha` diz se um resultado é uma falha da fonte. O padrão (null) cobre os provedores deste
 * projeto, que devolvem null quando falham. Uma falha pontual de rede não pode ficar guardada por
 * horas, mas também não pode ser esquecida na hora: com a fonte bloqueando o IP, cada visita
 * repetiria a consulta e pioraria o bloqueio. `validadeDaFalhaMs` é o meio-termo, um cache negativo
 * curto. Com 0 (o padrão), a falha é esquecida no mesmo instante.
 */
export function criarCacheEmMemoria<T>(
  validadeMs: number,
  ehFalha: (valor: T) => boolean = (v) => v === null,
  validadeDaFalhaMs = 0,
): CacheEmMemoria<T> {
  const entradas = new Map<string, Entrada<T>>();

  const valida = (e: Entrada<T> | undefined): e is Entrada<T> =>
    e !== undefined && Date.now() - e.em < (e.falha ? validadeDaFalhaMs : validadeMs);

  return {
    obter(chave, buscar) {
      const guardada = entradas.get(chave);
      if (valida(guardada)) return guardada.valor;

      const valor: Promise<T> = buscar().then(
        (resultado) => {
          // só mexe se ainda for a nossa entrada: outra busca pode ter assumido a chave
          if (ehFalha(resultado) && entradas.get(chave)?.valor === valor) {
            if (validadeDaFalhaMs > 0) entradas.set(chave, { em: Date.now(), valor, falha: true });
            else entradas.delete(chave);
          }
          return resultado;
        },
        (erro: unknown) => {
          if (entradas.get(chave)?.valor === valor) entradas.delete(chave);
          throw erro;
        },
      );
      entradas.set(chave, { em: Date.now(), valor });
      return valor;
    },

    espiar(chave) {
      const guardada = entradas.get(chave);
      return valida(guardada) ? guardada.valor : undefined;
    },

    limpar() {
      entradas.clear();
    },
  };
}

export type Fila = {
  /**
   * Põe a tarefa no fim da fila. Devolve false, sem enfileirar, se já há uma tarefa
   * com a mesma chave esperando ou rodando.
   */
  adicionar(chave: string, tarefa: () => Promise<void>): boolean;
  /** Resolve quando a fila esvazia. Para testes e para o desligamento. */
  ociosa(): Promise<void>;
  tamanho(): number;
};

export function criarFila(aoFalhar: (chave: string, erro: unknown) => void = () => undefined): Fila {
  const pendentes = new Set<string>();
  let cauda: Promise<void> = Promise.resolve();

  return {
    adicionar(chave, tarefa) {
      if (pendentes.has(chave)) return false;
      pendentes.add(chave);

      cauda = cauda.then(async () => {
        try {
          await tarefa();
        } catch (erro) {
          // uma tarefa que falha não pode travar as que vêm depois
          aoFalhar(chave, erro);
        } finally {
          pendentes.delete(chave);
        }
      });
      return true;
    },

    ociosa: () => cauda,
    tamanho: () => pendentes.size,
  };
}

/** Resolve com o resultado, ou com `aoEstourar` se a promessa passar do tempo. A promessa original segue viva. */
export function comLimiteDeTempo<T, R>(promessa: Promise<T>, ms: number, aoEstourar: R): Promise<T | R> {
  let temporizador: NodeJS.Timeout | undefined;
  const limite = new Promise<R>((resolve) => {
    temporizador = setTimeout(() => resolve(aoEstourar), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(temporizador));
}
