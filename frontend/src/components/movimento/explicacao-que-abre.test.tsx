// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExplicacaoQueAbre } from "./explicacao-que-abre";

afterEach(() => cleanup());

function montar() {
  return render(
    <ExplicacaoQueAbre id="explicacao-pl" rotulo="P/L" valor="8,4" resumo="Anos de lucro para pagar o preço.">
      <p>A conta: preço dividido pelo lucro por ação.</p>
    </ExplicacaoQueAbre>,
  );
}

function corpo() {
  return document.getElementById("explicacao-pl") as HTMLElement;
}

describe("ExplicacaoQueAbre", () => {
  it("o nome do botão separa o rótulo do valor", () => {
    montar();
    expect(screen.getByRole("button", { name: "P/L 8,4" })).toBeTruthy();
  });

  it("fechada, o corpo é inert e aria-hidden e o resumo aparece", () => {
    montar();
    expect(corpo().hasAttribute("inert")).toBe(true);
    expect(corpo().getAttribute("aria-hidden")).toBe("true");
    const resumo = screen.getByText("Anos de lucro para pagar o preço.");
    expect(resumo.closest("button")).toBeNull();
    expect(corpo().contains(resumo)).toBe(false);
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe("false");
  });

  it("clicar abre, troca aria-expanded e tira o inert", async () => {
    montar();
    const botao = screen.getByRole("button", { name: /P\/L/ });
    await act(async () => botao.click());
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(corpo().hasAttribute("inert")).toBe(false);
    expect(corpo().hasAttribute("aria-hidden")).toBe(false);

    await act(async () => botao.click());
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(corpo().hasAttribute("inert")).toBe(true);
  });

  it("aria-controls aponta para o id do corpo", () => {
    montar();
    const botao = screen.getByRole("button");
    expect(botao.getAttribute("aria-controls")).toBe("explicacao-pl");
    expect(corpo().textContent).toContain("preço dividido pelo lucro");
    expect(botao.getAttribute("type")).toBe("button");
    expect(botao.textContent).toContain("8,4");
  });
});
