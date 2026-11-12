// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { lembrarSessao } from "@/lib/sessao-do-visitante";
import { BotaoDemo } from "./botao-demo";

const api = vi.hoisted(() => vi.fn());
const apiPublica = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api,
  apiPublica,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const semSessao = () => Promise.reject(new ApiError("Não autenticado", 401));

/** Esvazia a fila de promessas e deixa o React aplicar os estados que elas mudaram. */
const assentar = () => act(async () => {});

beforeEach(() => {
  lembrarSessao(null);
});

afterEach(() => {
  cleanup();
  api.mockReset();
  apiPublica.mockReset();
  push.mockReset();
});

describe("BotaoDemo", () => {
  it("visitante sem sessão: o clique entra na conta demo e abre a carteira", async () => {
    apiPublica.mockImplementation(semSessao);
    api.mockResolvedValue({ user: {} });
    render(<BotaoDemo />);
    await assentar();

    fireEvent.click(screen.getByRole("button", { name: "Ver a demonstração" }));
    await assentar();

    expect(apiPublica).toHaveBeenCalledWith("/auth/me", { cache: "no-store" });
    expect(api).toHaveBeenCalledWith("/auth/login", expect.objectContaining({ method: "POST" }));
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("logado na própria conta: vira 'Ir para minha carteira', um link, e nunca faz login", async () => {
    apiPublica.mockResolvedValue({ id: "u1", demo: false });
    render(<BotaoDemo />);
    await assentar();

    const link = screen.getByRole("link", { name: "Ir para minha carteira" });
    expect(link.getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByRole("button")).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });

  it("antes de a consulta responder: rótulo de visitante, sem esperar a API para aparecer", () => {
    apiPublica.mockReturnValue(new Promise(() => {}));
    render(<BotaoDemo />);

    expect(screen.getByRole("button", { name: "Ver a demonstração" })).toBeTruthy();
  });

  it("clique antes da resposta, e a sessão era de uma conta: só navega, sem login por cima", async () => {
    let responder!: (v: unknown) => void;
    apiPublica.mockReturnValue(new Promise((r) => (responder = r)));
    render(<BotaoDemo />);

    fireEvent.click(screen.getByRole("button", { name: "Ver a demonstração" }));
    await act(async () => responder({ demo: false }));

    expect(push).toHaveBeenCalledWith("/dashboard");
    expect(api).not.toHaveBeenCalled();
  });

  it("já na conta demo: comportamento de antes, entra de novo na demo", async () => {
    apiPublica.mockResolvedValue({ demo: true });
    api.mockResolvedValue({ user: {} });
    render(<BotaoDemo />);
    await assentar();

    fireEvent.click(screen.getByRole("button", { name: "Ver a demonstração" }));
    await assentar();

    expect(api).toHaveBeenCalledWith("/auth/login", expect.anything());
  });

  it("não deu para saber se há sessão (servidor com erro): não faz login e explica", async () => {
    apiPublica.mockRejectedValue(new ApiError("Erro inesperado", 500));
    render(<BotaoDemo />);
    await assentar();

    fireEvent.click(screen.getByRole("button", { name: "Ver a demonstração" }));
    await assentar();

    expect(api).not.toHaveBeenCalled();
    expect(screen.getByText(/Não foi possível verificar/)).toBeTruthy();
  });

  it("vários botões na página dividem uma consulta só", async () => {
    apiPublica.mockImplementation(semSessao);
    render(
      <>
        <BotaoDemo />
        <BotaoDemo tom="escuro" />
      </>,
    );
    await assentar();

    expect(apiPublica).toHaveBeenCalledTimes(1);
  });

  it("voltando da carteira pela navegação do app: o rótulo já nasce certo", () => {
    lembrarSessao("conta");
    apiPublica.mockReturnValue(new Promise(() => {}));
    render(<BotaoDemo />);

    expect(screen.getByRole("link", { name: "Ir para minha carteira" })).toBeTruthy();
  });
});
