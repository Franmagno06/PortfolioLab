// A API de mentira do E2E das páginas de ativos: imita GET /ativos/* do backend
// (backend/src/modules/ativos/ativos.tipos.ts) com números fixos. Roda com `node`, sem dependência.
//
// Alguns tickers existem só para exercitar um estado da tela; a lista está em CASOS no fim do arquivo.
// POST /__modo liga uma falha geral (ex.: {"listas":"erro"}), e POST /__modo/reset desliga.

import { createServer } from "node:http";

const PORTA = Number(process.env.STUB_PORT ?? 3399);

// ---- catálogo -------------------------------------------------------------
// [ticker, nome, setor, espécie, preço, variação, P/L, P/VP, DY 12m, ROE]
const ACOES = [
  ["PETR4", "Petrobras PN", "Petróleo e gás", "PN", 38.12, 0.8, 5.4, 1.2, 13.8, 22.3],
  ["VALE3", "Vale S.A.", "Mineração", "ON", 62.48, 1.2, 6.9, 1.3, 8.4, 18.2],
  ["ITUB4", "Itaú Unibanco PN", "Bancos", "PN", 36.9, 0.4, 9.1, 1.9, 6.2, 21.0],
  ["BBDC4", "Bradesco PN", "Bancos", "PN", 14.25, -0.3, 8.0, 0.9, 7.8, 11.5],
  ["BBAS3", "Banco do Brasil ON", "Bancos", "ON", 24.7, 0.6, 4.3, 0.7, 10.9, 17.6],
  ["ABEV3", "Ambev ON", "Bebidas", "ON", 12.8, -0.5, 14.2, 2.3, 5.9, 16.1],
  ["WEGE3", "WEG ON", "Bens industriais", "ON", 41.3, 0.9, 27.5, 7.6, 1.5, 28.0],
  ["B3SA3", "B3 ON", "Serviços financeiros", "ON", 11.7, 0.2, 13.0, 3.4, 6.8, 26.0],
  ["SUZB3", "Suzano ON", "Papel e celulose", "ON", 52.6, 1.5, 6.1, 2.0, 3.4, 31.0],
  ["AXIA3", "Axia Energia (antiga Eletrobras) ON", "Energia elétrica", "ON", 41.9, -0.2, 11.8, 0.9, 4.1, 7.6],
  ["RENT3", "Localiza ON", "Aluguel de carros", "ON", 47.2, -1.1, 15.9, 1.9, 2.6, 12.5],
  ["CMIG4", "Cemig PN", "Energia elétrica", "PN", 11.4, 0.7, 8.5, 1.3, 9.2, 15.8],
  ["RADL3", "RaiaDrogasil ON", "Farmácias", "ON", 24.1, -0.4, 33.0, 5.9, 1.7, 17.5],
  ["EQTL3", "Equatorial ON", "Energia elétrica", "ON", 33.8, 0.3, 13.6, 2.0, 4.4, 15.0],
  ["TAEE11", "Taesa Unit", "Transmissão de energia", "Unit", 42.85, 0.5, 9.02, 1.83, 7.02, 20.9],
];

// [ticker, nome, tipo, segmento, preço, variação, DY 12m, P/VP]
const FIIS = [
  ["MXRF11", "Maxi Renda", "Papel", "Recebíveis (CRI)", 9.08, -0.4, 12.1, 1.01],
  ["HGLG11", "Pátria Log (antigo CSHG Logística)", "Tijolo", "Logística", 158.4, 0.2, 8.6, 0.95],
  ["KNRI11", "Kinea Renda Imobiliária", "Tijolo", "Lajes e logística", 156.2, -0.1, 8.3, 0.93],
  ["KNCR11", "Kinea Rendimentos Imobiliários", "Papel", "Recebíveis (CDI)", 103.5, 0.1, 12.4, 1.0],
  ["KNIP11", "Kinea Índices de Preços", "Papel", "Recebíveis (IPCA)", 90.3, -0.2, 11.2, 0.98],
  ["BTLG11", "BTG Pactual Logística", "Tijolo", "Logística", 102.1, 0.3, 8.7, 0.96],
  ["XPLG11", "XP Log", "Tijolo", "Logística", 99.8, 0.1, 8.4, 0.88],
  ["VISC11", "Vinci Shopping Centers", "Tijolo", "Shoppings", 107.6, -0.3, 8.9, 0.93],
  ["HGRE11", "Pátria Escritórios (antigo CSHG Real Estate)", "Tijolo", "Lajes corporativas", 122.3, -0.6, 7.2, 0.76],
  ["KFOF11", "Kinea Fundo de Fundos", "FoF", "Fundo de fundos", 70.4, 0.0, 9.4, 0.83],
  ["HGBS11", "Hedge Brasil Shopping", "Tijolo", "Shoppings", 192.5, -0.2, 8.1, 0.91],
  ["VILG11", "Vinci Logística", "Tijolo", "Logística", 102.9, 0.2, 8.0, 0.86],
  ["XPSF11", "XP Selection Fundo de Fundos", "FoF", "Fundo de fundos", 62.1, -0.4, 8.8, 0.82],
  ["XPML11", "XP Malls", "Tijolo", "Shoppings", 108.7, 0.4, 8.6, 0.95],
  ["HGCR11", "Pátria Recebíveis Imobiliários (antigo CSHG Recebíveis)", "Papel", "Recebíveis (CRI)", 71.3, -0.7, 12.9, 0.85],
];

