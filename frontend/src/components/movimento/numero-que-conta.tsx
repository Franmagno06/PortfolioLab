"use client";

import { useEffect, useState } from "react";
import { brl, numero, percentual } from "@/lib/format";
import { DURACAO_CONTAGEM_MS, valorNaContagem } from "@/lib/movimento";
import { useVisibilidade } from "./usar-visibilidade";

export type FormatoDoNumero = "inteiro" | "pontos" | "percentual" | "brl";

function formatar(valor: number, formato: FormatoDoNumero, casas?: number): string {
  switch (formato) {
    case "percentual":
      return percentual(valor, casas ?? 2);
    case "brl":
      return brl(valor);
    case "inteiro":
    case "pontos":
      return numero(valor, casas ?? 0);
  }
}

// Por que existe: contar até o número chama o olho para o dado principal no momento em que ele
// chega à tela; quem usa leitor de tela ouve só o valor final, nunca os intermediários.
//
// Hidratação: o servidor e o primeiro render do cliente já mostram o valor FINAL, então o HTML
// bate e, com o JavaScript lento ou desligado, ninguém vê um 0. Só depois de montar, quando o
// observador responde, o número vai a 0 (se ainda está fora da tela) e conta ao chegar a 50%.
export function NumeroQueConta({
  valor,
  formato,
  casas,
}: {
  valor: number;
  formato: FormatoDoNumero;
  casas?: number;
}) {
  const [ref, visibilidade] = useVisibilidade<HTMLSpanElement>(0.5);
  // null = a contagem ainda não deu o primeiro quadro.
  const [decorrido, setDecorrido] = useState<number | null>(null);
  const [terminou, setTerminou] = useState(false);
  const entrou = visibilidade === "entrou";

  useEffect(() => {
    if (!entrou || typeof requestAnimationFrame !== "function") return;
    let inicio: number | null = null;
    let quadro = 0;
    // Um render por quadro, mas de um único <span>: barato, e o valor exibido segue o `valor`
    // atual mesmo se a prop mudar no meio da contagem.
    const passo = (agora: number) => {
      inicio ??= agora;
      const passou = agora - inicio;
      if (passou >= DURACAO_CONTAGEM_MS) {
        setTerminou(true);
        return;
      }
      setDecorrido(passou);
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [entrou]);

  const final = formatar(valor, formato, casas);
  const vaiContar =
    !terminou &&
    (visibilidade === "fora" || visibilidade === "entrou") &&
    typeof requestAnimationFrame === "function";
  const exibido = !vaiContar
    ? final
    : formatar(decorrido === null ? 0 : valorNaContagem(valor, decorrido), formato, casas);

  return (
    <span ref={ref} className="tnum">
      <span className="sr-only">{final}</span>
      <span aria-hidden="true">{exibido}</span>
    </span>
  );
}
