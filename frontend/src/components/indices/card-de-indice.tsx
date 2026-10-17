import Link from "next/link";
import { Dica } from "@/components/ativos/dica";
import { rotaDoIndice, type Destaque, type Indice } from "@/lib/indices";
import { IconeDoIndice, Variacao } from "./pecas-da-ficha";

/**
 * O minigráfico do card: os últimos 12 meses, sem eixo nem rótulo. É só a forma da curva; os números
 * estão escritos logo abaixo, então o desenho fica escondido do leitor de tela.
 */
function Sparkline({ valores }: { valores: number[] }) {
  const largura = 240;
  const altura = 36;
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const amplitude = maximo - minimo || 1;
  const pontos = valores
    .map((v, i) => {
      const x = valores.length === 1 ? largura / 2 : (i / (valores.length - 1)) * largura;
      const y = altura - 2 - ((v - minimo) / amplitude) * (altura - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none" aria-hidden className="h-9 w-full">
      <polyline points={pontos} fill="none" stroke="#7359e5" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * O card de um índice na listagem. O card inteiro leva à ficha, mas o link é só o nome: o `::after`
 * dele estica a área de clique pelo card. Assim o "?" fica fora do link (um botão dentro de um link é
 * HTML inválido) e, por estar numa camada acima, abre a explicação sem navegar.
 */
export function CardDeIndice({ indice, destaque }: { indice: Indice; destaque: Destaque }) {
  const { secundario } = destaque;
  return (
    <article className="group relative flex w-full flex-col rounded-md border border-pauta bg-card transition-colors hover:border-ink-2">
      <div className="flex items-center gap-3.5 p-5 lg:px-4">
        <IconeDoIndice indice={indice} tamanho="card" />
        <div className="min-w-0">
          <h2 className="font-leitura text-xl leading-[26px] font-semibold text-ink">
            <Link
              href={rotaDoIndice(indice.slug)}
              className="rounded after:absolute after:inset-0 after:rounded-md after:content-[''] group-hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ink"
            >
              {indice.nome}
            </Link>
          </h2>
          <p className="text-[13px] leading-[19px] text-mute">{indice.codigo}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 border-t border-pauta p-5 lg:px-4">
        <Sparkline valores={destaque.sparkline} />

        <dl className="space-y-2.5 text-[15px] leading-[22px]">
          <div className="flex items-center gap-1.5">
            <dt className="whitespace-nowrap text-ink-2">{indice.rotuloDoValor}</dt>
            {/* acima do link esticado: tocar no "?" abre a dica e não navega */}
            <span className="relative z-10 inline-flex">
              <Dica id={indice.dica} />
            </span>
            <dd className="tnum ml-auto font-semibold whitespace-nowrap text-ink">{destaque.valorFormatado}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="whitespace-nowrap text-ink-2">{secundario.rotulo}</dt>
            <dd className="font-semibold whitespace-nowrap">
              {/* taxa que cai não é perda: nas taxas a seta fica, a cor de ganho e perda não */}
              <Variacao valor={secundario.variacao} texto={secundario.texto} neutra={indice.tipo === "taxa"} />
            </dd>
          </div>
        </dl>

        <p className="text-[13px] leading-[19px] text-mute">{indice.descricao}</p>
        <p aria-hidden className="mt-auto text-[15px] leading-[22px] font-semibold text-anotacao">
          Ver gráfico →
        </p>
      </div>
    </article>
  );
}
