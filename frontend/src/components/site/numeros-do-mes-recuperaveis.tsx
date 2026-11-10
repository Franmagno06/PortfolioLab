"use client";

import { useEffect, useState } from "react";
import { apiPublica } from "@/lib/api";
import { numerosDoBento } from "@/lib/home-dados";
import type { DadosDosIndices } from "@/lib/indices";
import { BentoAtivosIndices } from "./bento-ativos-indices";

/*
 * Por que existe: o servidor da home espera os índices só 5 s (o visitante não pode ficar preso), e uma API
 * fria ou um Banco Central lento estoura esse prazo. Quando o servidor não conseguiu a resposta (null) ou
 * recebeu alguma série vazia, o navegador tenta de novo com mais paciência e troca pelos números reais
 * quando chegam. Além disso, atualiza os números a cada 60 s enquanto a página está visível.
 */

/** Mais que os 20 s do servidor (indices-api.ts): sobra folga para uma API que ainda está acordando. */
const PRAZO_DO_NAVEGADOR_MS = 25_000;
const INTERVALO_ATUALIZACAO_MS = 60_000;

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

function serieIncompleta(dados: DadosDosIndices | null): boolean {
  return (
    dados === null ||
    !dados.pontos.ibovespa.length ||
    !dados.selicMensal.length ||
    !dados.ipcaMensal.length ||
    !dados.pontos.ifix.length
  );
}

function mesclarDados(anterior: DadosDosIndices | null, novo: DadosDosIndices): DadosDosIndices {
  if (!anterior) return novo;
  return {
    ...novo,
    selicMensal: novo.selicMensal.length ? novo.selicMensal : anterior.selicMensal,
    ipcaMensal: novo.ipcaMensal.length ? novo.ipcaMensal : anterior.ipcaMensal,
    cdiMensal: novo.cdiMensal.length ? novo.cdiMensal : anterior.cdiMensal,
    cdiTaxaMensal: novo.cdiTaxaMensal.length ? novo.cdiTaxaMensal : anterior.cdiTaxaMensal,
    pontos: {
      ibovespa: novo.pontos.ibovespa.length ? novo.pontos.ibovespa : anterior.pontos.ibovespa,
      ifix: novo.pontos.ifix.length ? novo.pontos.ifix : anterior.pontos.ifix,
      smll: novo.pontos.smll.length ? novo.pontos.smll : anterior.pontos.smll,
      sp500: novo.pontos.sp500.length ? novo.pontos.sp500 : anterior.pontos.sp500,
      idiv: novo.pontos.idiv.length ? novo.pontos.idiv : anterior.pontos.idiv,
    },
  };
}

export function NumerosDoMesRecuperaveis({ dadosIniciais = null }: { dadosIniciais?: DadosDosIndices | null } = {}) {
  const [dados, setDados] = useState<DadosDosIndices | null>(dadosIniciais);
  const [atualizadoNoCliente, setAtualizadoNoCliente] = useState(false);

  useEffect(() => {
    let desmontado = false;
    let abortoAtual: AbortController | null = null;
    let prazoAtual: ReturnType<typeof setTimeout> | null = null;

    function buscar() {
      abortoAtual?.abort();
      if (prazoAtual) clearTimeout(prazoAtual);

      const aborto = new AbortController();
      abortoAtual = aborto;
      const prazo = setTimeout(() => aborto.abort(), PRAZO_DO_NAVEGADOR_MS);
      prazoAtual = prazo;

      apiPublica<unknown>("/indices/dados", { signal: aborto.signal })
        .then((lidos) => {
          if (!desmontado && !aborto.signal.aborted && temFormaDeDados(lidos)) {
            setDados((anterior) => mesclarDados(anterior, lidos));
            setAtualizadoNoCliente(true);
          }
        })
        .catch(() => undefined) // continua na referência atual
        .finally(() => clearTimeout(prazo));
    }

    if (serieIncompleta(dadosIniciais)) {
      buscar();
    }

    const intervalo = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        buscar();
      }
    }, INTERVALO_ATUALIZACAO_MS);

    return () => {
      desmontado = true;
      clearInterval(intervalo);
      if (prazoAtual) clearTimeout(prazoAtual);
      abortoAtual?.abort();
    };
  }, [dadosIniciais]);

  const bento = numerosDoBento(dados);
  return (
    <>
      <BentoAtivosIndices dados={bento} reservarMinigrafico />
      {/* a troca acontece depois que a pessoa talvez já leu os números: o leitor de tela é avisado */}
      <p role="status" className="sr-only">
        {atualizadoNoCliente && bento.numeros.aoVivo
          ? "Os números de Ativos e índices foram atualizados com os dados de hoje."
          : ""}
      </p>
    </>
  );
}
