// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { lembrarSessao } from "@/lib/sessao-do-visitante";
import { CabecalhoSite } from "./cabecalho-site";

const api = vi.hoisted(() => vi.fn());
const apiPublica = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api,
  apiPublica,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), usePathname: () => "/" }));

const assentar = () => act(async () => {});

/** O canto do cabeçalho no desktop: fora da gaveta, o que vem antes de "Minha carteira". */
const cabecalho = () => screen.getByRole("banner");

async function abrirGaveta() {
  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  return within(screen.getByRole("dialog", { name: "Menu do site" }));
}

const respostas = {
  visitante: () => apiPublica.mockRejectedValue(new ApiError("Não autenticado", 401)),
  demo: () => apiPublica.mockResolvedValue({ id: "d", demo: true }),
  conta: () => apiPublica.mockResolvedValue({ id: "u1", demo: false }),
  desconhecida: () => apiPublica.mockRejectedValue(new ApiError("Erro inesperado", 503)),
};

beforeEach(() => {
  lembrarSessao(null);
});

afterEach(() => {
  cleanup();
  api.mockReset();
  apiPublica.mockReset();
  push.mockReset();
  refresh.mockReset();
});

describe("CabecalhoSite no site público: Entrar ou Sair pela sessão", () => {
  it("visitante: 'Entrar' no desktop e na gaveta, levando ao login", async () => {
    respostas.visitante();
    render(<CabecalhoSite />);
    await assentar();

    expect(within(cabecalho()).getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe("/login");
    expect(within(cabecalho()).queryByRole("button", { name: "Sair" })).toBeNull();
    const gaveta = await abrirGaveta();
    expect(gaveta.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe("/login");
    expect(gaveta.queryByRole("button", { name: "Sair" })).toBeNull();
  });

  for (const sessao of ["demo", "conta"] as const) {
    it(`${sessao}: 'Sair' no lugar de 'Entrar', no desktop e na gaveta`, async () => {
      respostas[sessao]();
      render(<CabecalhoSite />);
      await assentar();

      expect(within(cabecalho()).getByRole("button", { name: "Sair" })).toBeTruthy();
      expect(within(cabecalho()).queryByRole("link", { name: "Entrar" })).toBeNull();
      const gaveta = await abrirGaveta();
      expect(gaveta.getByRole("button", { name: "Sair" })).toBeTruthy();
      expect(gaveta.queryByRole("link", { name: "Entrar" })).toBeNull();
    });
  }

  it("desconhecida (backend com erro): nem 'Entrar' nem 'Sair', e 'Minha carteira' continua", async () => {
    respostas.desconhecida();
    render(<CabecalhoSite />);
    await assentar();

    expect(within(cabecalho()).queryByRole("link", { name: "Entrar" })).toBeNull();
    expect(within(cabecalho()).queryByRole("button", { name: "Sair" })).toBeNull();
    expect(within(cabecalho()).getByRole("link", { name: "Minha carteira" }).getAttribute("href")).toBe("/dashboard");
    const gaveta = await abrirGaveta();
    expect(gaveta.queryByRole("link", { name: "Entrar" })).toBeNull();
    expect(gaveta.queryByRole("button", { name: "Sair" })).toBeNull();
  });

  it("desconhecida depois de uma resposta boa: fica com a última sessão conhecida", async () => {
    lembrarSessao("demo");
    respostas.desconhecida();
    render(<CabecalhoSite />);
    await assentar();

    expect(within(cabecalho()).getByRole("button", { name: "Sair" })).toBeTruthy();
  });

  it("antes de a consulta responder: nenhum link para o login, e nada espera a API para aparecer", () => {
    apiPublica.mockReturnValue(new Promise(() => {}));
    render(<CabecalhoSite />);

    expect(within(cabecalho()).getByRole("link", { name: "Minha carteira" })).toBeTruthy();
    expect(within(cabecalho()).queryByRole("link", { name: "Entrar" })).toBeNull();
  });

  it("voltando da carteira pelo menu: nasce com 'Sair', sem piscar 'Entrar'", () => {
    lembrarSessao("conta");
    apiPublica.mockReturnValue(new Promise(() => {}));
    render(<CabecalhoSite />);

    expect(within(cabecalho()).getByRole("button", { name: "Sair" })).toBeTruthy();
  });

  it("'Sair' na demo: logout, volta ao início e o cabeçalho passa a mostrar 'Entrar'", async () => {
    respostas.demo();
    api.mockResolvedValue(undefined);
    render(<CabecalhoSite />);
    await assentar();

    fireEvent.click(within(cabecalho()).getByRole("button", { name: "Sair" }));
    await assentar();

    expect(api).toHaveBeenCalledWith("/auth/logout", { method: "POST" });
    expect(push).toHaveBeenCalledWith("/");
    expect(within(cabecalho()).getByRole("link", { name: "Entrar" })).toBeTruthy();
  });

  it("logout que falha: continua com 'Sair', sem mandar a lugar nenhum", async () => {
    respostas.conta();
    api.mockRejectedValue(new ApiError("Erro inesperado", 500));
    render(<CabecalhoSite />);
    await assentar();

    fireEvent.click(within(cabecalho()).getByRole("button", { name: "Sair" }));
    await assentar();

    expect(push).not.toHaveBeenCalled();
    expect(within(cabecalho()).getByRole("button", { name: "Sair" })).toBeTruthy();
  });
});

describe("CabecalhoSite na área logada", () => {
  it("sempre 'Sair', sem perguntar a sessão ao backend", async () => {
    render(<CabecalhoSite area="carteira" />);
    await assentar();

    expect(apiPublica).not.toHaveBeenCalled();
    expect(within(cabecalho()).getByRole("button", { name: "Sair" })).toBeTruthy();
    const gaveta = await abrirGaveta();
    expect(gaveta.getByRole("button", { name: "Sair" })).toBeTruthy();
  });
});
