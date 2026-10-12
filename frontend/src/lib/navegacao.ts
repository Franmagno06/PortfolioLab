import { ACOES_INICIAIS, FIIS_INICIAIS } from "./ativos-catalogo";
import { APORTE_DO_DESAFIO } from "./carteira-exemplo";
import { brlSemCentavos } from "./format";
import { TRILHAS } from "./site-dados";

/**
 * Navegação do site público: uma fonte só para o cabeçalho, a gaveta do
 * celular e o rodapé.
 *
 * Destino sem `href` é "em breve": aparece apagado, não vira link e não recebe
 * foco. Quando a página existir, basta pôr o `href` — e, se for pública, liberar
 * a rota no src/proxy.ts (`/` e `/ativos/*` são as públicas hoje).
 */

/** Os caminhos que existem hoje. navegacao.test.ts confere cada um contra src/app. */
export const ROTAS = {
  inicio: "/",
  desafio: "/#desafio",
  comoLerUmAtivo: "/#como-ler-um-ativo",
  carteira: "/carteira",
  simulacao: "/simulacao",
  relatorios: "/relatorios",
  indicadores: "/indicadores",
  noticias: "/noticias",
  acoes: "/ativos/acoes",
  fiis: "/ativos/fiis",
  dashboard: "/dashboard",
  login: "/login",
  registro: "/registro",
} as const;

/** Um atalho direto para a ficha de um ativo, que o menu mostra ao passar o mouse. */
export type Atalho = { rotulo: string; descricao: string; href: string };

export type Destino = {
  rotulo: string;
  descricao?: string;
  href?: string;
  /** Posição numa sequência (as trilhas): só elas têm número. */
  numero?: number;
  /** Fichas que abrem num pequeno painel quando o mouse (ou o foco) chega ao item. */
  atalhos?: { titulo: string; itens: Atalho[] };
};

export type Coluna = {
  titulo?: string;
  itens: Destino[];
  /** "larga" para o sumário das trilhas; o resto divide o espaço igual. */
  largura?: "larga" | "estreita";
};

export type Destaque =
  | { tipo: "desafio"; titulo: string; texto: string; link: Destino }
  | { tipo: "indices"; titulo: string; link: Destino };

export type Intencao = {
  id: "aprender" | "ativos" | "planejar" | "noticias";
  rotulo: "Aprender" | "Ativos" | "Planejar" | "Notícias";
  /** Notícias é link direto, sem menu. */
  href?: string;
  colunas?: Coluna[];
  destaque?: Destaque;
};

