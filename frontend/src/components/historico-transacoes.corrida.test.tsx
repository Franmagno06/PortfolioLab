// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { HistoricoTransacoes } from "./historico-transacoes";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api,
}));

afterEach(() => {
  cleanup();
  api.mockReset();
});

function transacao(id: string, ticker: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    kind: "COMPRA",
    quantity: "10.00000000",
    unitPrice: "30.50",
    fee: "1.00",
    executedAt: "2026-03-12T00:00:00.000Z",
    asset: { ticker, name: `${ticker} S.A.`, type: "ACAO" },
    ...extra,
  };
}

const t1 = transacao("t1", "PETR4");
const t2 = transacao("t2", "VALE3");
const t3 = transacao("t3", "ITUB4");
const t4 = transacao("t4", "BBAS3");
const primeiraPagina = { itens: [t1, t2], proximoCursor: "t2" };

function controlada<T>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((res) => {
    resolver = res;
  });
  return { promessa, resolver };
}

const tickersNaTela = () =>
  screen.getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent);

async function clicar(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el);
  });
}

async function abrirConfirmacao(indice = 0) {
  const botoes = await screen.findAllByRole("button", { name: /^Apagar/ });
  fireEvent.click(botoes[indice]!);
}

const botaoMais = () => screen.getByRole("button", { name: "Carregar mais" }) as HTMLButtonElement;

