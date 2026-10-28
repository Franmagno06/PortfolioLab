"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { EmptyState } from "@/components/ui/empty-state";
import { MensagemErro } from "@/components/ui/mensagem";
import { api, ApiError, type Pagina } from "@/lib/api";
import { brl, dataCurta, quantidadeTexto } from "@/lib/format";

// Forma de GET /transactions. Quantidade, preço e taxa são Prisma.Decimal no
// servidor e chegam como string no JSON; convertem-se só para exibir.
type Transacao = {
  id: string;
  kind: "COMPRA" | "VENDA";
  quantity: string | number;
  unitPrice: string | number;
  fee: string | number;
  executedAt: string;
  asset: { ticker: string; name: string; type: string };
};

type Lista = { itens: Transacao[]; cursor: string | null };

const POR_PAGINA = 20;

type Props = {
  /** Chamado depois de uma exclusão bem-sucedida, para a página recarregar as posições. */
  aoApagar: () => void;
};

const nomeDaOperacao = { COMPRA: "Compra", VENDA: "Venda" } as const;

function descricao(t: Transacao): string {
  return `${nomeDaOperacao[t.kind]} de ${quantidadeTexto(t.quantity)} ${t.asset.ticker} em ${dataCurta(t.executedAt)}`;
}

// Só a palavra da operação vai para minúscula: "petr4" seria lido como palavra.
function descricaoDoBotao(t: Transacao): string {
  return `Apagar ${nomeDaOperacao[t.kind].toLowerCase()} de ${quantidadeTexto(t.quantity)} ${t.asset.ticker} em ${dataCurta(t.executedAt)}`;
}

/**
 * Pergunta da confirmação. Apagar uma compra recalcula quantidade e preço médio;
 * apagar uma venda devolve as cotas e só mexe no preço médio se houver compra
 * do ativo depois dela (a venda em si não altera o PM).
 */
function perguntaDeConfirmacao(t: Transacao): string {
  const qtd = quantidadeTexto(t.quantity);
  const { ticker } = t.asset;
  const data = dataCurta(t.executedAt);
  if (t.kind === "COMPRA") {
    return `Apagar esta compra de ${qtd} ${ticker} em ${data}? A quantidade e o preço médio de ${ticker} serão recalculados sem ela.`;
  }
  const volta =
    Number(t.quantity) <= 1 ? `A ${qtd} cota volta` : `As ${qtd} cotas voltam`;
  return `Apagar esta venda de ${qtd} ${ticker} em ${data}? ${volta} para a sua posição. O preço médio só muda se houver compra de ${ticker} depois desta venda.`;
}

type PedidoDeFoco = { alvo: "apagar"; id: string } | { alvo: "titulo" } | null;

