import { z } from "zod";

/**
 * Só letras e dígitos, 4 a 12 caracteres.
 *
 * Existe porque o ticker não fica só no banco: ele é interpolado na URL do
 * provedor de cotação (`quotes.provider.ts:buscarCotacao`) e usado para achar
 * o CNPJ na tabela da CVM. Antes desta validação, `transactions`, `dividends`
 * e `goals` aceitavam qualquer string não vazia — só `reports` tinha regra —,
 * então um ticker como "../../v1/foo" era aceito e chegava à montagem da URL.
 *
 * Deliberadamente mais largo que o formato da B3 (4 letras + 1 a 3 dígitos):
 * `IPCA2035`, o Tesouro IPCA+ 2035 do seed, é RENDA_FIXA e não tem código de
 * negociação. Uma regra estrita passaria no teste e só quebraria na carteira
 * de quem tem Tesouro Direto lançado à mão. O que importa aqui é recusar o
 * que muda o significado de uma URL — `/`, `.`, `?`, `#`, `:`, espaço —, e
 * para isso o alfanumérico basta.
 */
export const TICKER_REGEX = /^[A-Z0-9]{4,12}$/;

export const tickerSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(TICKER_REGEX, "Ticker inválido — use apenas letras e números, como PETR4 ou HGLG11");
