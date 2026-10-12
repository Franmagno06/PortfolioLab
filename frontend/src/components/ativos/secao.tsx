import { Skeleton } from "@/components/ui/skeleton";

export type EstadoDaSecao = "pronto" | "carregando" | "erro" | "vazio";

type Props = {
  /** Identificador único na página: liga o título à região, para o leitor de tela. */
  id: string;
  titulo: string;
  subtitulo?: React.ReactNode;
  /** Todo bloco que depende de dado externo passa por aqui: pronto, carregando, erro ou vazio. */
  estado?: EstadoDaSecao;
  /** O que aparece quando não há nada para mostrar: diz o que falta e como sair dali. */
  vazio?: React.ReactNode;
  /** Quantas linhas de esqueleto mostrar enquanto carrega. */
  linhas?: number;
  className?: string;
  children?: React.ReactNode;
};

/**
 * O card de cada bloco da ficha. Com `estado="pronto"` mostra o conteúdo; nos
 * outros três, mostra o que a pessoa precisa ver quando o dado não está lá.
 * O erro e o vazio aparecem quando a fonte do bloco não respondeu ou não tem o que mostrar.
 */
export function Secao({
  id,
  titulo,
  subtitulo,
  estado = "pronto",
  vazio,
  linhas = 3,
  className = "",
  children,
}: Props) {
  const idDoTitulo = `${id}-titulo`;

  return (
    <section aria-labelledby={idDoTitulo} className={`rounded-md border border-line bg-card p-6 ${className}`}>
      <h2 id={idDoTitulo} className="font-leitura text-xl leading-7 font-semibold">
        {titulo}
      </h2>
      {subtitulo && <p className="mt-2 text-sm leading-[21px] text-mute">{subtitulo}</p>}

      <div className="mt-5">
        {estado === "carregando" && (
          <div role="status" aria-label={`Carregando ${titulo}`} className="space-y-3">
            {Array.from({ length: linhas }, (_, i) => (
              <Skeleton key={i} className="h-10 rounded" />
            ))}
          </div>
        )}

        {estado === "erro" && (
          <div role="alert" className="rounded border border-loss/40 bg-card px-4 py-3 text-sm">
            <p className="font-semibold text-loss-ink">Não foi possível carregar este bloco agora.</p>
            <p className="mt-1 text-ink-2">Os outros dados da página continuam valendo. Atualize a página para tentar de novo.</p>
          </div>
        )}

        {estado === "vazio" && vazio}

        {estado === "pronto" && children}
      </div>
    </section>
  );
}
