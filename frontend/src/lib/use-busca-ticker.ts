"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "./api";

export type Cotacao = { ticker: string; nome: string; preco: number; tipo: string };

// 4 letras + 1 ou 2 números — o padrão da B3 (PETR4, MXRF11)
export const FORMATO_TICKER = /^[A-Z]{4}\d{1,2}$/;

// atraso antes de consultar, para não disparar uma busca a cada tecla
const ATRASO_MS = 500;

/** Normaliza o que o usuário digita num ticker da B3: caixa alta, sem símbolos. */
export function normalizarTicker(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// O estado guarda para QUAL ticker ele vale. Assim o resultado da busca
// anterior é descartado por derivação, sem precisar de um setState no corpo do
// efeito a cada tecla digitada.
type Estado = { para: string; cotacao: Cotacao | null; erro: string | null; buscando: boolean };

const VAZIO: Estado = { para: "", cotacao: null, erro: null, buscando: false };

/**
 * Consulta o ticker na B3 enquanto o usuário digita, com atraso.
 *
 * Usado nos dois lugares em que se escolhe um ativo — o formulário de transação
 * e o editor de metas —, para que a regra de "qual ticker é válido" viva num
 * lugar só. Enquanto o texto não tiver o formato da B3, não há consulta.
 */
export function useBuscaTicker(ticker: string) {
  const [estado, setEstado] = useState<Estado>(VAZIO);
  const valido = FORMATO_TICKER.test(ticker);

  useEffect(() => {
    if (!FORMATO_TICKER.test(ticker)) return;

    // cancelado evita que uma resposta atrasada sobrescreva uma busca mais nova
    let cancelado = false;

    const timer = setTimeout(async () => {
      if (!cancelado) setEstado({ para: ticker, cotacao: null, erro: null, buscando: true });
      try {
        const cotacao = await api<Cotacao>(`/quotes/${ticker}`);
        if (!cancelado) setEstado({ para: ticker, cotacao, erro: null, buscando: false });
      } catch (err) {
        if (cancelado) return;
        setEstado({
          para: ticker,
          cotacao: null,
          erro: err instanceof ApiError ? err.message : "Falha ao buscar o ticker",
          buscando: false,
        });
      }
    }, ATRASO_MS);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [ticker]);

  const atual = estado.para === ticker;

  return {
    cotacao: atual ? estado.cotacao : null,
    // fora do atraso ainda não há estado para este ticker: já conta como busca
    buscando: atual ? estado.buscando : valido,
    erro: atual ? estado.erro : null,
  };
}
