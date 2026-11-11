// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Relatorio } from "@/lib/relatorios";
import RelatoriosPage from "./page";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api,
}));

afterEach(() => {
  cleanup();
  api.mockReset();
});

function relatorio(ticker: string, period: string, extra: Partial<Relatorio> = {}): Relatorio {
  const tri = period.includes("T");
  return {
    id: `${ticker}-${period}`,
    fileName: `${ticker} ${period}`,
    createdAt: "2026-11-10T12:00:00.000Z",
    source: "CVM",
    period,
    asset: { ticker, name: `${ticker} S.A.`, type: tri ? "ACAO" : "FII" },
    analysis: {
      versao: 2,
      tipoDocumento: tri ? "Informações Trimestrais (ITR)" : "Informe Mensal de FII",
      resumoExecutivo: [`Resumo de ${ticker} em ${period}.`],
      alertas: [],
      indicadores: [
        { nome: "Lucro", valor: `lucro de ${period}` },
        { nome: "Patrimônio líquido", valor: `PL de ${period}` },
      ],
      dataReferencia: tri ? "2026-06-30" : "2026-09-01",
      link: tri ? "https://www.rad.cvm.gov.br/doc/1" : null,
    },
    ...extra,
  };
}

type Respostas = {
  relatorios?: Relatorio[];
  demo?: boolean;
  post?: (corpo: { ticker: string; periodo?: string }) => Relatorio | Promise<Relatorio>;
  apagar?: () => Promise<void>;
};

/** Simula a API: lista, carteira, /auth/me, e as duas escritas. Devolve as chamadas de escrita feitas. */
function simularApi({ relatorios = [], demo = false, post, apagar }: Respostas) {
  const escritas: { metodo: string; caminho: string; corpo?: unknown }[] = [];
  api.mockImplementation(async (caminho: string, opcoes?: RequestInit) => {
    const metodo = opcoes?.method ?? "GET";
    if (metodo === "GET" && caminho.startsWith("/reports")) return { itens: relatorios, proximoCursor: null };
    if (caminho === "/assets") return [{ ticker: "BBAS3" }, { ticker: "MXRF11" }];
    if (caminho === "/auth/me") return { demo };
    const corpo = opcoes?.body ? (JSON.parse(String(opcoes.body)) as { ticker: string; periodo?: string }) : undefined;
    escritas.push({ metodo, caminho, corpo });
    if (metodo === "POST" && caminho === "/reports" && post && corpo) return post(corpo);
    if (metodo === "DELETE" && apagar) return apagar();
    return undefined;
  });
  return escritas;
}

const BBAS3 = [relatorio("BBAS3", "2026-T2"), relatorio("BBAS3", "2026-T1"), relatorio("BBAS3", "2025-T4")];
const lista = () => screen.getByRole("navigation", { name: "Ativos com relatório" });
const periodos = () => screen.getByRole("group", { name: "Período" });
const tabela = () => screen.getByRole("table");

async function abrir(respostas: Respostas) {
  const escritas = simularApi(respostas);
  render(<RelatoriosPage />);
  await waitFor(() => expect(screen.queryByLabelText("Carregando relatórios")).toBeNull());
  return escritas;
}

