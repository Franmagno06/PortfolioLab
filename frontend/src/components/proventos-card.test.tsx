// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brl } from "@/lib/format";
import { ProventosCard } from "./proventos-card";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api,
}));

// Forma real: amount em string (Decimal); paidAt do provedor é o instante da data-ex do
// Yahoo (abertura do pregão, 13:00 UTC); o manual é meia-noite UTC do dia digitado.
const proventos = [
  {
    id: "p1",
    amount: "74.81",
    unitAmount: "0.74813",
    paidAt: "2025-04-17T13:00:00.000Z",
    source: "PROVEDOR",
    asset: { ticker: "PETR4", name: "Petrobras PN" },
  },
  {
    id: "p2",
    amount: "42.00",
    unitAmount: null,
    paidAt: "2026-03-01T00:00:00.000Z",
    source: "MANUAL",
    asset: { ticker: "MXRF11", name: "Maxi Renda" },
  },
];

beforeEach(() => {
  api.mockImplementation((rota: string) => {
    if (rota === "/dividends") return Promise.resolve({ itens: proventos, proximoCursor: null });
    if (rota === "/portfolio/summary") return Promise.resolve({ totalProventos: 116.81 });
    return Promise.reject(new Error(`rota inesperada: ${rota}`));
  });
});

afterEach(() => {
  cleanup();
  api.mockReset();
});

describe("ProventosCard: rótulos do que o número é", () => {
  it("o total não é chamado de 'recebido' nem de 'bruto': mistura importado (bruto) e lançado à mão (como informado)", async () => {
    render(<ProventosCard ativos={[]} />);
    expect(await screen.findByText((_, el) => el?.tagName === "SPAN" && el.textContent === `${brl(116.81)} no total`)).toBeTruthy();
    expect(screen.queryByText(/recebidos/)).toBeNull();
  });

  it("a nota diz o que é cada valor, avisa da soma dupla e dos eventos corporativos, e cita a fonte certa", async () => {
    render(<ProventosCard ativos={[]} />);
    await screen.findByText(/no total/);
    expect(screen.getByText(/importados do Yahoo Finance/)).toBeTruthy();
    expect(screen.queryByText(/B3/)).toBeNull();
    expect(screen.getByText(/Os valores importados são brutos/)).toBeTruthy();
    expect(screen.getByText(/Os que você lança à mão valem como você informou/)).toBeTruthy();
    expect(screen.getByText(/ele soma duas vezes/)).toBeTruthy();
    expect(screen.getByText(/desdobramento, grupamento ou bonificação/)).toBeTruthy();
  });

  it("a data do importado é rotulada como data-ex", async () => {
    render(<ProventosCard ativos={[]} />);
    expect(await screen.findByText("data-ex 17/04/2025")).toBeTruthy();
  });

  it("o manual mostra o dia digitado, sem cair na véspera pelo fuso", async () => {
    render(<ProventosCard ativos={[]} />);
    // meia-noite UTC de 01/03 lida em Brasília seria 28/02
    expect(await screen.findByText("01/03/2026")).toBeTruthy();
  });
});
