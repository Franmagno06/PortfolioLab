import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  esquecerSimulacao,
  guardarSimulacao,
  marcarMetasAlteradas,
  useSimulacaoGuardada,
  type Simulacao,
} from "./simulacao-guardada";

const resultado: Simulacao = {
  valorAporte: 1500,
  patrimonioAtual: 10_000,
  patrimonioFinal: 11_480,
  patrimonioProjetado: 11_500,
  compras: [
    { ticker: "MXRF11", name: "Maxi Renda", deficit: 900, quantidade: 80, precoUnitario: 10, total: 800 },
  ],
  totalGasto: 1480,
  restante: 20,
  alocacao: [{ ticker: "MXRF11", alvoPct: 50, atualPct: 40, aposAportePct: 45 }],
  patrimonioConsiderado: 10_000,
  somaMetas: 100,
  foraDaSimulacao: { valor: 0, ativos: [] },
};

beforeEach(() => {
  sessionStorage.clear();
  esquecerSimulacao();
});

describe("simulação guardada", () => {
  it("começa vazia", () => {
    const { result } = renderHook(() => useSimulacaoGuardada());
    expect(result.current).toBeNull();
  });

  it("devolve o cálculo a um componente montado DEPOIS de guardar — o caso de voltar à página", () => {
    guardarSimulacao("1500", resultado);

    // um renderHook novo é a página montando de novo após a navegação
    const { result } = renderHook(() => useSimulacaoGuardada());

    expect(result.current?.valor).toBe("1500");
    expect(result.current?.resultado.totalGasto).toBe(1480);
    expect(result.current?.metasAlteradas).toBe(false);
  });

  it("avisa quem já está montado quando um cálculo novo é guardado", () => {
    const { result } = renderHook(() => useSimulacaoGuardada());

    act(() => guardarSimulacao("2000", { ...resultado, valorAporte: 2000 }));

    expect(result.current?.resultado.valorAporte).toBe(2000);
  });

  it("marca o cálculo como desatualizado quando as metas mudam", () => {
    guardarSimulacao("1500", resultado);
    const { result } = renderHook(() => useSimulacaoGuardada());

    act(() => marcarMetasAlteradas());

    expect(result.current?.metasAlteradas).toBe(true);
    expect(result.current?.resultado.totalGasto).toBe(1480);
  });

  it("recalcular limpa a marca de desatualizado", () => {
    guardarSimulacao("1500", resultado);
    marcarMetasAlteradas();

    guardarSimulacao("1500", resultado);

    const { result } = renderHook(() => useSimulacaoGuardada());
    expect(result.current?.metasAlteradas).toBe(false);
  });

  it("marcar metas sem cálculo guardado não cria nada", () => {
    marcarMetasAlteradas();
    expect(sessionStorage.getItem("portfoliolab:simulacao")).toBeNull();
  });

  it("esquecer apaga o cálculo (logout e login)", () => {
    guardarSimulacao("1500", resultado);
    const { result } = renderHook(() => useSimulacaoGuardada());

    act(() => esquecerSimulacao());

    expect(result.current).toBeNull();
    expect(sessionStorage.getItem("portfoliolab:simulacao")).toBeNull();
  });

  it("conteúdo corrompido no storage vira vazio, sem quebrar a tela", () => {
    sessionStorage.setItem("portfoliolab:simulacao", "{não é json");
    const { result } = renderHook(() => useSimulacaoGuardada());
    expect(result.current).toBeNull();
  });
});
