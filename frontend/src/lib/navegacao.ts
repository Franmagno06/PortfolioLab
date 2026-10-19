import { ACOES_INICIAIS, ETFS_INICIAIS, FIIS_INICIAIS } from "./ativos-catalogo";
import { APORTE_DO_DESAFIO } from "./carteira-exemplo";
import { brlSemCentavos } from "./format";

/**
 * Navegação do site público: uma fonte só para o cabeçalho, a gaveta do
 * celular e o rodapé.
 *
 * Destino sem `href` é "em breve": aparece apagado, não vira link e não recebe
 * foco. Quando a página existir, basta pôr o `href` — e, se for pública, liberar
 * a rota no src/proxy.ts (`/`, `/ativos/*` e `/aprender/*` são as públicas hoje).
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
  aprender: "/aprender",
  glossario: "/aprender/glossario",
  indicadoresExplicados: "/aprender/indicadores",
  comoCalculamos: "/aprender/como-calculamos",
  acoes: "/ativos/acoes",
  fiis: "/ativos/fiis",
  etfs: "/ativos/etfs",
  indices: "/ativos/indices",
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
        titulo: "Ler",
        itens: [
          {
            rotulo: "Artigos",
            descricao: "Textos curtos, sem jargão, com as contas feitas em reais.",
            href: ROTAS.aprender,
          },
        ],
      },
      {
        titulo: "Consultar",
        itens: [
          { rotulo: "Glossário", descricao: "Os termos do mercado, em português claro.", href: ROTAS.glossario },
          {
            rotulo: "Indicadores explicados",
            descricao: "P/L, P/VP, dividend yield e os outros, um por um.",
            href: ROTAS.indicadoresExplicados,
          },
          {
            rotulo: "Como o site calcula",
            descricao: "Preço médio, proventos e aporte, com as contas abertas.",
            href: ROTAS.comoCalculamos,
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
        itens: [
          {
            rotulo: "Buscar ETFs",
            descricao: "10 fundos que copiam um índice, como o Ibovespa.",
            href: ROTAS.etfs,
            atalhos: {
              titulo: "ETFs da lista",
              itens: ETFS_INICIAIS.map((e) => ({
                rotulo: e.ticker,
                descricao: e.nome,
                href: `${ROTAS.etfs}/${e.ticker}`,
              })),
            },
          },
        ],
      },
      {
        titulo: "Índices",
        itens: [
          {
            rotulo: "Ver os índices",
            descricao: "Selic, IPCA, CDI, Ibovespa, IFIX e outros três, com gráfico.",
            href: ROTAS.indices,
          },
        ],
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
      { rotulo: "Artigos", href: ROTAS.aprender },
      { rotulo: "Glossário", href: ROTAS.glossario },
      { rotulo: "Indicadores explicados", href: ROTAS.indicadoresExplicados },
      { rotulo: "Como o site calcula", href: ROTAS.comoCalculamos },
      { rotulo: "Desafio do aporte", href: ROTAS.desafio },
    ],
  },
  {
    titulo: "Ativos",
    links: [
      { rotulo: "Ações", href: ROTAS.acoes },
      { rotulo: "Fundos imobiliários", href: ROTAS.fiis },
      { rotulo: "Índices", href: ROTAS.indices },
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

/** Para onde vai quem entrou sem ter pedido página nenhuma, ou pediu uma que não passa na regra abaixo. */
const DESTINO_PADRAO = ROTAS.dashboard;
/** Bem acima de qualquer caminho real do app; o resto é lixo ou tentativa de estouro. */
const TAMANHO_MAXIMO_DO_NEXT = 2048;
/** Origem fictícia só para o `URL` normalizar o caminho; nunca sai daqui. */
const ORIGEM_DE_TESTE = "http://portfoliolab.invalid";
const CARACTERE_DE_CONTROLE = /[\u0000-\u001f\u007f]/;

/**
 * Caminho absoluto da própria origem: uma barra só no começo, seguida de algo
 * que não seja outra barra nem contrabarra. Contrabarra em lugar nenhum (o
 * navegador a trata como "/", então "/\evil.com" vira "//evil.com"), e nenhum
 * caractere de controle (o navegador APAGA tab e quebra de linha da URL antes de
 * interpretá-la: "/\t/evil.com" vira "//evil.com").
 */
function ehCaminhoDaOrigem(texto: string): boolean {
  return /^\/[^/\\]/.test(texto) && !texto.includes("\\") && !CARACTERE_DE_CONTROLE.test(texto);
}

