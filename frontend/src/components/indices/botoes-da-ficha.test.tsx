// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BotoesDaFicha } from "./botoes-da-ficha";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BotoesDaFicha", () => {
  it("só oferece Compartilhar (o Seguir saiu)", () => {
    render(<BotoesDaFicha nome="Ibovespa" />);

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Compartilhar"]);
  });

  it("sem compartilhamento do aparelho, copia o link e avisa", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<BotoesDaFicha nome="Ibovespa" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
    });

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByRole("status").textContent).toBe("Link copiado.");
  });
});
