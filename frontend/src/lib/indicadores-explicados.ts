import { brl, numero } from "./format";

/**
 * Os textos que explicam cada número das páginas de ativos.
 *
 * Duas regras de escrita, por causa de quem lê (quem nunca investiu) e da
 * Resolução CVM 20: o texto diz o que o número MEDE e como LER, e nunca se o
 * ativo é bom, barato ou uma oportunidade.
 */

export type IdDaDica =
  | "pl" | "pvp" | "dy12m" | "roe" | "margemLiquida" | "roa" | "dividaEbitda"
  | "especie"
  | "tipoFii" | "dyMensal" | "pvpFii" | "dyFii" | "patrimonioLiquido" | "cotistas"
  | "taxaAdministracao" | "gestao";

/** Cada dica tem o nome do indicador (para o leitor de tela) e uma explicação de uma frase ou duas. */
export const DICAS: Record<IdDaDica, { rotulo: string; texto: string }> = {
  pl: {
    rotulo: "P/L",
    texto:
      "P/L = preço ÷ lucro por ação. Mostra quantos anos de lucro seriam necessários para pagar o preço. Só compare empresas do mesmo setor.",
  },
  pvp: {
    rotulo: "P/VP",
    texto:
      "P/VP = preço ÷ patrimônio por ação. 1,0 significa pagar exatamente o patrimônio contábil da empresa; abaixo de 1, pagar menos que ele.",
  },
  dy12m: {
    rotulo: "DY 12m",
    texto:
      "DY 12m = proventos pagos nos últimos 12 meses ÷ preço de hoje. DY 7% quer dizer R$ 7 pagos, no passado, para cada R$ 100 do preço de hoje; nada garante que se repita.",
  },
  roe: {
    rotulo: "ROE",
    texto:
      "ROE = lucro líquido ÷ patrimônio líquido, em 12 meses. Mostra quanto a empresa gera de lucro com o dinheiro dos sócios.",
  },
  margemLiquida: {
    rotulo: "Margem líquida",
    texto:
      "Margem líquida = lucro líquido ÷ receita. De cada R$ 100 vendidos, quanto sobra de lucro depois de todos os custos e impostos.",
  },
  roa: {
    rotulo: "ROA",
    texto:
      "ROA = lucro líquido ÷ ativo total. Mostra quanto o banco gera de lucro com tudo o que tem. Em banco, é mais comparável que a margem.",
  },
  dividaEbitda: {
    rotulo: "Dívida líquida/EBITDA",
    texto:
      "Dívida líquida ÷ EBITDA (a geração de caixa do negócio). Mostra em quanto tempo a empresa quitaria a dívida só com o que gera. As faixas variam por setor.",
  },
  especie: {
    rotulo: "ON, PN e Unit",
    texto:
      "ON = ação ordinária: dá direito a voto. PN = preferencial: prioridade nos proventos. Unit = pacote de ações.",
  },
  tipoFii: {
    rotulo: "Tipo de fundo",
    texto:
      "Tijolo = o fundo é dono de prédios. Papel = empresta dinheiro (títulos CRI). Híbrido = os dois. FoF = compra cotas de outros FIIs.",
  },
  dyMensal: {
    rotulo: "DY mensal",
    texto: "DY mensal = rendimento pago no último mês ÷ preço da cota. Os FIIs costumam pagar todo mês.",
  },
  pvpFii: {
    rotulo: "P/VP",
    texto:
      "P/VP = preço da cota ÷ valor patrimonial da cota. 1,0 significa pagar exatamente o que o patrimônio do fundo vale no papel.",
  },
  dyFii: {
    rotulo: "DY 12m",
    texto:
      "DY 12m = rendimentos pagos nos últimos 12 meses ÷ preço da cota hoje. DY 12% quer dizer R$ 12 pagos, no passado, para cada R$ 100 do preço da cota; nada garante que se repita.",
  },
  patrimonioLiquido: {
    rotulo: "Patrimônio líquido",
    texto: "Patrimônio líquido = tudo o que o fundo possui (imóveis, títulos, caixa) menos o que ele deve.",
  },
  cotistas: {
    rotulo: "Número de cotistas",
    texto: "Quantas pessoas têm cotas do fundo. Muita gente costuma significar que é mais fácil comprar e vender.",
  },
  taxaAdministracao: {
    rotulo: "Taxa de administração",
    texto: "Taxa de administração = o que o fundo cobra por ano, sobre o patrimônio, para ser administrado e gerido.",
  },
  gestao: {
    rotulo: "Tipo de gestão",
    texto:
      "Gestão ativa = os gestores escolhem e trocam os ativos. Gestão passiva = o fundo segue uma lista pronta, como um índice.",
  },
};

