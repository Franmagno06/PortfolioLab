import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CABECALHO_DO_SEGREDO, config, proxy } from "./proxy";

// NextResponse.next({ request: { headers } }) leva os cabeçalhos novos em x-middleware-request-*.
const repassado = (res: Response, nome: string) => res.headers.get(`x-middleware-request-${nome}`);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy: chamadas /api/*", () => {
  it("põe o segredo do proxy na chamada que segue para a API", () => {
    vi.stubEnv("SEGREDO_DO_PROXY", "s".repeat(40));
    const res = proxy(new NextRequest("http://localhost:3000/api/auth/login", { method: "POST" }));

    expect(repassado(res, CABECALHO_DO_SEGREDO)).toBe("s".repeat(40));
    expect(res.headers.get("location")).toBeNull();
  });

  it("sobrescreve um segredo que o navegador tenha inventado", () => {
    vi.stubEnv("SEGREDO_DO_PROXY", "s".repeat(40));
    const res = proxy(
      new NextRequest("http://localhost:3000/api/auth/me", { headers: { [CABECALHO_DO_SEGREDO]: "inventado" } }),
    );

    expect(repassado(res, CABECALHO_DO_SEGREDO)).toBe("s".repeat(40));
  });

  it("sem a variável (desenvolvimento), não repassa o cabeçalho que veio do navegador", () => {
    vi.stubEnv("SEGREDO_DO_PROXY", "");
    const res = proxy(
      new NextRequest("http://localhost:3000/api/auth/me", { headers: { [CABECALHO_DO_SEGREDO]: "inventado" } }),
    );

    expect(repassado(res, CABECALHO_DO_SEGREDO)).toBeNull();
  });

  it("não manda /api para o login nem põe a CSP das páginas", () => {
    const res = proxy(new NextRequest("http://localhost:3000/api/portfolio"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-security-policy")).toBeNull();
  });

  it("o matcher inclui /api", () => {
    expect(config.matcher).toContain("/api/:path*");
  });
});

describe("proxy: páginas continuam como antes", () => {
  it("área logada sem cookie vai ao login", () => {
    const res = proxy(new NextRequest("http://localhost:3000/dashboard"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fdashboard");
  });
});
