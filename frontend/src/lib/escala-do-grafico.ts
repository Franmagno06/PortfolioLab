/**
 * Marcas do eixo vertical de um gráfico de preço: espaçadas por igual, em
 * passos redondos (1, 2, 2,5 ou 5 vezes uma potência de dez), e cobrindo do
 * menor ao maior valor da série. Sem isto, o eixo automático do Recharts
 * devolvia degraus desiguais (R$ 67, 64, 59, 54).
 */
export function escalaDoEixo(minimo: number, maximo: number, divisoes = 3): number[] {
  // Série quase reta (ou de um ponto só): dá uma folga mínima para o eixo ter altura.
  const amplitude = Math.max(maximo - minimo, Math.abs(maximo) * 0.02, 0.01);
  const bruto = amplitude / divisoes;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const fracao = bruto / potencia;
  const passo = (fracao <= 1 ? 1 : fracao <= 2 ? 2 : fracao <= 2.5 ? 2.5 : fracao <= 5 ? 5 : 10) * potencia;

  // A folga se reparte dos dois lados, para a série reta ficar no meio do eixo.
  const folga = Math.max(0, (amplitude - (maximo - minimo)) / 2);
  const base = Math.floor((minimo - folga) / passo) * passo;
  const topo = Math.ceil((maximo + folga) / passo) * passo;
  const marcas: number[] = [];
  for (let v = base; v <= topo + passo / 1000; v += passo) {
    marcas.push(Math.round(v * 1e6) / 1e6);
  }
  return marcas;
}
