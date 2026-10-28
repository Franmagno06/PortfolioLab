"use client";

import { useEffect, useState } from "react";
import { apiPublica } from "@/lib/api";
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

/** Mais que os 20 s do servidor (indices-api.ts): sobra folga para uma API que ainda está acordando. */
const PRAZO_DO_NAVEGADOR_MS = 25_000;

const ehLista = (v: unknown) => Array.isArray(v);

/** Só aceita o que tem a forma de DadosDosIndices: um 200 de outra versão da API não pode quebrar a home. */
function temFormaDeDados(v: unknown): v is DadosDosIndices {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  const pontos = d.pontos as Record<string, unknown> | undefined;
  return (
    typeof d.hoje === "string" &&
    ["selicMensal", "ipcaMensal", "cdiMensal", "cdiTaxaMensal"].every((k) => ehLista(d[k])) &&
    !!pontos &&
    typeof pontos === "object" &&
    ["ibovespa", "ifix", "smll", "sp500", "idiv"].every((k) => ehLista(pontos[k]))
  );
}

export function NumerosDoMesRecuperaveis() {
  const [dados, setDados] = useState<DadosDosIndices | null>(null);

  useEffect(() => {
    // um controle só: aborta no prazo e ao desmontar (o servidor trocou a seção, a pessoa saiu da página)
    const aborto = new AbortController();
    const prazo = setTimeout(() => aborto.abort(), PRAZO_DO_NAVEGADOR_MS);
    apiPublica<unknown>("/indices/dados", { signal: aborto.signal })
      .then((lidos) => {
        if (!aborto.signal.aborted && temFormaDeDados(lidos)) setDados(lidos);
      })
      .catch(() => undefined) // continua na referência fixa
      .finally(() => clearTimeout(prazo));
    return () => {
      clearTimeout(prazo);
      aborto.abort();
    };
  }, []);

  const bento = numerosDoBento(dados);
  return (
    <>
      <BentoAtivosIndices dados={bento} reservarMinigrafico />
      {/* a troca acontece depois que a pessoa talvez já leu os números: o leitor de tela é avisado */}
      <p role="status" className="sr-only">
        {bento.numeros.aoVivo ? "Os números de Ativos e índices foram atualizados com os dados de hoje." : ""}
      </p>
    </>
  );
}