describe("tela de Relatórios: o que mostra", () => {
  it("pede a lista inteira da conta de uma vez", async () => {
    await abrir({ relatorios: BBAS3 });

    expect(api).toHaveBeenCalledWith("/reports?limite=50");
  });

  it("abre no primeiro ativo, no período mais recente, com o resumo e a fonte dele", async () => {
    await abrir({ relatorios: [...BBAS3, relatorio("TAEE11", "2026-T2")] });

    expect(within(lista()).getByRole("button", { name: /BBAS3/ }).getAttribute("aria-current")).toBe("true");
    expect(within(lista()).getByRole("button", { name: /BBAS3/ }).textContent).toContain("3 períodos, até 2T26");
    expect(within(lista()).getByRole("button", { name: /TAEE11/ }).textContent).toContain("1 período, até 2T26");
    expect(within(periodos()).getByRole("button", { name: "2T26" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "O que o documento de 2T26 traz" })).toBeTruthy();
    expect(screen.getByText("Resumo de BBAS3 em 2026-T2.")).toBeTruthy();
    expect(screen.getByText(/Fonte: dados abertos da CVM, data-base 30\/06\/2026/)).toBeTruthy();
  });

  it("a tabela põe os períodos lado a lado, o mais recente primeiro, e avisa que a coluna do 4º trimestre é o ano", async () => {
    await abrir({ relatorios: BBAS3 });

    const cabecalhos = within(tabela()).getAllByRole("columnheader").map((c) => c.textContent);
    expect(cabecalhos).toEqual(["Indicador", "2T26", "1T26", "4T25 (ano)"]);
    const lucro = within(tabela()).getByRole("row", { name: /^Lucro/ });
    expect(within(lucro).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "lucro de 2026-T2",
      "lucro de 2026-T1",
      "lucro de 2025-T4",
    ]);
    expect(screen.getByText(/vem da demonstração anual \(DFP\)/)).toBeTruthy();
  });

  it("escolher outro período troca o resumo, e a tabela continua a mesma", async () => {
    await abrir({ relatorios: BBAS3 });

    fireEvent.click(within(periodos()).getByRole("button", { name: "1T26" }));

    expect(screen.getByText("Resumo de BBAS3 em 2026-T1.")).toBeTruthy();
    expect(screen.queryByText("Resumo de BBAS3 em 2026-T2.")).toBeNull();
    expect(within(tabela()).getAllByRole("columnheader")).toHaveLength(4);
  });

  it("com um período só não há tabela: os indicadores aparecem em lista", async () => {
    await abrir({ relatorios: [relatorio("MXRF11", "2026-09")] });

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("heading", { name: "Indicadores do período" })).toBeTruthy();
    expect(screen.getByText("lucro de 2026-09")).toBeTruthy();
    // no informe mensal a "data" da CVM é o dia 1 do mês: não vai para a tela
    expect(screen.getByText(/Fonte: dados abertos da CVM\./)).toBeTruthy();
    expect(screen.queryByText(/01\/09\/2026/)).toBeNull();
  });

  it("o link do documento abre a CVM em outra aba, sem repassar a origem", async () => {
    await abrir({ relatorios: BBAS3 });

    const link = screen.getByRole("link", { name: /Abrir o documento na CVM/ });
    expect(link.getAttribute("href")).toBe("https://www.rad.cvm.gov.br/doc/1");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("pontos de atenção aparecem com a gravidade escrita, não só na cor", async () => {
    const comAlerta = relatorio("BBAS3", "2026-T2");
    comAlerta.analysis!.alertas = [{ titulo: "Prejuízo no período", severidade: "critico", detalhe: "Lucro: R$ -50,00 mi." }];
    await abrir({ relatorios: [comAlerta] });

    expect(screen.getByRole("heading", { name: "Pontos de atenção" })).toBeTruthy();
    expect(screen.getByText("Crítico:")).toBeTruthy();
    expect(screen.getByText("Lucro: R$ -50,00 mi.")).toBeTruthy();
  });

  it("conta sem relatório: diz o que fazer", async () => {
    await abrir({ relatorios: [] });

    expect(screen.getByText("Nenhum relatório ainda")).toBeTruthy();
    expect(screen.getByText(/Digite o código de uma ação ou de um fundo imobiliário acima/)).toBeTruthy();
  });

  it("falha ao carregar a lista vira mensagem, não tela vazia", async () => {
    api.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/reports")) throw new Error("fora do ar");
      return caminho === "/auth/me" ? { demo: false } : [];
    });
    render(<RelatoriosPage />);

    expect(await screen.findByText(/Não foi possível carregar os seus relatórios/)).toBeTruthy();
    expect(screen.queryByText("Nenhum relatório ainda")).toBeNull();
  });

  it("não sobrou nada de upload de PDF nem de chat", async () => {
    await abrir({ relatorios: BBAS3 });

    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /PDF/i })).toBeNull();
    expect(screen.queryByText(/Buscar no relatório|Pergunte/i)).toBeNull();
  });
});