export function HistoricoTransacoes({ aoApagar }: Props) {
  const [lista, setListaEstado] = useState<Lista | null>(null);
  // Espelho síncrono da lista: respostas assíncronas (página nova, DELETE) sempre
  // partem do valor MAIS RECENTE, nunca de uma cópia capturada antes do await.
  const listaRef = useRef<Lista | null>(null);
  // Ids apagados nesta sessão: uma página que chegue atrasada não os traz de volta
  // nem aponta o cursor para eles.
  const apagados = useRef(new Set<string>());

  const [erroLista, setErroLista] = useState<string | null>(null);
  const [erroMais, setErroMais] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  // recarga da primeira página em andamento: não é hora de dizer "lista vazia"
  const [recarregando, setRecarregando] = useState(false);

  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [erroLinha, setErroLinha] = useState<{ id: string; mensagem: string } | null>(null);
  const [aviso, setAviso] = useState("");

  // ref e não state: pedir foco não deve provocar outra renderização
  const pedidoDeFoco = useRef<PedidoDeFoco>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const botoesApagar = useRef(new Map<string, HTMLButtonElement>());

  const definirLista = useCallback((nova: Lista | null) => {
    listaRef.current = nova;
    setListaEstado(nova);
  }, []);

  const carregarInicio = useCallback(() => {
    api<Pagina<Transacao>>(`/transactions?limite=${POR_PAGINA}`)
      .then((p) => {
        setErroLista(null);
        setRecarregando(false);
        definirLista({
          itens: p.itens.filter((t) => !apagados.current.has(t.id)),
          cursor: p.proximoCursor,
        });
      })
      .catch((err) => {
        setRecarregando(false);
        setErroLista(err instanceof ApiError ? err.message : "Falha ao carregar o histórico");
      });
  }, [definirLista]);

  useEffect(() => {
    carregarInicio();
  }, [carregarInicio]);

  // Foco: ao abrir a confirmação vai para "Cancelar" (o lado seguro); ao
  // cancelar volta para o "Apagar" da linha; depois de apagar, a linha some e o
  // foco vai para o título da seção, em vez de se perder no <body>.
  useEffect(() => {
    if (confirmando) cancelarRef.current?.focus();
  }, [confirmando]);

  // sem lista de dependências: roda depois de toda renderização e só age
  // quando um handler deixou um pedido pendente
  useEffect(() => {
    const pedido = pedidoDeFoco.current;
    if (!pedido) return;
    pedidoDeFoco.current = null;
    if (pedido.alvo === "titulo") tituloRef.current?.focus();
    else botoesApagar.current.get(pedido.id)?.focus();
  });

  async function carregarMais() {
    const cursor = listaRef.current?.cursor;
    if (!cursor || carregandoMais || apagando) return;
    setCarregandoMais(true);
    setErroMais(null);
    try {
      const p = await api<Pagina<Transacao>>(
        `/transactions?limite=${POR_PAGINA}&cursor=${encodeURIComponent(cursor)}`,
      );
      // O cursor desta requisição foi apagado durante a espera: o servidor, sem o ponto de
      // partida, devolve lista vazia e cursor nulo. Resposta descartada; vale o cursor atual.
      if (apagados.current.has(cursor)) return;
      // parte da lista de AGORA, que pode ter perdido linhas durante a espera
      const atual = listaRef.current ?? { itens: [], cursor: null };
      const ids = new Set(atual.itens.map((t) => t.id));
      const novos = p.itens.filter((t) => !ids.has(t.id) && !apagados.current.has(t.id));
      const itens = [...atual.itens, ...novos];
      let proximo = p.proximoCursor;
      // um cursor apagado faria o servidor devolver lista vazia: recua para o último item vivo
      if (proximo && apagados.current.has(proximo)) proximo = itens[itens.length - 1]?.id ?? null;
      definirLista({ itens, cursor: proximo });
    } catch (err) {
      setErroMais(err instanceof ApiError ? err.message : "Falha ao carregar mais transações");
    } finally {
      setCarregandoMais(false);
    }
  }

  function abrirConfirmacao(id: string) {
    if (apagando || carregandoMais) return;
    setErroLinha(null);
    setAviso("");
    setConfirmando(id);
  }

  function cancelar(id: string) {
    if (apagando) return;
    setConfirmando(null);
    pedidoDeFoco.current = { alvo: "apagar", id };
  }

  async function confirmar(t: Transacao) {
    if (apagando || carregandoMais) return;
    setApagando(t.id);
    try {
      await api(`/transactions/${encodeURIComponent(t.id)}`, { method: "DELETE" });
    } catch (err) {
      setErroLinha({
        id: t.id,
        mensagem: err instanceof ApiError ? err.message : "Não foi possível apagar a transação",
      });
      setConfirmando(null);
      setApagando(null);
      pedidoDeFoco.current = { alvo: "apagar", id: t.id };
      return;
    }

    apagados.current.add(t.id);
    // Sempre a lista de agora: uma página carregada durante o DELETE não pode sumir.
    const atual = listaRef.current;
    let recomecar = false;
    if (atual) {
      const posicao = atual.itens.findIndex((x) => x.id === t.id);
      const itens = atual.itens.filter((x) => x.id !== t.id);
      let cursor = atual.cursor;
      // O cursor é o id do último item entregue. Se foi esse que saiu, o servidor
      // não acharia mais o ponto de partida e devolveria lista vazia: passa para o
      // item anterior (ou, sem anterior, recomeça da primeira página).
      if (cursor === t.id) {
        const anterior = atual.itens[posicao - 1];
        if (anterior) cursor = anterior.id;
        else recomecar = true;
      }
      definirLista({ itens, cursor });
    }
    if (recomecar) {
      setRecarregando(true);
      carregarInicio();
    }
    setConfirmando(null);
    setApagando(null);
    setAviso(`${descricao(t)} apagada.`);
    pedidoDeFoco.current = { alvo: "titulo" };
    aoApagar();
  }

  const itens = lista?.itens ?? null;
  const cursor = lista?.cursor ?? null;

  return (
    <section aria-labelledby="titulo-historico" className="space-y-3">
      <div>
        <h2
          id="titulo-historico"
          ref={tituloRef}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          Histórico de transações
        </h2>
        <p className="text-sm text-mute">Da mais recente para a mais antiga.</p>
      </div>

      {/* região viva sempre montada: o leitor de tela só anuncia o que muda dentro dela */}
      <p role="status" className={aviso ? "text-sm text-gain-ink" : "sr-only"}>
        {aviso}
      </p>

      {erroLista ? (
        <div className="space-y-3">
          <MensagemErro>{erroLista}</MensagemErro>
          <Botao
            variante="secundario"
            className="min-h-11"
            onClick={() => {
              setErroLista(null);
              carregarInicio();
            }}
          >
            Tentar de novo
          </Botao>
        </div>
      ) : !itens || recarregando ? (
        <div className="space-y-2" aria-busy="true" aria-label="Carregando histórico">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md border border-line bg-card" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <EmptyState
          titulo="Você ainda não registrou transações"
          descricao="Cada compra ou venda que você registrar aparece aqui, e dá para apagar a que estiver errada."
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-md border border-line bg-card">
            {/* cabeçalho só visual: no leitor de tela, cada valor carrega o próprio rótulo (sr-only) */}
            <div
              aria-hidden="true"
              className="hidden grid-cols-[minmax(0,1.6fr)_5rem_6.5rem_5rem_7rem_6rem_7.5rem] gap-x-3 border-b border-line px-5 py-3 text-xs font-semibold text-mute md:grid"
            >
              <span>Ativo</span>
              <span>Operação</span>
              <span>Data</span>
              <span className="text-right">Qtd.</span>
              <span className="text-right">Preço</span>
              <span className="text-right">Taxa</span>
              <span />
            </div>
            <ul className="divide-y divide-line">
              {itens.map((t) => (
                <li
                  key={t.id}
                  className="linha-de-tabela grid grid-cols-2 items-center gap-x-3 gap-y-1.5 px-4 py-3.5 text-sm hover:bg-paper has-[:focus-visible]:bg-paper md:grid-cols-[minmax(0,1.6fr)_5rem_6.5rem_5rem_7rem_6rem_7.5rem] md:px-5"
                >
                  <div className="min-w-0">
                    <p className="tnum font-semibold">{t.asset.ticker}</p>
                    <p className="line-clamp-1 text-xs text-mute" title={t.asset.name}>
                      {t.asset.name}
                    </p>
                  </div>
                  <p className="justify-self-end md:justify-self-start">
                    {/* texto + borda + símbolo: a diferença não depende de cor */}
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold ${
                        t.kind === "COMPRA"
                          ? "border-gain-ink/30 text-gain-ink"
                          : "border-loss-ink/30 text-loss-ink"
                      }`}
                    >
                      <span aria-hidden="true">{t.kind === "COMPRA" ? "+" : "−"}</span>
                      {nomeDaOperacao[t.kind]}
                    </span>
                  </p>
                  <p className="tnum text-ink-2">
                    <span className="mr-1.5 text-xs text-mute md:sr-only">Data</span>
                    {dataCurta(t.executedAt)}
                  </p>
                  <p className="tnum text-right">
                    <span className="mr-1.5 text-xs text-mute md:sr-only">Qtd.</span>
                    {quantidadeTexto(t.quantity)}
                  </p>
                  <p className="tnum md:text-right">
                    <span className="mr-1.5 text-xs text-mute md:sr-only">Preço</span>
                    {brl(Number(t.unitPrice))}
                  </p>
                  <p className="tnum text-right text-mute">
                    <span className="mr-1.5 text-xs md:sr-only">Taxa</span>
                    {brl(Number(t.fee))}
                  </p>

                  {confirmando !== t.id && (
                    <div className="col-span-2 md:col-span-1 md:justify-self-end">
                      <Botao
                        variante="secundario"
                        tamanho="sm"
                        className="min-h-11 w-full md:min-w-24"
                        disabled={apagando !== null || carregandoMais}
                        aria-label={descricaoDoBotao(t)}
                        ref={(el) => {
                          if (el) botoesApagar.current.set(t.id, el);
                          else botoesApagar.current.delete(t.id);
                        }}
                        onClick={() => abrirConfirmacao(t.id)}
                      >
                        Apagar
                      </Botao>
                    </div>
                  )}

                  {confirmando === t.id && (
                    <div
                      role="group"
                      aria-labelledby={`pergunta-${t.id}`}
                      className="col-span-full mt-1 space-y-3 rounded border border-loss-ink/25 bg-loss/6 p-3"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") cancelar(t.id);
                      }}
                    >
                      <p id={`pergunta-${t.id}`} className="text-sm">
                        {perguntaDeConfirmacao(t)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Botao
                          variante="perigo"
                          className="min-h-11 min-w-28"
                          disabled={apagando === t.id || carregandoMais}
                          onClick={() => confirmar(t)}
                        >
                          {apagando === t.id ? "Apagando…" : "Apagar"}
                        </Botao>
                        <Botao
                          variante="secundario"
                          className="min-h-11 min-w-28"
                          disabled={apagando === t.id}
                          onClick={() => cancelar(t.id)}
                          ref={cancelarRef}
                        >
                          Cancelar
                        </Botao>
                      </div>
                    </div>
                  )}

                  {erroLinha?.id === t.id && (
                    <div className="col-span-full mt-1">
                      <MensagemErro>{erroLinha.mensagem}</MensagemErro>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {erroMais && <MensagemErro>{erroMais}</MensagemErro>}
          {cursor && (
            <div className="flex justify-center">
              <Botao
                variante="secundario"
                className="min-h-11"
                disabled={carregandoMais || apagando !== null}
                onClick={carregarMais}
              >
                {carregandoMais ? "Carregando…" : "Carregar mais"}
              </Botao>
            </div>
          )}
        </>
      )}
    </section>
  );
}
