/**
 * Recorte de relatório por relevância à pergunta.
 *
 * O chat mandava o documento inteiro no contexto a cada turno. Para o release
 * trimestral do Banco do Brasil isso são 760 mil caracteres — cerca de 217 mil
 * tokens POR PERGUNTA. Além de lento e caro, estoura o limite de tokens por
 * minuto da API: a segunda pergunta seguida já voltava com "limite de uso
 * atingido".
 *
 * Aqui o documento é quebrado em blocos, cada bloco recebe uma nota pela
 * sobreposição com os termos da pergunta, e só os melhores viajam. É busca
 * léxica simples, sem embeddings nem banco vetorial — o suficiente para
 * relatório financeiro, onde a pergunta costuma repetir a palavra exata que
 * aparece no documento ("vacância", "inadimplência", "Basileia").
 */

// Palavras que casariam com qualquer bloco e por isso não ajudam a escolher.
const VAZIAS = new Set([
  "qual", "quais", "quanto", "quantos", "como", "onde", "quando", "porque",
  "por", "que", "para", "com", "sem", "dos", "das", "nos", "nas", "uma", "uns",
  "the", "and", "foi", "sao", "esta", "esse", "essa", "isso", "aquele",
  "sobre", "seu", "sua", "mais", "menos", "muito", "pouco", "tem", "ter",
  "documento", "relatorio", "fundo", "empresa", "periodo", "trimestre",
]);

/** Sem acento e sem caixa, para "vacância" casar com "VACANCIA". */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Termos da pergunta que valem para pontuar: longos e não banais. */
function termosDaPergunta(pergunta: string): string[] {
  return [
    ...new Set(
      normalizar(pergunta)
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 4 && !VAZIAS.has(t)),
    ),
  ];
}

/**
 * Divide o texto em blocos de tamanho parecido. Parágrafos são a unidade
 * natural, mas relatório em PDF costuma trazer parágrafos gigantes ou linhas
 * soltas de tabela — por isso blocos grandes demais são cortados e blocos
 * pequenos, agrupados.
 */
function emBlocos(texto: string, tamanho: number): string[] {
  const blocos: string[] = [];
  let atual = "";

  for (const paragrafo of texto.split(/\n\s*\n/)) {
    if (paragrafo.length > tamanho) {
      if (atual) {
        blocos.push(atual);
        atual = "";
      }
      for (let i = 0; i < paragrafo.length; i += tamanho) {
        blocos.push(paragrafo.slice(i, i + tamanho));
      }
      continue;
    }

    if (atual.length + paragrafo.length + 2 > tamanho) {
      blocos.push(atual);
      atual = paragrafo;
    } else {
      atual = atual ? `${atual}\n\n${paragrafo}` : paragrafo;
    }
  }

  if (atual) blocos.push(atual);
  return blocos;
}

/**
 * Escolhe os trechos do relatório que melhor respondem à pergunta, cabendo em
 * `limiteChars`. Se o texto todo já couber, devolve como está — documento
 * pequeno não precisa de recorte.
 *
 * Quando a pergunta não tem nenhum termo útil ("e aí?"), devolve o começo do
 * documento: é onde ficam capa, sumário e destaques do período.
 *
 * Os trechos escolhidos saem na ordem original, para o modelo ler o documento
 * na sequência em que foi escrito.
 */