describe("tela de Relatórios: relatórios guardados antes da mudança", () => {
  const pdfAntigo = relatorio("MXRF11", "2026-03", {
    id: "antigo-1",
    source: "PDF",
    fileName: "MXRF11-relatorio-gerencial.pdf",
    analysis: {
      tipoDocumento: "Relatório Gerencial de FII",
      resumoExecutivo: ["Texto do resumo automático antigo."],
      alertas: [],
      indicadores: [{ nome: "Dividend Yield", valor: "12,4%" }],
    },
  });

  it("ficam numa lista à parte e não entram na tabela nem nos grupos", async () => {
    await abrir({ relatorios: [...BBAS3, pdfAntigo] });

    expect(within(lista()).getByRole("heading", { name: "Guardados antes da mudança" })).toBeTruthy();
    expect(within(lista()).queryByRole("button", { name: /^MXRF11\b.*período/ })).toBeNull();
  });

  it("abrir um deles mostra o texto guardado com o aviso de que não é dado oficial", async () => {
    await abrir({ relatorios: [...BBAS3, pdfAntigo] });

    fireEvent.click(within(lista()).getByRole("button", { name: /MXRF11-relatorio-gerencial\.pdf/ }));

    expect(screen.getByText(/não vem dos dados oficiais da CVM/)).toBeTruthy();
    expect(screen.getByText("Texto do resumo automático antigo.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Indicadores guardados" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(/Fonte: dados abertos da CVM/)).toBeNull();
  });
});

describe("tela de Relatórios: buscar na CVM", () => {
  const campo = () => screen.getByLabelText("Ação ou fundo imobiliário") as HTMLInputElement;

  it("busca o mais recente do código digitado, em maiúsculas, e abre o que veio", async () => {
    const escritas = await abrir({ relatorios: BBAS3, post: ({ ticker }) => relatorio(ticker, "2026-T2") });

    fireEvent.change(campo(), { target: { value: "taee11" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar o mais recente" }));

    expect(await screen.findByText("Resumo de TAEE11 em 2026-T2.")).toBeTruthy();
    expect(escritas).toEqual([{ metodo: "POST", caminho: "/reports", corpo: { ticker: "TAEE11" } }]);
    expect(within(lista()).getByRole("button", { name: /TAEE11/ }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("TAEE11 2026-T2 carregado.");
    expect(campo().value).toBe("");
  });

  it("o botão fica desligado com o campo vazio e enquanto uma busca está em andamento", async () => {
    let liberar: (r: Relatorio) => void = () => undefined;
    await abrir({ relatorios: BBAS3, post: () => new Promise<Relatorio>((r) => (liberar = r)) });
    const botao = () => screen.getByRole("button", { name: "Buscar o mais recente" }) as HTMLButtonElement;

    expect(botao().disabled).toBe(true);
    fireEvent.change(campo(), { target: { value: "TAEE11" } });
    expect(botao().disabled).toBe(false);
    fireEvent.click(botao());

    expect(botao().disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Buscando TAEE11 na CVM");
    liberar(relatorio("TAEE11", "2026-T2"));
    await screen.findByText("Resumo de TAEE11 em 2026-T2.");
  });

  it("'Carregar' pede o período logo antes do mais antigo que a conta tem", async () => {
    const escritas = await abrir({ relatorios: BBAS3, post: ({ ticker, periodo }) => relatorio(ticker, periodo ?? "") });

    fireEvent.click(within(periodos()).getByRole("button", { name: "Carregar 3T25" }));

    expect(await screen.findByText("Resumo de BBAS3 em 2025-T3.")).toBeTruthy();
    expect(escritas).toEqual([{ metodo: "POST", caminho: "/reports", corpo: { ticker: "BBAS3", periodo: "2025-T3" } }]);
    // o próximo a oferecer é o anterior ao que acabou de entrar
    expect(within(periodos()).getByRole("button", { name: "Carregar 2T25" })).toBeTruthy();
  });

  it("relatório que a conta já tinha (mesmo id) não aparece duas vezes", async () => {
    await abrir({ relatorios: BBAS3, post: () => BBAS3[0]! });

    fireEvent.change(campo(), { target: { value: "BBAS3" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar o mais recente" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("carregado"));
    expect(within(periodos()).getAllByRole("button", { name: "2T26" })).toHaveLength(1);
  });

  it("erro da API aparece com a mensagem do backend, e a tela continua como estava", async () => {
    const { ApiError } = await import("@/lib/api");
    await abrir({
      relatorios: BBAS3,
      post: () => {
        throw new ApiError("A CVM ainda não tem dados de BBAS3 para 3T25.", 404);
      },
    });

    fireEvent.click(within(periodos()).getByRole("button", { name: "Carregar 3T25" }));

    expect((await screen.findByRole("alert")).textContent).toBe("A CVM ainda não tem dados de BBAS3 para 3T25.");
    expect(screen.getByText("Resumo de BBAS3 em 2026-T2.")).toBeTruthy();
    expect((within(periodos()).getByRole("button", { name: "Carregar 3T25" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("tela de Relatórios: apagar", () => {
  it("pede confirmação com o foco em Cancelar, e cancelar não apaga", async () => {
    const escritas = await abrir({ relatorios: BBAS3 });

    fireEvent.click(screen.getByRole("button", { name: "Apagar este relatório" }));

    expect(screen.getByText(/Apagar BBAS3 2026-T2 da sua conta\?/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(escritas).toEqual([]);
    expect(screen.getByRole("button", { name: "Apagar este relatório" })).toBeTruthy();
  });

  it("confirmar apaga só aquele período e a tela vai para o mais recente que sobrou", async () => {
    const escritas = await abrir({ relatorios: BBAS3, apagar: async () => undefined });

    fireEvent.click(screen.getByRole("button", { name: "Apagar este relatório" }));
    fireEvent.click(screen.getByRole("button", { name: "Apagar" }));

    expect(await screen.findByText("Resumo de BBAS3 em 2026-T1.")).toBeTruthy();
    expect(escritas).toEqual([{ metodo: "DELETE", caminho: "/reports/BBAS3-2026-T2", corpo: undefined }]);
    expect(within(periodos()).queryByRole("button", { name: "2T26" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("BBAS3 2026-T2 apagado.");
  });

  it("apagar o único período do único ativo volta para a tela vazia", async () => {
    await abrir({ relatorios: [relatorio("MXRF11", "2026-09")], apagar: async () => undefined });

    fireEvent.click(screen.getByRole("button", { name: "Apagar este relatório" }));
    fireEvent.click(screen.getByRole("button", { name: "Apagar" }));

    expect(await screen.findByText("Nenhum relatório ainda")).toBeTruthy();
  });

  it("falha ao apagar mantém o relatório e mostra o erro", async () => {
    await abrir({
      relatorios: BBAS3,
      apagar: async () => {
        throw new Error("rede");
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Apagar este relatório" }));
    fireEvent.click(screen.getByRole("button", { name: "Apagar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Não foi possível apagar o relatório.");
    expect(within(periodos()).getByRole("button", { name: "2T26" })).toBeTruthy();
  });
});

describe("tela de Relatórios: conta de demonstração (somente leitura)", () => {
  it("mostra os relatórios carregados e nenhum controle que grava", async () => {
    const escritas = await abrir({ relatorios: BBAS3, demo: true });
    await screen.findByText(/Na conta de demonstração os relatórios já vêm carregados/);

    expect(within(tabela()).getAllByRole("columnheader")).toHaveLength(4);
    expect(screen.queryByLabelText("Ação ou fundo imobiliário")).toBeNull();
    expect(screen.queryByRole("button", { name: /Buscar o mais recente|Carregar |Apagar/ })).toBeNull();
    // navegar entre períodos continua funcionando
    fireEvent.click(within(periodos()).getByRole("button", { name: "4T25" }));
    expect(screen.getByText("Resumo de BBAS3 em 2025-T4.")).toBeTruthy();
    expect(escritas).toEqual([]);
  });
});
