// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AtivoAnotado } from "./ativo-anotado";

afterEach(cleanup);

// o brl põe um espaço que não separa depois do "R$": aqui comparamos com espaço comum
const textoDoCard = () => (screen.getByRole("article").textContent ?? "").replace(/ /g, " ");

describe("AtivoAnotado", () => {
  it("mostra os números do exemplo numa data só, com as casas da ficha", () => {
    render(<AtivoAnotado />);
    const texto = textoDoCard();

    for (const t of ["R$ 45,87", "9,66", "1,96", "6,55%", "20,86%", "R$ 3,0065", "R$ 20,86", "+9,7% em outubro", "20 de outubro de 2026"]) {
      expect(texto, t).toContain(t);
    }
  });

  it("não sobra nenhum número do exemplo antigo nem arredondado de outro jeito", () => {
    render(<AtivoAnotado />);
    const texto = textoDoCard();

    for (const t of ["3,01", "6,6%", "20,9%", "42,85", "9,02", "1,83", "7,02", "2 de outubro"]) {
      expect(texto, t).not.toContain(t);
    }
  });
});
