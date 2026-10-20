/**
 * IntersectionObserver de mentira para os testes do kit de movimento (o jsdom não tem um).
 * O teste decide quando o elemento "entra" ou "sai" da tela chamando `disparar`.
 */
import { vi } from "vitest";

export class ObservadorFalso {
  static instancias: ObservadorFalso[] = [];

  readonly opcoes: IntersectionObserverInit | undefined;
  readonly alvos = new Set<Element>();
  /** Todos os alvos que já foram observados, mesmo depois de unobserve/disconnect. */
  readonly jaObservados = new Set<Element>();
  desconectado = false;
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback, opcoes?: IntersectionObserverInit) {
    this.callback = callback;
    this.opcoes = opcoes;
    ObservadorFalso.instancias.push(this);
  }

  observe(alvo: Element) {
    this.alvos.add(alvo);
    this.jaObservados.add(alvo);
  }
  unobserve(alvo: Element) {
    this.alvos.delete(alvo);
  }
  disconnect() {
    this.desconectado = true;
    this.alvos.clear();
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /**
   * Entrega uma leitura a todos os alvos que este observador já viu. Chamar depois do
   * disconnect simula um navegador que ainda entrega uma leitura atrasada: o componente
   * não pode reagir mal a ela.
   */
  disparar(fracaoVisivel: number) {
    const entradas = [...this.jaObservados].map(
      (target) =>
        ({
          target,
          isIntersecting: fracaoVisivel > 0,
          intersectionRatio: fracaoVisivel,
          intersectionRect: { height: 100 * fracaoVisivel } as DOMRectReadOnly,
          boundingClientRect: { height: 100 } as DOMRectReadOnly,
          rootBounds: { height: 800 } as DOMRectReadOnly,
          time: 0,
        }) as IntersectionObserverEntry,
    );
    this.callback(entradas, this as unknown as IntersectionObserver);
  }
}

export function instalarObservadorFalso() {
  ObservadorFalso.instancias = [];
  vi.stubGlobal("IntersectionObserver", ObservadorFalso);
}

/** Entrega a mesma leitura por todos os observadores criados até agora. */
export function dispararTodos(fracaoVisivel: number) {
  for (const o of ObservadorFalso.instancias) o.disparar(fracaoVisivel);
}
