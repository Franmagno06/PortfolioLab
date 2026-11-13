"use client";

import { useEffect, useSyncExternalStore } from "react";
import { consultarSessao, observarSessao, ultimaSessaoConhecida, type Sessao } from "./sessao-do-visitante";

const NO_SERVIDOR = () => null;

/**
 * A sessão de quem vê o site público, para a tela: null enquanto não se sabe (o HTML do servidor
 * não sabe, e a consulta falhou ou ainda não voltou). Nasce com a última resposta conhecida na aba,
 * então voltar da carteira pelo menu não pisca, e acompanha login e "Sair" sem recarregar.
 *
 * `consultar`: pergunta ao backend ao montar (a consulta é dividida com quem mais estiver perguntando).
 */
export function useSessaoDoVisitante(consultar = true): Sessao | null {
  const sessao = useSyncExternalStore(observarSessao, ultimaSessaoConhecida, NO_SERVIDOR);
  useEffect(() => {
    if (consultar) void consultarSessao();
  }, [consultar]);
  return sessao;
}
