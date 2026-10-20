// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { AvisoDemo } from "./aviso-demo";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api,
}));

afterEach(() => {
  cleanup();
  api.mockReset();
});

describe("AvisoDemo", () => {
  it("mostra a faixa e o link de cadastro na conta de demonstração", async () => {
    api.mockResolvedValue({ demo: true });
    render(<AvisoDemo />);

    expect(await screen.findByText(/carteira de demonstração/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Criar minha conta" }).getAttribute("href")).toBe("/registro");
    expect(api).toHaveBeenCalledWith("/auth/me");
  });

  // Promessa controlada: o teste decide quando a resposta chega e esvazia a fila
  // de microtarefas e o React antes de afirmar, para a ausência não ser vazia.
  function controlada<T>() {
    let resolver!: (v: T) => void;
    let rejeitar!: (e: unknown) => void;
    const promessa = new Promise<T>((res, rej) => {
      resolver = res;
      rejeitar = rej;
    });
    return { promessa, resolver, rejeitar };
  }

  it("com a mesma aparelhagem, demo:true mostra a faixa depois que a resposta chega", async () => {
    const c = controlada<{ demo: boolean }>();
    api.mockReturnValue(c.promessa);
    render(<AvisoDemo />);
    expect(screen.queryByText(/carteira de demonstração/)).toBeNull();

    await act(async () => {
      c.resolver({ demo: true });
    });

    expect(screen.queryByText(/carteira de demonstração/)).not.toBeNull();
  });

  it("não mostra nada para uma conta normal", async () => {
    const c = controlada<{ demo: boolean }>();
    api.mockReturnValue(c.promessa);
    const { container } = render(<AvisoDemo />);

    await act(async () => {
      c.resolver({ demo: false });
    });

    expect(api).toHaveBeenCalledWith("/auth/me");
    expect(container.textContent).toBe("");
  });

  it("não mostra nada quando a consulta falha", async () => {
    const c = controlada<{ demo: boolean }>();
    api.mockReturnValue(c.promessa);
    const { container } = render(<AvisoDemo />);

    await act(async () => {
      c.rejeitar(new ApiError("fora do ar", 500));
    });

    expect(api).toHaveBeenCalledWith("/auth/me");
    expect(container.textContent).toBe("");
  });
});
