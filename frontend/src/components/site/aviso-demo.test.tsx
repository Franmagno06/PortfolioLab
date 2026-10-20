// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

  it("não mostra nada para uma conta normal", async () => {
    api.mockResolvedValue({ demo: false });
    const { container } = render(<AvisoDemo />);

    await waitFor(() => expect(api).toHaveBeenCalled());
    await Promise.resolve();
    expect(container.textContent).toBe("");
  });

  it("não mostra nada quando a consulta falha", async () => {
    api.mockRejectedValue(new ApiError("fora do ar", 500));
    const { container } = render(<AvisoDemo />);

    await waitFor(() => expect(api).toHaveBeenCalled());
    await Promise.resolve();
    expect(container.textContent).toBe("");
  });
});
