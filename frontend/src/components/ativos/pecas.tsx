import Image from "next/image";
import Link from "next/link";
import { inicialDoAtivo } from "@/lib/ativos-catalogo";
import type { TipoFii } from "@/lib/ativos-tipos";
import { caminhoDoLogo } from "@/lib/ativos-logos";
import { pct } from "@/lib/format";

/** Peças pequenas, repetidas nas quatro páginas de ativos. */

export type Migalha = { rotulo: string; href?: string };

/**
 * "Início / Ativos / Ações / VALE3". Um nível sem `href` é só texto: "Ativos"
 * é um menu, não uma página, então não há para onde levar.
 */
export function Migalhas({ itens }: { itens: Migalha[] }) {
  return (
    <nav aria-label="Você está em">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
        {itens.map((item, i) => {
          const ultimo = i === itens.length - 1;
          return (
            <li key={item.rotulo} className="flex items-center gap-2">
              {ultimo ? (
                <span aria-current="page" className="font-semibold text-ink">
                  {item.rotulo}
                </span>
              ) : item.href ? (
                <Link href={item.href} className="rounded underline decoration-1 underline-offset-4 hover:text-ink">
                  {item.rotulo}
                </Link>
              ) : (
                <span>{item.rotulo}</span>
              )}
              {!ultimo && (
                <span aria-hidden className="text-mute">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** "‹ Voltar para ações": no alto e no pé da ficha. */
export function Voltar({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1.5 rounded text-sm font-medium text-ink underline decoration-1 underline-offset-4"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m15 18-6-6 6-6" />
      </svg>
      {rotulo}
    </Link>
  );
}

/**
 * A anotação na margem do caderno. Public Sans Medium em roxo, e não a serifa
 * itálica da página inicial: foi a decisão tomada depois do protótipo.
 */
export function Anotacao({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`flex items-start gap-2 text-sm leading-[21px] font-medium text-anotacao ${className}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-[3px] shrink-0">
        <path d="M5 4v6a4 4 0 0 0 4 4h10M15 9l5 5-5 5" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

const TRACOS = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Um ícone por tipo de fundo: prédio (tijolo), documento (papel), os dois (híbrido) e camadas (FoF). */
const ICONES_DE_FII: Record<TipoFii, React.ReactNode> = {
  Tijolo: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" />
    </>
  ),
  Papel: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </>
  ),
  Híbrido: (
    <>
      <rect x="3" y="9" width="9" height="12" rx="1" />
      <path d="M6 13h3M6 17h3M15 5h4v16h-4" />
    </>
  ),
  FoF: (
    <>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
};

/**
 * A identidade visual do ativo. Ação: o logo da empresa. FII: um ícone do tipo
 * do fundo, na cor da classe, porque o fundo não tem logo (a do gestor
 * confundiria). Sem logo nem tipo, a inicial do ticker num círculo.
 */
export function Avatar({
  ticker,
  tamanho,
  tipoFii,
}: {
  ticker: string;
  tamanho: "lista" | "ficha";
  tipoFii?: TipoFii;
}) {
  const px = tamanho === "ficha" ? 56 : 40;
  const dimensao = tamanho === "ficha" ? "h-14 w-14" : "h-10 w-10";
  const logo = tipoFii ? null : caminhoDoLogo(ticker);

  if (logo) {
    // unoptimized: é um SVG estático de public/, que não passa pelo otimizador de imagens.
    return (
      <Image
        src={logo}
        alt=""
        width={px}
        height={px}
        unoptimized
        className={`${dimensao} shrink-0 rounded-full border border-line`}
      />
    );
  }

  if (tipoFii) {
    const lado = tamanho === "ficha" ? 30 : 22;
    return (
      <span
        aria-hidden
        data-icone-de-fii={tipoFii}
        className={`grid ${dimensao} shrink-0 place-items-center rounded-full bg-fii/15 text-fii`}
      >
        <svg width={lado} height={lado} viewBox="0 0 24 24" aria-hidden {...TRACOS}>
          {ICONES_DE_FII[tipoFii]}
        </svg>
      </span>
    );
  }

  const estilo =
    tamanho === "ficha"
      ? "bg-marca-texto text-anotacao text-[26px]"
      : "border border-line bg-caderno text-ink-2 text-base";
  return (
    <span aria-hidden className={`grid ${dimensao} shrink-0 place-items-center rounded-full font-leitura font-semibold ${estilo}`}>
      {inicialDoAtivo(ticker)}
    </span>
  );
}

/** Variação do dia: sinal e seta, além da cor, para quem não distingue verde de vermelho. */
export function VariacaoDoDia({ valor, sufixo = "" }: { valor: number | null; sufixo?: string }) {
  if (valor === null) return <span className="text-mute">variação indisponível</span>;
  if (valor === 0) {
    return <span className="tnum text-mute">{pct(valor)}{sufixo}</span>;
  }
  const subiu = valor > 0;
  return (
    <span className={`tnum ${subiu ? "text-gain-ink" : "text-loss-ink"}`}>
      <span aria-hidden>{subiu ? "▲" : "▼"}</span> {pct(valor)}
      <span className="sr-only">{subiu ? " (alta)" : " (queda)"}</span>
      {sufixo}
    </span>
  );
}
