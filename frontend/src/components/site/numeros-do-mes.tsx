import { numerosDoBento } from "@/lib/home-dados";
import { lerDadosDosIndices } from "@/lib/indices-api";
import { BentoAtivosIndices } from "./bento-ativos-indices";

/*
 * Os números do mês dentro do bento "Ativos e índices" da home. Ficam fora da página para poder chegar
 * por streaming: a home abre na hora com o conjunto fixo (NumerosDoMesFixos, o fallback do <Suspense>) e
 * troca pelos números ao vivo quando o backend responde. Quem espera é só esta seção, e no máximo 5 s.
 */

/** Na home, os números do mês têm reserva fixa: não vale segurar a seção pelos 20 s das páginas de índices. */
const PRAZO_DA_HOME_MS = 5_000;

/** O que a seção mostra enquanto o backend não responde: a referência fixa, rotulada como fixa e sem minigráfico. */
export function NumerosDoMesFixos() {
  return <BentoAtivosIndices dados={numerosDoBento(null)} />;
}

/** Lê os índices (Banco Central e Yahoo, via backend) e cai na referência fixa se a leitura falhar. */
export async function NumerosDoMesAoVivo() {
  return <BentoAtivosIndices dados={numerosDoBento(await lerDadosDosIndices({ prazoMs: PRAZO_DA_HOME_MS }))} />;
}