/**
 * Para onde mandar o visitante depois de entrar ou criar a conta, a partir do
 * `?next=` da URL. O `next` vem da barra de endereço (o proxy o monta a partir
 * do caminho pedido, mas qualquer um pode escrever `/login?next=...` num link),
 * então é entrada hostil: sem esta regra, o login vira um redirecionador aberto
 * para phishing ("entre no PortfolioLab" e cair em outro site).
 *
 * Aceita só caminho da mesma origem, e devolve a forma NORMALIZADA pelo `URL`
 * (`pathname + search + hash`), nunca o texto cru:
 *  1. até 2048 caracteres;
 *  2. `ehCaminhoDaOrigem` no texto cru e em cada camada de decodificação de
 *     porcentagem (até três): "/%2f/evil.com" e "/%09/evil.com" caem aqui,
 *     caso algum salto entre o navegador e o app decodifique antes. Porcentagem
 *     malformada também é recusada;
 *  3. resolvido contra uma origem fictícia, o `URL` não pode mudar de origem, e
 *     o caminho JÁ NORMALIZADO passa de novo por `ehCaminhoDaOrigem`. É isto que
 *     barra "/..//evil.com", "/a/..//evil.com" e "/%2e%2e//evil.com": o texto cru
 *     começa com uma barra só, mas os segmentos de ponto se resolvem e sobra
 *     "//evil.com". Devolver o cru seria perigoso: o router do Next normaliza do
 *     mesmo jeito e, na navegação de página inteira, faz `location.assign` desse
 *     "//evil.com", que o navegador lê como endereço de outro host. Vale para o
 *     cru e para a última camada decodificada;
 *  4. o caminho normalizado ("/./login", "/a/../login", "/%6cogin") não pode
 *     começar por /login nem /registro (voltar para a tela de entrada só
 *     confunde), nem ser "/" (a página inicial é pública; quem entra quer a carteira).
 *
 * Para entrada legítima a normalização não muda nada ("/carteira?aba=2",
 * "/dashboard?x=1#frag", "%20" ficam iguais byte a byte); só resolve "." e ".."
 * e codifica o que o próprio navegador codificaria (espaço cru vira "%20").
 *
 * Qualquer outra coisa — esquema (`https:`, `javascript:`), `//`, `/\`,
 * caminho relativo, vazio, null — vira /dashboard.
 */
export function destinoDepoisDoLogin(next: string | null): string {
  return destinoValido(next) ?? DESTINO_PADRAO;
}

/** O destino normalizado, ou null se `next` não passar na regra de `destinoDepoisDoLogin`. */
function destinoValido(next: string | null): string | null {
  if (!next || next.length > TAMANHO_MAXIMO_DO_NEXT) return null;

  let camada = next;
  for (let i = 0; ; i++) {
    if (!ehCaminhoDaOrigem(camada)) return null;
    let decodificado: string;
    try {
      decodificado = decodeURIComponent(camada);
    } catch {
      return null;
    }
    if (decodificado === camada) break;
    // codificado em mais de três camadas não é navegação, é tentativa de despiste
    if (i === 3) return null;
    camada = decodificado;
  }

  let cru: URL;
  let decodificado: URL;
  try {
    cru = new URL(next, ORIGEM_DE_TESTE);
    decodificado = new URL(camada, ORIGEM_DE_TESTE);
  } catch {
    return null;
  }

  for (const url of [cru, decodificado]) {
    if (url.origin !== ORIGEM_DE_TESTE) return null;
    const caminho = url.pathname;
    // ehCaminhoDaOrigem também recusa "/" (nada depois da barra) e "//..."
    if (!ehCaminhoDaOrigem(caminho)) return null;
    if (caminho.startsWith(ROTAS.login) || caminho.startsWith(ROTAS.registro)) return null;
  }

  return cru.pathname + cru.search + cru.hash;
}

/**
 * Acrescenta o `next` a um endereço de login ou cadastro, já normalizado, só se
 * ele passar em `destinoDepoisDoLogin`; senão devolve a rota como veio. Serve
 * aos links entre login e cadastro e à queda de sessão em lib/api.ts:
 *   comNext("/registro", "/simulacao")          → "/registro?next=%2Fsimulacao"
 *   comNext("/login?expirada=1", "/carteira")   → "/login?expirada=1&next=%2Fcarteira"
 *   comNext("/registro", "/a/../simulacao")     → "/registro?next=%2Fsimulacao"
 *   comNext("/registro", "//evil.com")          → "/registro"
 */
export function comNext(rota: string, next: string | null): string {
  const destino = destinoValido(next);
  if (destino === null) return rota;
  return `${rota}${rota.includes("?") ? "&" : "?"}next=${encodeURIComponent(destino)}`;
}