// ---- casos de estado ------------------------------------------------------
const CASOS = {
  // ficha inteira falha: a página mostra o erro, e a listagem continua normal
  ficha503: ["SUZB3", "BTLG11"],
  // preço, variação e indicadores que a fonte não informou
  semPreco: ["B3SA3", "HGBS11"],
  // resultados da CVM nunca lidos (acao) / informe mensal nunca lido (fii)
  semCvm: ["ABEV3", "XPLG11"],
  // histórico de preços lido há dias, com a última tentativa falha
  historicoAntigo: ["RENT3", "VILG11"],
  // a fonte respondeu, mas não há notícia nem provento
  semNoticias: ["WEGE3", "KNCR11"],
};
const emCaso = (nome, ticker) => CASOS[nome].includes(ticker);

// ---- montagem das respostas ----------------------------------------------
const AGORA = "2026-10-12T15:00:00.000Z";
const ok = (dados) => ({ estado: "ok", atualizadoEm: AGORA, dados });
const indisponivel = () => ({ estado: "indisponivel", atualizadoEm: null, dados: null });

const MESES = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
const arredondar = (n) => Math.round(n * 100) / 100;

/** Doze fechamentos que terminam exatamente no preço atual. */
function historico(preco) {
  return MESES.map((mes, i) => ({
    mes,
    fechamento: i === 11 ? preco : arredondar(preco * (0.92 + 0.08 * (i / 11) + 0.015 * Math.sin(i * 1.7))),
  }));
}

function proventos(preco, dy) {
  const valor = arredondar((preco * dy) / 100 / 4);
  return ["2026-09-15", "2026-06-15", "2026-03-16", "2025-12-15"].map((dataEx) => ({ dataEx, valor }));
}

const NOTICIAS = {
  VALE3: [
    { titulo: "VALE3 sobe com a alta do minério de ferro", fonte: "InfoMoney", publicadaEm: "2026-10-09T12:00:00.000Z", url: "https://exemplo.invalid/vale3-sobe" },
    { titulo: "Vale anuncia pagamento de dividendos", fonte: "Money Times", publicadaEm: "2026-10-08T12:00:00.000Z", url: "https://exemplo.invalid/vale-dividendos" },
  ],
  MXRF11: [{ titulo: "MXRF11 divulga o rendimento do mês", fonte: "Suno Notícias", publicadaEm: "2026-10-07T12:00:00.000Z", url: "https://exemplo.invalid/mxrf11" }],
};

const RESULTADOS = [
  { periodo: "2T25", dataReferencia: "2025-06-30", lucroLiquido: 6_100_000_000, patrimonioLiquido: 180_000_000_000 },
  { periodo: "3T25", dataReferencia: "2025-09-30", lucroLiquido: 6_900_000_000, patrimonioLiquido: 182_300_000_000 },
  { periodo: "4T25", dataReferencia: "2025-12-31", lucroLiquido: 7_400_000_000, patrimonioLiquido: 185_000_000_000 },
  { periodo: "1T26", dataReferencia: "2026-03-31", lucroLiquido: 8_000_000_000, patrimonioLiquido: 188_100_000_000 },
];

function resumoDaAcao([ticker, nome, setor, especie, preco, variacaoDia, pl, pvp, dy12m, roe]) {
  const semPreco = emCaso("semPreco", ticker);
  return {
    ticker, nome, setor, especie,
    preco: semPreco ? null : preco,
    variacaoDia: semPreco ? null : variacaoDia,
    pl: semPreco ? null : pl,
    pvp: semPreco ? null : pvp,
    dy12m: semPreco ? null : dy12m,
    roe: semPreco ? null : roe,
  };
}

