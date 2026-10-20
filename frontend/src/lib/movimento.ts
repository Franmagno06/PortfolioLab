/**
 * Funções puras do kit de movimento (sem React nem DOM): a curva da contagem e o traço do
 * minigráfico. Ficam aqui para serem testadas sem navegador e usadas pelos componentes.
 */

/** Espelham `--duracao-grafico` do globals.css; se um mudar, o outro muda junto. */
export const DURACAO_GRAFICO_MS = 1100;
export const DURACAO_CONTAGEM_MS = 1100;

/** Saída cúbica (1 - (1 - t)^3): arranca rápido e assenta devagar. `t` fica preso em [0, 1]; NaN vira 0. */
export function desacelerar(t: number): number {
  if (Number.isNaN(t)) return 0;
  const preso = Math.min(1, Math.max(0, t));
  return 1 - (1 - preso) ** 3;
}

/**
 * Valor exibido a `decorridoMs` do início; em `t >= 1` devolve o final exato, sem sobra de float.
 * Entrada inválida nunca vira NaN na tela: final não finito dá 0, duração inválida dá o final.
 * O `+ 0` troca -0 por 0 (final negativo no instante 0 exibiria "-0").
 */
export function valorNaContagem(
  final: number,
  decorridoMs: number,
  duracaoMs: number = DURACAO_CONTAGEM_MS,
): number {
  if (!Number.isFinite(final)) return 0;
  if (!Number.isFinite(duracaoMs) || duracaoMs <= 0) return final + 0;
  return final * desacelerar(decorridoMs / duracaoMs) + 0;
}

/** 2 casas e sem zeros à direita: o `d` do SVG não carrega ruído como 33.333333333333336. */
function coordenada(n: number): string {
  return String(Number(n.toFixed(2)));
}

/**
 * Atributo `d` de um `<path>`: menor valor embaixo (y = altura), maior no topo (y = 0).
 * Valores não finitos (NaN, Infinity) são descartados antes; com menos de 2 sobrando, devolve "".
 * Descartar assim reparte o x por igual entre os pontos que sobram. Série constante vai no meio da altura, para não dividir por zero.
 */
export function caminhoDoMinigrafico(valores: number[], largura: number, altura: number): string {
  const limpos = valores.filter(Number.isFinite);
  if (limpos.length < 2) return "";
  const menor = Math.min(...limpos);
  const intervalo = Math.max(...limpos) - menor;
  const passo = largura / (limpos.length - 1);
  return limpos
    .map((valor, i) => {
      const y = intervalo === 0 ? altura / 2 : altura - ((valor - menor) / intervalo) * altura;
      return `${i === 0 ? "M" : "L"}${coordenada(i * passo)},${coordenada(y)}`;
    })
    .join(" ");
}