/** As armadilhas: o erro de leitura mais comum de cada indicador. Sempre visíveis. */
export const ARMADILHAS = {
  pl: "Lucro pontual (venda de um ativo, por exemplo) pode distorcer o P/L.",
  dyAcao: "DY alto pode ser o preço caindo, não o provento subindo.",
  dyFii: "DY muito acima da média do segmento pode indicar risco: confira de onde vem o rendimento.",
  pvpFii: "P/VP abaixo de 1 com DY muito alto exige cuidado: o mercado pode estar enxergando algum problema.",
} as const;

// ---------------------------------------------------------------------------
// Leituras: a frase curta que traduz cada número. Indicador ausente (o
// provedor não informou) devolve uma frase que diz isso, nunca um texto vazio.
// ---------------------------------------------------------------------------

const SEM_DADO = "O dado deste indicador não está disponível agora.";

export function leituraPl(pl: number | null): string {
  if (pl === null) return SEM_DADO;
  if (pl <= 0) return "A empresa teve prejuízo nos últimos 12 meses, então o P/L não se aplica.";
  const anos = Math.max(1, Math.round(pl));
  return `Pelo preço de hoje, o lucro de cerca de ${numero(anos)} ${anos === 1 ? "ano" : "anos"} pagaria a ação.`;
}

export function leituraPvpAcao(pvp: number | null): string {
  if (pvp === null) return SEM_DADO;
  return `Você paga ${brl(pvp)} para cada R$ 1,00 de patrimônio contábil da empresa.`;
}

export function leituraDy(dy: number | null): string {
  if (dy === null) return SEM_DADO;
  return `Nos últimos 12 meses, pagou ${brl(dy)} de proventos para cada R$ 100 do preço de hoje.`;
}

export function leituraRoe(roe: number | null): string {
  if (roe === null) return SEM_DADO;
  return `De cada R$ 100 do patrimônio, a empresa gerou ${brl(roe)} de lucro em um ano.`;
}

export function leituraMargem(margem: number | null): string {
  if (margem === null) return SEM_DADO;
  return `De cada R$ 100 vendidos, ${brl(margem)} viram lucro depois de tudo.`;
}

export function leituraRoa(roa: number | null): string {
  if (roa === null) return SEM_DADO;
  return `De cada R$ 100 em ativos, o banco gerou ${brl(roa)} de lucro em um ano.`;
}

export function leituraDivida(x: number | null): string {
  if (x === null) return SEM_DADO;
  if (x <= 0) return "A empresa tem mais caixa do que dívida.";
  if (x < 1) {
    const meses = Math.max(1, Math.round(x * 12));
    return `Em cerca de ${meses} ${meses === 1 ? "mês" : "meses"} de geração de caixa, a empresa quitaria a dívida líquida.`;
  }
  return `Em cerca de ${numero(x, 1)} anos de geração de caixa, a empresa quitaria a dívida líquida.`;
}

export function leituraDyMensal(dyMensal: number | null): string {
  if (dyMensal === null) return SEM_DADO;
  return `Em um mês, o fundo pagou ${brl(dyMensal)} de rendimento a cada R$ 100 de cota.`;
}

export function leituraPvpFii(pvp: number | null): string {
  if (pvp === null) return SEM_DADO;
  return `Você paga ${brl(pvp)} para cada R$ 1,00 do patrimônio do fundo.`;
}

export function leituraPatrimonioLiquido(): string {
  return "Tudo o que o fundo possui (imóveis, títulos, caixa) menos o que deve.";
}

export function leituraCotistas(): string {
  return "Quantas pessoas têm cotas do fundo. Muita gente costuma dar mais liquidez.";
}

export function leituraTaxaAdministracao(): string {
  return "Ao ano, sobre o patrimônio: é descontada do rendimento que chega a você.";
}

/** A frase que resume, em palavras, o que a composição da carteira do fundo mostra. */
export function leituraComposicao(tipo: "Tijolo" | "Papel" | "Híbrido" | "FoF"): string {
  switch (tipo) {
    case "Papel":
      return "Este é um fundo de “papel”: quase tudo está em dívidas imobiliárias, e quase nada em prédios.";
    case "Tijolo":
      return "Este é um fundo de “tijolo”: a maior parte do patrimônio está em imóveis.";
    case "Híbrido":
      return "Este é um fundo “híbrido”: o patrimônio se divide entre imóveis e títulos ligados a imóveis.";
    case "FoF":
      return "Este é um fundo de fundos: o patrimônio está em cotas de outros FIIs, e não em imóveis diretamente.";
  }
}

export function leituraGestao(gestao: string | null): string {
  if (gestao === "Ativa") return "Os gestores escolhem e trocam os ativos, em vez de seguir um índice.";
  if (gestao === "Passiva") return "O fundo segue uma lista pronta, como um índice, sem escolhas do gestor.";
  return SEM_DADO;
}