export function selecionarTrechos(
  texto: string,
  pergunta: string,
  limiteChars: number,
): string {
  if (texto.length <= limiteChars) return texto;

  const TAMANHO_BLOCO = 2000;
  const blocos = emBlocos(texto, TAMANHO_BLOCO);
  const termos = termosDaPergunta(pergunta);

  const notas = blocos.map((bloco, indice) => {
    const alvo = normalizar(bloco);
    // conta as ocorrências de cada termo, não só se apareceu: um bloco que
    // fala cinco vezes em vacância responde melhor do que outro que cita uma
    const nota = termos.reduce((soma, termo) => soma + alvo.split(termo).length - 1, 0);
    return { indice, bloco, nota };
  });

  const relevantes = notas.filter((b) => b.nota > 0);
  // sem termo útil ou sem nenhuma ocorrência: o começo do documento serve mais
  // do que um recorte aleatório do meio
  const candidatos =
    relevantes.length > 0
      ? [...relevantes].sort((a, b) => b.nota - a.nota || a.indice - b.indice)
      : notas;

  const escolhidos: typeof notas = [];
  let usado = 0;
  const SEPARADOR = "\n\n[...]\n\n";

  for (const candidato of candidatos) {
    const custo = candidato.bloco.length + (escolhidos.length > 0 ? SEPARADOR.length : 0);
    if (usado + custo > limiteChars) continue;
    escolhidos.push(candidato);
    usado += custo;
  }

  // nenhum bloco inteiro coube: entrega o começo do melhor, cortado
  if (escolhidos.length === 0) {
    return (candidatos[0]?.bloco ?? texto).slice(0, limiteChars);
  }

  return escolhidos
    .sort((a, b) => a.indice - b.indice)
    .map((b) => b.bloco)
    .join(SEPARADOR);
}

// Vocabulário que denuncia a seção onde o resultado é discutido. Só o radical,
// para pegar as flexões: "margem"/"margens", "distribui"/"distribuição".
const SINAL_FINANCEIRO = [
  "lucro", "prejuizo", "margem", "receita", "despesa", "ebitda", "resultado",
  "inadimplen", "vacancia", "dividendo", "distribui", "alavancagem", "guidance",
  "patrimonio", "rentabilidade", "provisao", "caixa", "endivida", "basileia",
  "rendimento", "cota", "carteira", "trimestre", "crescimento", "queda",
];

/**
 * Recorta um relatório longo para a análise inicial, que não tem pergunta para
 * se guiar — precisa achar sozinha onde está o conteúdo que importa.
 *
 * A nota de cada bloco soma três coisas: quantos termos de resultado aparecem,
 * quantos números com casa decimal ou percentual ele carrega (relatório
 * financeiro conversa em número), e um bônus para os primeiros blocos, onde
 * ficam capa, sumário e destaques do período. Sem esse bônus, a IA receberia
 * tabelas soltas sem saber de quem é o documento nem de que trimestre.
 */
export function selecionarSecoesRelevantes(texto: string, limiteChars: number): string {
  if (texto.length <= limiteChars) return texto;

  const TAMANHO_BLOCO = 2000;
  const blocos = emBlocos(texto, TAMANHO_BLOCO);

  const notas = blocos.map((bloco, indice) => {
    const alvo = normalizar(bloco);

    const termos = SINAL_FINANCEIRO.reduce(
      (soma, termo) => soma + Math.min(alvo.split(termo).length - 1, 5),
      0,
    );
    const numeros = (alvo.match(/\d+[.,]\d+|\d+\s?%/g) ?? []).length;
    // os cinco primeiros blocos são a abertura do documento
    const bonusAbertura = indice < 5 ? 20 - indice * 3 : 0;

    return { indice, bloco, nota: termos * 2 + numeros + bonusAbertura };
  });

  const escolhidos: typeof notas = [];
  let usado = 0;
  const SEPARADOR = "\n\n[...]\n\n";

  for (const candidato of [...notas].sort((a, b) => b.nota - a.nota || a.indice - b.indice)) {
    const custo = candidato.bloco.length + (escolhidos.length > 0 ? SEPARADOR.length : 0);
    if (usado + custo > limiteChars) continue;
    escolhidos.push(candidato);
    usado += custo;
  }

  if (escolhidos.length === 0) return texto.slice(0, limiteChars);

  return escolhidos
    .sort((a, b) => a.indice - b.indice)
    .map((b) => b.bloco)
    .join(SEPARADOR);
}
