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

// Forma real da API: dinheiro e quantidade chegam como string (Prisma.Decimal no JSON)
function transacao(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    kind: "COMPRA",
    quantity: "10.00000000",
    unitPrice: "30.50",
    fee: "1.00",
    executedAt: "2026-03-12T00:00:00.000Z",
    asset: { ticker: "PETR4", name: "Petrobras PN", type: "ACAO" },
    ...extra,
  };
}

const pagina1 = {
  itens: [
    transacao("t1"),
    transacao("t2", { kind: "VENDA", quantity: "5", asset: { ticker: "VALE3", name: "Vale ON", type: "ACAO" } }),
  ],
  proximoCursor: "t2",
};

function controlada<T>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((res) => {
    resolver = res;
  });
  return { promessa, resolver };
}

async function abrirConfirmacao() {
  const botao = (await screen.findAllByRole("button", { name: /^Apagar/ }))[0]!;
  fireEvent.click(botao);
}

describe("HistoricoTransacoes", () => {
  it("lista a primeira página com data, ativo, operação, quantidade, preço e taxa", async () => {
    api.mockResolvedValue(pagina1);
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);

    expect(await screen.findByText("Petrobras PN")).toBeTruthy();
    expect(api).toHaveBeenCalledWith("/transactions?limite=20");
    const linhas = screen.getAllByRole("listitem");
    expect(linhas).toHaveLength(2);
    const primeira = within(linhas[0]!);
    expect(primeira.getByText("12/03/2026")).toBeTruthy();
    expect(primeira.getByText("PETR4")).toBeTruthy();
    expect(primeira.getByText("Compra")).toBeTruthy();
    expect(primeira.getByText(/R\$\s30,50/)).toBeTruthy();
    expect(primeira.getByText(/R\$\s1,00/)).toBeTruthy();
    expect(within(linhas[1]!).getByText("Venda")).toBeTruthy();
  });

  it("sem transações mostra o estado vazio", async () => {
    api.mockResolvedValue({ itens: [], proximoCursor: null });
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    expect(await screen.findByText("Você ainda não registrou transações")).toBeTruthy();
  });

  it("falha na lista mostra o erro do servidor e permite tentar de novo", async () => {
    api.mockRejectedValueOnce(new ApiError("Banco indisponível", 500));
    api.mockResolvedValueOnce({ itens: [transacao("t1")], proximoCursor: null });
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);

    expect((await screen.findByRole("alert")).textContent).toContain("Banco indisponível");
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Petrobras PN")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Carregar mais acrescenta sem duplicar e some quando não há próxima página", async () => {
    api.mockResolvedValueOnce(pagina1);
    // a segunda página repete t2: não pode duplicar
    api.mockResolvedValueOnce({ itens: [transacao("t2", { kind: "VENDA" }), transacao("t3")], proximoCursor: null });
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);

    const mais = await screen.findByRole("button", { name: "Carregar mais" });
    await act(async () => {
      fireEvent.click(mais);
    });

    expect(api).toHaveBeenLastCalledWith("/transactions?limite=20&cursor=t2");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull();
  });

  it("Apagar abre a confirmação com a frase da operação, e Cancelar fecha devolvendo o foco", async () => {
    api.mockResolvedValue(pagina1);
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await abrirConfirmacao();

    expect(
      screen.getByText(
        "Apagar esta compra de 10 PETR4 em 12/03/2026? O preço médio e a quantidade serão recalculados.",
      ),
    ).toBeTruthy();
    const cancelar = screen.getByRole("button", { name: "Cancelar" });
    expect(document.activeElement).toBe(cancelar);

    await act(async () => {
      fireEvent.click(cancelar);
    });
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
    expect(document.activeElement).toBe(screen.getAllByRole("button", { name: /^Apagar/ })[0]);
    expect(api).toHaveBeenCalledTimes(1); // só a listagem: nada foi apagado
  });

  it("só uma linha fica em confirmação por vez", async () => {
    api.mockResolvedValue(pagina1);
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await abrirConfirmacao();
    expect(screen.getAllByRole("button", { name: "Cancelar" })).toHaveLength(1);

    const apagar = screen.getAllByRole("button", { name: /^Apagar/ });
    fireEvent.click(apagar[apagar.length - 1]!);
    expect(screen.getAllByRole("button", { name: "Cancelar" })).toHaveLength(1);
    expect(screen.getByText(/Apagar esta venda de 5 VALE3/)).toBeTruthy();
    expect(screen.queryByText(/Apagar esta compra/)).toBeNull();
  });

  it("confirmar chama DELETE, remove a linha, avisa a página e anuncia o sucesso", async () => {
    api.mockResolvedValueOnce(pagina1);
    api.mockResolvedValueOnce(undefined);
    const aoApagar = vi.fn();
    render(<HistoricoTransacoes aoApagar={aoApagar} />);
    await abrirConfirmacao();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apagar" }));
    });

    expect(api).toHaveBeenLastCalledWith("/transactions/t1", { method: "DELETE" });
    expect(aoApagar).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Petrobras PN")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Compra de 10 PETR4 em 12/03/2026 apagada");
  });

  it("apagar a última linha da página aponta o cursor para a linha anterior", async () => {
    api.mockResolvedValueOnce(pagina1); // cursor t2
    api.mockResolvedValueOnce(undefined); // DELETE t2
    api.mockResolvedValueOnce({ itens: [], proximoCursor: null });
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await screen.findByText("Vale ON");
    const apagar = screen.getAllByRole("button", { name: /^Apagar/ });
    fireEvent.click(apagar[apagar.length - 1]!);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apagar" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    });
    // t2 não existe mais: um cursor apagado faria o servidor devolver lista vazia
    expect(api).toHaveBeenLastCalledWith("/transactions?limite=20&cursor=t1");
  });

  it("409 mostra a mensagem do servidor ao lado da linha e mantém a linha", async () => {
    const msg =
      "Não é possível apagar: a posição de PETR4 ficaria em -5 porque existe venda posterior que depende desta transação. Apague a venda primeiro.";
    api.mockResolvedValueOnce(pagina1);
    api.mockRejectedValueOnce(new ApiError(msg, 409));
    const aoApagar = vi.fn();
    render(<HistoricoTransacoes aoApagar={aoApagar} />);
    await abrirConfirmacao();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apagar" }));
    });

    const alerta = screen.getByRole("alert");
    expect(alerta.textContent).toBe(msg);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(aoApagar).not.toHaveBeenCalled();
    expect(within(screen.getAllByRole("listitem")[0]!).getByRole("alert")).toBe(alerta);
  });

  it("403 da conta de demonstração mostra a mensagem exata do servidor", async () => {
    const msg = "A conta de demonstração é só para olhar. Crie uma conta grátis para registrar as suas operações.";
    api.mockResolvedValueOnce(pagina1);
    api.mockRejectedValueOnce(new ApiError(msg, 403));
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await abrirConfirmacao();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apagar" }));
    });
    expect(screen.getByRole("alert").textContent).toBe(msg);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("enquanto o DELETE está em andamento o botão fica desabilitado e não envia duas vezes", async () => {
    const { promessa, resolver } = controlada<undefined>();
    api.mockResolvedValueOnce(pagina1);
    api.mockReturnValueOnce(promessa);
    render(<HistoricoTransacoes aoApagar={vi.fn()} />);
    await abrirConfirmacao();

    const confirmar = screen.getByRole("button", { name: "Apagar" }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(confirmar);
    });
    const emAndamento = screen.getByRole("button", { name: /Apagando/ }) as HTMLButtonElement;
    expect(emAndamento.disabled).toBe(true);
    await act(async () => {
      fireEvent.click(emAndamento);
    });
    expect(api.mock.calls.filter((c) => c[1]?.method === "DELETE")).toHaveLength(1);

    await act(async () => {
      resolver(undefined);
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
