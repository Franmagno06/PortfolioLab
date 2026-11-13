import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { consultarSessao, lembrarSessao, observarSessao, ultimaSessaoConhecida } from "./sessao-do-visitante";

const apiPublica = vi.hoisted(() => vi.fn());
vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), apiPublica }));

beforeEach(() => lembrarSessao(null));
afterEach(() => apiPublica.mockReset());

describe("consultarSessao", () => {
  it("pergunta a /auth/sessao, sem cache, e guarda a resposta", async () => {
    apiPublica.mockResolvedValue({ sessao: "demo" });

    expect(await consultarSessao()).toBe("demo");
    expect(apiPublica).toHaveBeenCalledWith("/auth/sessao", { cache: "no-store" });
    expect(ultimaSessaoConhecida()).toBe("demo");
  });

  it("resposta fora do formato é desconhecida, e não muda a última conhecida", async () => {
    lembrarSessao("conta");
    apiPublica.mockResolvedValue({ sessao: "admin" });

    expect(await consultarSessao()).toBe("desconhecida");
    expect(ultimaSessaoConhecida()).toBe("conta");
  });

  it("um 401 (API antiga, proxy no meio) vale como visitante; 5xx e rede, desconhecida", async () => {
    apiPublica.mockRejectedValueOnce(new ApiError("x", 401));
    expect(await consultarSessao()).toBe("visitante");

    apiPublica.mockRejectedValueOnce(new ApiError("x", 502));
    expect(await consultarSessao()).toBe("desconhecida");

    apiPublica.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await consultarSessao()).toBe("desconhecida");
  });

  it("avisa quem observa quando a sessão muda, e só quando muda", async () => {
    const aviso = vi.fn();
    const parar = observarSessao(aviso);
    lembrarSessao("demo");
    lembrarSessao("demo");
    lembrarSessao("visitante");
    parar();
    lembrarSessao("conta");

    expect(aviso).toHaveBeenCalledTimes(2);
  });
});