describe("Carregar mais e DELETE: um de cada vez", () => {
  it("Confirmar fica desabilitado enquanto a página carrega: clicar não dispara DELETE", async () => {
    const pagina = controlada<unknown>();
    api.mockResolvedValueOnce(primeiraPagina);
    api.mockReturnValueOnce(pagina.promessa);
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await abrirConfirmacao(); // t1 em confirmação
    const confirmar = screen.getByRole("button", { name: "Apagar" }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(false); // gêmeo: sem página pendente, habilitado
    await clicar(botaoMais());
    expect(confirmar.disabled).toBe(true);
    await clicar(confirmar);
    expect(api.mock.calls.filter((c) => c[1]?.method === "DELETE")).toHaveLength(0);

    await act(async () => {
      pagina.resolver({ itens: [t3], proximoCursor: "t3" });
    });
    expect((screen.getByRole("button", { name: "Apagar" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("confirmação aberta na linha do cursor: carrega a página, e só depois apagar mantém o cursor da página", async () => {
    const pagina = controlada<unknown>();
    api.mockResolvedValueOnce(primeiraPagina); // cursor t2
    api.mockReturnValueOnce(pagina.promessa);
    api.mockResolvedValueOnce(undefined); // DELETE t2
    api.mockResolvedValueOnce({ itens: [t4], proximoCursor: null });
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await screen.findByText("VALE3 S.A.");
    fireEvent.click(screen.getAllByRole("button", { name: /^Apagar/ })[1]!); // confirmação em t2
    await clicar(botaoMais());
    await clicar(screen.getByRole("button", { name: "Apagar" })); // desabilitado: nada acontece
    await act(async () => {
      pagina.resolver({ itens: [t3], proximoCursor: "t3" });
    });
    await clicar(screen.getByRole("button", { name: "Apagar" }));

    expect(tickersNaTela()).toEqual(["PETR4", "ITUB4"]);
    await clicar(botaoMais());
    expect(api).toHaveBeenLastCalledWith("/transactions?limite=20&cursor=t3");
  });

  it("gêmeo sem sobreposição: carregar a página 2 e só depois apagar mantém as duas páginas", async () => {
    api.mockResolvedValueOnce(primeiraPagina);
    api.mockResolvedValueOnce({ itens: [t3], proximoCursor: "t3" });
    api.mockResolvedValueOnce(undefined);
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await clicar(await screen.findByRole("button", { name: "Carregar mais" }));
    await abrirConfirmacao();
    await clicar(screen.getByRole("button", { name: "Apagar" }));
    expect(tickersNaTela()).toEqual(["VALE3", "ITUB4"]);
  });

  it("enquanto o DELETE roda, Carregar mais fica desabilitado; depois volta a funcionar", async () => {
    const exclusao = controlada<undefined>();
    api.mockResolvedValueOnce(primeiraPagina);
    api.mockReturnValueOnce(exclusao.promessa);
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await abrirConfirmacao();
    expect(botaoMais().disabled).toBe(false);
    await clicar(screen.getByRole("button", { name: "Apagar" }));
    expect(botaoMais().disabled).toBe(true);
    await act(async () => {
      exclusao.resolver(undefined);
    });
    expect(botaoMais().disabled).toBe(false);
  });

  it("enquanto a página carrega, os Apagar das linhas ficam desabilitados; depois voltam", async () => {
    const pagina = controlada<unknown>();
    api.mockResolvedValueOnce(primeiraPagina);
    api.mockReturnValueOnce(pagina.promessa);
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    const mais = await screen.findByRole("button", { name: "Carregar mais" });
    const abrir = () => screen.getAllByRole("button", { name: /^Apagar/ }) as HTMLButtonElement[];
    expect(abrir().every((b) => !b.disabled)).toBe(true);
    await clicar(mais);
    expect(abrir().every((b) => b.disabled)).toBe(true);
    await act(async () => {
      pagina.resolver({ itens: [t3], proximoCursor: null });
    });
    expect(abrir().every((b) => !b.disabled)).toBe(true);
  });
});

describe("foco, cursor, URL e copy", () => {
  it("depois de apagar, o foco vai para o título da seção", async () => {
    api.mockResolvedValueOnce(primeiraPagina);
    api.mockResolvedValueOnce(undefined);
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await abrirConfirmacao();
    await clicar(screen.getByRole("button", { name: "Apagar" }));
    const titulo = screen.getByRole("heading", { name: "Histórico de transações" });
    expect(titulo.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(titulo);
  });

  it("depois de um erro (409), o foco volta ao Apagar da própria linha", async () => {
    api.mockResolvedValueOnce(primeiraPagina);
    api.mockRejectedValueOnce(new ApiError("Apague a venda primeiro.", 409));
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await abrirConfirmacao();
    await clicar(screen.getByRole("button", { name: "Apagar" }));
    expect(screen.getByRole("alert").textContent).toBe("Apague a venda primeiro.");
    const linha = screen.getAllByRole("listitem")[0]!;
    expect(document.activeElement).toBe(within(linha).getByRole("button", { name: /^Apagar/ }));
  });

  it("cancelar numa linha posterior devolve o foco ao Apagar daquela linha", async () => {
    api.mockResolvedValue(primeiraPagina);
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await screen.findByText("VALE3 S.A.");
    const segunda = screen.getAllByRole("listitem")[1]!;
    fireEvent.click(within(segunda).getByRole("button", { name: /^Apagar/ }));
    await clicar(within(segunda).getByRole("button", { name: "Cancelar" }));
    expect(document.activeElement).toBe(within(segunda).getByRole("button", { name: /^Apagar/ }));
    expect(document.activeElement).not.toBe(
      within(screen.getAllByRole("listitem")[0]!).getByRole("button", { name: /^Apagar/ }),
    );
  });

  it("apagar uma linha que não é a do cursor não mexe no cursor", async () => {
    api.mockResolvedValueOnce(primeiraPagina); // cursor t2
    api.mockResolvedValueOnce(undefined); // DELETE t1
    api.mockResolvedValueOnce({ itens: [], proximoCursor: null });
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await abrirConfirmacao(); // t1
    await clicar(screen.getByRole("button", { name: "Apagar" }));
    await clicar(botaoMais());
    expect(api).toHaveBeenLastCalledWith("/transactions?limite=20&cursor=t2");
  });

  it("o id vai codificado na URL do DELETE", async () => {
    api.mockResolvedValueOnce({ itens: [transacao("a/b?c", "PETR4")], proximoCursor: null });
    api.mockResolvedValueOnce(undefined);
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await abrirConfirmacao();
    await clicar(screen.getByRole("button", { name: "Apagar" }));
    expect(api).toHaveBeenLastCalledWith("/transactions/a%2Fb%3Fc", { method: "DELETE" });
  });

  it("o botão da linha mantém o ticker em maiúsculas e só a operação em minúsculas", async () => {
    api.mockResolvedValue(primeiraPagina);
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Apagar compra de 10 PETR4 em 12/03/2026" })).toBeTruthy();
  });

  it("a confirmação é anunciada: o grupo e os botões apontam para a pergunta", async () => {
    api.mockResolvedValue(primeiraPagina);
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await abrirConfirmacao();
    const grupo = screen.getByRole("group");
    const pergunta = document.getElementById(grupo.getAttribute("aria-labelledby")!)!;
    expect(pergunta.textContent).toMatch(/^Apagar esta compra de 10 PETR4/);
    // uma só ligação com a pergunta (o grupo); nos botões repetiria a leitura
    expect(screen.getByRole("button", { name: "Cancelar" }).getAttribute("aria-describedby")).toBeNull();
    expect(screen.getByRole("group", { name: pergunta.textContent! })).toBe(grupo);
  });

  it.each([
    ["5", "Apagar esta venda de 5 PETR4 em 12/03/2026? As 5 cotas voltam para a sua posição. O preço médio só muda se houver compra de PETR4 depois desta venda."],
    ["1.00000000", "Apagar esta venda de 1 PETR4 em 12/03/2026? A 1 cota volta para a sua posição. O preço médio só muda se houver compra de PETR4 depois desta venda."],
    ["0.5", "Apagar esta venda de 0,5 PETR4 em 12/03/2026? A 0,5 cota volta para a sua posição. O preço médio só muda se houver compra de PETR4 depois desta venda."],
  ])("texto da confirmação de venda com quantidade %s", async (quantity, esperado) => {
    api.mockResolvedValue({ itens: [transacao("v1", "PETR4", { kind: "VENDA", quantity })], proximoCursor: null });
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await abrirConfirmacao();
    expect(screen.getByText(esperado)).toBeTruthy();
  });
});

describe("recarga da primeira página depois de apagar o único item do cursor", () => {
  it("mostra o carregando, e não o vazio, enquanto a recarga roda", async () => {
    const recarga = controlada<unknown>();
    api.mockResolvedValueOnce({ itens: [t1], proximoCursor: "t1" });
    api.mockResolvedValueOnce(undefined); // DELETE t1
    api.mockReturnValueOnce(recarga.promessa);
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await abrirConfirmacao();
    await clicar(screen.getByRole("button", { name: "Apagar" }));

    expect(screen.queryByText("Você ainda não registrou transações")).toBeNull();
    expect(screen.getByLabelText("Carregando histórico")).toBeTruthy();

    await act(async () => {
      recarga.resolver({ itens: [t3], proximoCursor: null });
    });
    expect(tickersNaTela()).toEqual(["ITUB4"]);
    expect(screen.queryByLabelText("Carregando histórico")).toBeNull();
  });

  it("gêmeo: se a recarga vem vazia de verdade, aí sim aparece o estado vazio", async () => {
    api.mockResolvedValueOnce({ itens: [t1], proximoCursor: "t1" });
    api.mockResolvedValueOnce(undefined);
    api.mockResolvedValueOnce({ itens: [], proximoCursor: null });
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await abrirConfirmacao();
    await clicar(screen.getByRole("button", { name: "Apagar" }));
    expect(screen.getByText("Você ainda não registrou transações")).toBeTruthy();
  });
});