export const NAVEGACAO: Intencao[] = [
  {
    id: "aprender",
    rotulo: "Aprender",
    colunas: [
      {
        titulo: "Trilhas, na ordem",
        largura: "larga",
        itens: TRILHAS.map((t) => ({
          rotulo: t.titulo,
          numero: t.numero,
          descricao: `${t.aulas} aulas`,
        })),
      },
      {
        titulo: "Consultar",
        largura: "estreita",
        itens: [
          { rotulo: "Glossário", descricao: "Os termos do mercado, em português claro." },
          {
            rotulo: "Indicadores explicados",
            descricao: "P/L, P/VP, dividend yield e os outros, um por um.",
            href: ROTAS.comoLerUmAtivo,
          },
          {
            rotulo: "Como o site calcula",
            descricao: "Preço médio, proventos e aporte, com as contas abertas.",
          },
        ],
      },
    ],
    destaque: {
      tipo: "desafio",
      titulo: "Desafio do aporte",
      texto: `Você tem ${brlSemCentavos(APORTE_DO_DESAFIO)} para uma carteira de exemplo. Monte a compra e compare com o cálculo do PortfolioLab.`,
      link: { rotulo: "Fazer o desafio", href: ROTAS.desafio },
    },
  },
  {
    id: "ativos",
    rotulo: "Ativos",
    colunas: [
      {
        titulo: "Ações",
        itens: [
          {
            rotulo: "Buscar ações",
            descricao: "15 empresas da bolsa, para começar a olhar de perto.",
            href: ROTAS.acoes,
            atalhos: {
              // "Da lista", e não "principais": a ordem do catálogo não é um ranking.
              titulo: "Ações da lista",
              itens: ACOES_INICIAIS.map((a) => ({
                rotulo: a.ticker,
                descricao: a.nome,
                href: `${ROTAS.acoes}/${a.ticker}`,
              })),
            },
          },
          { rotulo: "Ações por setor", descricao: "Bancos, energia, varejo e outros." },
        ],
      },
      {
        titulo: "Fundos imobiliários",
        itens: [
          {
            rotulo: "Buscar FIIs",
            descricao: "15 fundos de tijolo, papel e híbridos.",
            href: ROTAS.fiis,
            atalhos: {
              titulo: "Fundos da lista",
              itens: FIIS_INICIAIS.map((f) => ({
                rotulo: f.ticker,
                descricao: f.nome,
                href: `${ROTAS.fiis}/${f.ticker}`,
              })),
            },
          },
          { rotulo: "Agenda de proventos", descricao: "Quem paga, quanto e quando, com a data-com." },
        ],
      },
      {
        titulo: "ETFs",
        itens: [{ rotulo: "Buscar ETFs", descricao: "Fundos que copiam um índice." }],
      },
    ],
    destaque: {
      tipo: "indices",
      titulo: "Índices de referência",
      link: { rotulo: "Indicadores da minha carteira", href: ROTAS.indicadores },
    },
  },
  {
    id: "planejar",
    rotulo: "Planejar",
    colunas: [
      {
        itens: [
          {
            rotulo: "Simular o aporte do mês",
            descricao: "Quantas cotas comprar de cada ativo para chegar às metas.",
            href: ROTAS.simulacao,
          },
          {
            // as metas são editadas na própria tela de simulação
            rotulo: "Metas da carteira",
            descricao: "Defina quanto cada ativo deve pesar.",
            href: ROTAS.simulacao,
          },
        ],
      },
      {
        itens: [
          {
            rotulo: "Relatórios com IA",
            descricao: "Envie o PDF de um fundo ou de uma empresa e entenda o que mudou.",
            href: ROTAS.relatorios,
          },
          { rotulo: "Calculadoras", descricao: "Juros compostos, inflação e renda fixa." },
        ],
      },
    ],
  },
  { id: "noticias", rotulo: "Notícias", href: ROTAS.noticias },
];

/**
 * As abas da área logada, logo abaixo do cabeçalho do site — como a
 * "Carteira" do Investidor10. Substituem o antigo menu lateral: a área logada
 * deixou de ser um painel à parte e passou a ser uma parte do site.
 */
export const ABAS_DA_CARTEIRA = [
  { id: "resumo", rotulo: "Resumo", href: ROTAS.dashboard },
  { id: "posicoes", rotulo: "Posições", href: ROTAS.carteira },
  { id: "simulacao", rotulo: "Simular aporte", href: ROTAS.simulacao },
  { id: "relatorios", rotulo: "Relatórios com IA", href: ROTAS.relatorios },
  { id: "indicadores", rotulo: "Indicadores", href: ROTAS.indicadores },
  { id: "noticias", rotulo: "Notícias", href: ROTAS.noticias },
] as const;

export type AbaDaCarteira = (typeof ABAS_DA_CARTEIRA)[number];

/** Rodapé: só destinos que já existem, então todo link é obrigatório aqui. */
export const RODAPE: { titulo: string; links: { rotulo: string; href: string }[] }[] = [
  {
    titulo: "Aprender",
    links: [
      { rotulo: "Desafio do aporte", href: ROTAS.desafio },
      { rotulo: "Indicadores explicados", href: ROTAS.comoLerUmAtivo },
    ],
  },
  {
    titulo: "Ativos",
    links: [
      { rotulo: "Ações", href: ROTAS.acoes },
      { rotulo: "Fundos imobiliários", href: ROTAS.fiis },
    ],
  },
  {
    titulo: "Planejar",
    links: [
      { rotulo: "Simular aporte", href: ROTAS.simulacao },
      { rotulo: "Relatórios com IA", href: ROTAS.relatorios },
      { rotulo: "Notícias", href: ROTAS.noticias },
    ],
  },
  {
    titulo: "Conta",
    links: [
      { rotulo: "Entrar", href: ROTAS.login },
      { rotulo: "Criar conta", href: ROTAS.registro },
      { rotulo: "Minha carteira", href: ROTAS.dashboard },
    ],
  },
];
