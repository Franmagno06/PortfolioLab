// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ARMADILHAS, DICAS } from "@/lib/indicadores-explicados";
import { GrupoDeIndicadores, Indicador } from "./indicadores-da-ficha";

afterEach(cleanup);

function pl(armadilha?: string) {
  return render(
    <GrupoDeIndicadores titulo="Valuation" pergunta="quanto se paga?">
      <Indicador rotulo="Preço/lucro (P/L)" dica="pl" valor="6,9" leitura="o lucro de cerca de 7 anos pagaria a ação" armadilha={armadilha} />
    </GrupoDeIndicadores>,
  );
}

const corpo = () => document.getElementById(screen.getByRole("button", { name: /Entender melhor/ }).getAttribute("aria-controls")!)!;

describe("Indicador com explicação que se abre", () => {
  it("fechado, o valor e a frase de leitura ficam visíveis", () => {
    pl(ARMADILHAS.pl);
    expect(screen.getByText("6,9")).toBeTruthy();
    const leitura = screen.getByText(/o lucro de cerca de 7 anos/);
    expect(leitura.closest("[inert]")).toBeNull();
    expect(screen.getByRole("button", { name: /Entender melhor/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("a explicação, a armadilha e o link Saiba mais só aparecem ao abrir (antes ficam inertes)", () => {
    pl(ARMADILHAS.pl);
    expect(corpo().hasAttribute("inert")).toBe(true);
    expect(corpo().textContent).toContain(DICAS.pl.texto);
    expect(corpo().textContent).toContain("distorcer o P/L");

    fireEvent.click(screen.getByRole("button", { name: /Entender melhor/ }));
    expect(corpo().hasAttribute("inert")).toBe(false);
    expect(screen.getByRole("note").textContent).toContain("distorcer o P/L");
  });

  it("o link Saiba mais continua lá, dentro da explicação", () => {
    pl();
    const link = screen.getByRole("link", { hidden: true, name: /Saiba mais/ });
    expect(link.getAttribute("href")).toBe("/aprender/indicadores#pl");
    expect(corpo().contains(link)).toBe(true);
  });

  it("sem armadilha, a explicação não traz nota", () => {
    pl();
    expect(corpo().querySelector('[role="note"]')).toBeNull();
  });

  it("o '?' do indicador continua no cabeçalho, fora do botão da explicação", () => {
    pl();
    const botao = screen.getByRole("button", { name: /Entender melhor/ });
    const dica = screen.getAllByRole("button").find((b) => b !== botao && /P\/L|Preço\/lucro/.test(b.getAttribute("aria-label") ?? ""));
    expect(dica).toBeTruthy();
    expect(botao.contains(dica!)).toBe(false);
  });
});
