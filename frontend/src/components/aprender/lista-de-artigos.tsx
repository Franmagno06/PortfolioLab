import Link from "next/link";
import { CATEGORIAS, rotuloDaCategoria, type IdDeCategoria } from "@/lib/aprender/tipos";
import { Revelar } from "@/components/movimento/revelar";
import { CardArtigo, type ResumoDeArtigo } from "./card-artigo";

/** Quantos cards aparecem antes de "Ver todos": duas linhas de três. */
export const INICIAIS = 6;

/** O endereço do índice com o filtro e a expansão que a pessoa escolheu. */
function href(tema: IdDeCategoria | null, todos = false): string {
  const p = new URLSearchParams();
  if (tema) p.set("tema", tema);
  if (todos) p.set("todos", "1");
  const q = p.toString();
  return q ? `/aprender?${q}` : "/aprender";
}

const botaoSecundario =
  "toque inline-flex min-h-11 w-fit items-center rounded border border-ink bg-card px-[18px] text-[15px] font-semibold text-ink hover:bg-paper";

/**
 * O filtro por tema e a grade de artigos, tudo no servidor: tema e expansão vivem na URL
 * (?tema=renda-fixa&todos=1). Cada chip é um link, então o filtro funciona sem JavaScript, dá para
 * mandar o endereço de um tema e o botão Voltar do navegador desfaz o filtro. Os cinco temas
 * aparecem sempre, mesmo os que ainda não têm artigo: clicar num deles mostra um estado vazio
 * com saída, em vez de esconder o tema e deixar a pessoa se perguntar onde ele foi parar.
 */
export function ListaDeArtigos({
  artigos,
  tema,
  todos,
}: {
  artigos: ResumoDeArtigo[];
  tema: IdDeCategoria | null;
  todos: boolean;
}) {
  const filtrados = tema ? artigos.filter((a) => a.categoria === tema) : artigos;
  const visiveis = todos ? filtrados : filtrados.slice(0, INICIAIS);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Filtrar por tema">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Chip ativo={tema === null} destino={href(null)}>
              Todos ({artigos.length})
            </Chip>
          </li>
          {CATEGORIAS.map((c) => (
            <li key={c.id}>
              <Chip ativo={tema === c.id} destino={href(c.id)}>
                {c.rotulo}
              </Chip>
            </li>
          ))}
        </ul>
      </nav>

      <h2 className="font-leitura text-2xl leading-[30px] font-semibold text-ink">{tema ? rotuloDaCategoria(tema) : "Artigos recentes"}</h2>

      {filtrados.length === 0 ? (
        <div role="status" className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-pauta bg-card p-6">
          <p className="font-leitura text-lg font-semibold text-ink">Ainda não há artigos neste tema.</p>
          <p className="text-[15px] leading-[22px] text-ink-2">
            Os próximos já estão a caminho. Enquanto isso, veja os que já foram publicados.
          </p>
          <Link href={href(null)} scroll={false} className={botaoSecundario}>
            Ver todos os artigos
          </Link>
        </div>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((a, i) => (
            <li key={a.slug} className="flex">
              {/* cascata de 90 ms por coluna: .cascata escolhe 1, 2 ou 3 colunas conforme a largura */}
              <Revelar
                className="cascata flex flex-1 [&>article]:flex-1"
                style={{ "--c2": i % 2, "--c3": i % 3 } as React.CSSProperties}
              >
                <CardArtigo artigo={a} />
              </Revelar>
            </li>
          ))}
        </ul>
      )}

      {filtrados.length > INICIAIS && (
        <Link href={href(tema, !todos)} scroll={false} className={botaoSecundario}>
          {todos ? "Ver menos" : `Ver todos os ${filtrados.length} artigos`}
        </Link>
      )}
    </div>
  );
}

function Chip({ ativo, destino, children }: { ativo: boolean; destino: string; children: React.ReactNode }) {
  return (
    <Link
      href={destino}
      scroll={false}
      aria-current={ativo ? "true" : undefined}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] leading-[22px] font-semibold toque ${
        ativo ? "border-ink bg-ink text-white" : "border-pauta bg-card text-ink hover:border-ink focus-visible:border-ink"
      }`}
    >
      {children}
    </Link>
  );
}