function fichaDaAcao(linha) {
  const [ticker, , setor, , preco, , pl, pvp, dy12m, roe] = linha;
  const resumo = resumoDaAcao(linha);
  const semPreco = emCaso("semPreco", ticker);
  const banco = setor === "Bancos";
  return {
    ...resumo,
    fechamentoEm: semPreco ? null : "2026-10-09",
    banco,
    indicadores: semPreco
      ? indisponivel()
      : ok({ pl, pvp, dy12m, roe, roa: banco ? 1.7 : null, margemLiquida: banco ? null : 21.5, dividaEbitda: banco ? null : 0.6 }),
    historico: semPreco
      ? indisponivel()
      : emCaso("historicoAntigo", ticker)
        ? { estado: "desatualizado", atualizadoEm: "2026-10-05T12:00:00.000Z", dados: historico(preco) }
        : ok(historico(preco)),
    proventos: ok(emCaso("semNoticias", ticker) ? [] : proventos(preco, dy12m)),
    resultados: emCaso("semCvm", ticker) ? indisponivel() : ok(RESULTADOS),
    noticias: ok(NOTICIAS[ticker] ?? []),
  };
}

function resumoDoFii([ticker, nome, tipo, segmento, preco, variacaoDia, dy12m, pvp]) {
  const semPreco = emCaso("semPreco", ticker);
  return {
    ticker, nome, tipo, segmento,
    preco: semPreco ? null : preco,
    variacaoDia: semPreco ? null : variacaoDia,
    dy12m: semPreco ? null : dy12m,
    pvp: semPreco ? null : pvp,
  };
}

function fichaDoFii(linha) {
  const [ticker, , tipo, , preco, , dy12m, pvp] = linha;
  const resumo = resumoDoFii(linha);
  const semPreco = emCaso("semPreco", ticker);
  const semInforme = emCaso("semCvm", ticker);
  return {
    ...resumo,
    fechamentoEm: semPreco ? null : "2026-10-09",
    indicadores: {
      dyMensal: semPreco ? null : 1.0,
      dy12m: semPreco ? null : dy12m,
      pvp: semPreco ? null : pvp,
      patrimonioLiquido: semInforme ? null : 5_200_000_000,
      cotistas: semInforme ? null : 985_000,
      taxaAdministracao: semInforme ? null : 0.9,
      gestao: semInforme ? null : "Ativa",
    },
    informe: semInforme
      ? { estado: "indisponivel", atualizadoEm: null, competencia: null }
      : { estado: "ok", atualizadoEm: AGORA, competencia: "2026-08" },
    composicao: semInforme
      ? indisponivel()
      : ok(
          tipo === "Papel"
            ? { imoveis: 8, papel: 78, cotasDeFii: 6, liquidez: 7.5, outros: 0.5 }
            : tipo === "FoF"
              ? { imoveis: 1, papel: 14.8, cotasDeFii: 78.6, liquidez: 5.6, outros: 0 }
              : { imoveis: 88, papel: 3, cotasDeFii: 2, liquidez: 6.5, outros: 0.5 },
        ),
    historico: semPreco
      ? indisponivel()
      : emCaso("historicoAntigo", ticker)
        ? { estado: "desatualizado", atualizadoEm: "2026-10-05T12:00:00.000Z", dados: historico(preco) }
        : ok(historico(preco)),
    proventos: ok(emCaso("semNoticias", ticker) ? [] : proventos(preco, dy12m / 12)),
    noticias: ok(NOTICIAS[ticker] ?? []),
  };
}

// ---- servidor -------------------------------------------------------------
let modo = {};

function responder(res, status, corpo) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(corpo));
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const partes = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/health") return responder(res, 200, { ok: true });

  if (req.method === "POST" && partes[0] === "__modo") {
    if (partes[1] === "reset") {
      modo = {};
      return responder(res, 200, { ok: true });
    }
    let texto = "";
    req.on("data", (pedaco) => (texto += pedaco));
    req.on("end", () => {
      modo = JSON.parse(texto || "{}");
      responder(res, 200, { ok: true });
    });
    return;
  }

  if (req.method !== "GET" || partes[0] !== "ativos" || !["acoes", "fiis"].includes(partes[1] ?? "")) {
    return responder(res, 404, { error: "Rota não encontrada" });
  }

  const classe = partes[1];
  const tabela = classe === "acoes" ? ACOES : FIIS;

  if (partes.length === 2) {
    if (modo.listas === "erro") return responder(res, 503, { error: "Fora do ar" });
    return responder(res, 200, tabela.map(classe === "acoes" ? resumoDaAcao : resumoDoFii));
  }

  const ticker = (partes[2] ?? "").toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(ticker)) return responder(res, 400, { error: "Ticker inválido" });
  const linha = tabela.find((l) => l[0] === ticker);
  if (!linha) return responder(res, 404, { error: "Ativo não encontrado" });
  if (emCaso("ficha503", ticker)) return responder(res, 503, { error: "Fora do ar" });
  return responder(res, 200, classe === "acoes" ? fichaDaAcao(linha) : fichaDoFii(linha));
}).listen(PORTA, () => console.log(`API de mentira dos ativos em http://localhost:${PORTA}`));
