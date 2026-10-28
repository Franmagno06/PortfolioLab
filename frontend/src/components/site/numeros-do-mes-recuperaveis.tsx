"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { numerosDoBento } from "@/lib/home-dados";
import type { DadosDosIndices } from "@/lib/indices";
import { BentoAtivosIndices } from "./bento-ativos-indices";

/*
 * Por que existe: o servidor da home espera os índices só 5 s (o visitante não pode ficar preso), e uma API
 * fria ou um Banco Central lento estoura esse prazo. Antes, a home ficava na referência fixa até alguém
 * recarregar a página. Agora o navegador tenta de novo, com mais paciência, e troca pelos números reais
 * quando chegam. Enquanto isso, e se falhar também, vale a referência fixa, dita como fixa.
 *
 * Só entra no lugar quando o servidor NÃO conseguiu a resposta (null). Resposta incompleta, como um Banco
 * Central fora do ar, não é refeita aqui: o resultado seria o mesmo.
 */

/** O backend responde em até 15 s quando o Banco Central está lento; sobra folga para uma API acordando. */
const PRAZO_DO_NAVEGADOR_MS = 25_000;

export function NumerosDoMesRecuperaveis() {
  const [dados, setDados] = useState<DadosDosIndices | null>(null);

  useEffect(() => {
    const aborto = new AbortController();
    const prazo = setTimeout(() => aborto.abort(), PRAZO_DO_NAVEGADOR_MS);
    api<DadosDosIndices>("/indices/dados", { signal: aborto.signal })
      .then((lidos) => {
        if (!aborto.signal.aborted) setDados(lidos);
      })
      .catch(() => undefined); // continua na referência fixa
    return () => {
      clearTimeout(prazo);
      aborto.abort();
    };
  }, []);

  return <BentoAtivosIndices dados={numerosDoBento(dados)} />;
}
