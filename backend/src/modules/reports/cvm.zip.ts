import { unzipSync } from "fflate";

/**
 * A parte da leitura da CVM que é CPU pura: descompactar o zip e achar as linhas de um CNPJ. Roda no
 * worker (`cvm.worker.ts`, via `cvm.trabalhador.ts`) para não segurar o laço de eventos; fica num
 * arquivo à parte, sem Prisma nem rede, para o worker carregar só isto.
 */

/**
 * Teto do tamanho descompactado de um CSV, como o zip o declara. O maior que o app lê (BPP
 * individual do ITR de um ano inteiro) tinha 93 MB em 2025. Um arquivo acima disso é ignorado sem
 * ser descompactado: o fflate aloca de uma vez o tamanho declarado.
 */
const MAX_CSV_DESCOMPACTADO = 256 * 1024 * 1024;

// Sem estado entre chamadas: decode() sem { stream: true } recomeça do zero.
const LATIN1 = new TextDecoder("latin1");

/**
 * Extrai do zip só os CSVs pedidos, já decodificados. Os arquivos da CVM são
 * ISO-8859-1; ler como UTF-8 estraga todo "Patrimônio" e "Prejuízo".
 *
 * Com `cnpj`, decodifica só o cabeçalho e as linhas que contêm o CNPJ, achadas nos
 * bytes: virar texto o CSV inteiro (o BPP do ITR passa de 40 MB) levava o processo a
 * mais de 1,5 GB. O resultado é um CSV menor no mesmo formato, e `linhasComCnpj` acha
 * nele as mesmas linhas que acharia no arquivo inteiro: cada caractere latin1 é um
 * byte, e o CNPJ é ASCII. Os arquivos são descompactados um de cada vez, para só um
 * deles estar em memória.
 */
export function lerCsvsDoZip(
  zip: Uint8Array,
  nomes: string[],
  cnpj?: string,
  /** Chamado depois de cada arquivo, quando o descompactado já é lixo (o worker coleta ali). */
  depoisDeCadaArquivo?: () => void,
): Map<string, string> {
  const csvs = new Map<string, string>();
  for (const nome of nomes) {
    const lido = lerUm(zip, nome, cnpj);
    if (lido !== null) csvs.set(nome, lido);
    depoisDeCadaArquivo?.();
  }
  return csvs;
}

/** Um arquivo do zip; à parte para o descompactado (até 93 MB) sair de escopo antes da coleta. */
function lerUm(zip: Uint8Array, nome: string, cnpj: string | undefined): string | null {
  const bytes = unzipSync(zip, {
    filter: (f) => f.name === nome && f.originalSize <= MAX_CSV_DESCOMPACTADO,
  })[nome];
  if (!bytes) return null;
  return cnpj === undefined ? LATIN1.decode(bytes) : linhasDoCnpjEmBytes(bytes, cnpj);
}

/** O cabeçalho e as linhas que contêm o CNPJ, decodificados e unidos por "\n". */
function linhasDoCnpjEmBytes(bytes: Uint8Array, cnpj: string): string {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fimDoCabecalho = buf.indexOf(0x0a);
  if (fimDoCabecalho < 0) return "";
  const linhas = [LATIN1.decode(bytes.subarray(0, fimDoCabecalho))];
  if (!cnpj) return linhas[0] ?? "";
  const agulha = Buffer.from(cnpj, "latin1");
  let posicao = buf.indexOf(agulha, fimDoCabecalho);
  while (posicao >= 0) {
    const inicio = buf.lastIndexOf(0x0a, posicao) + 1;
    let fim = buf.indexOf(0x0a, posicao);
    if (fim < 0) fim = buf.length;
    linhas.push(LATIN1.decode(bytes.subarray(inicio, fim)));
    posicao = buf.indexOf(agulha, fim);
  }
  return linhas.join("\n");
}

export type PatrimonioDeClasse = { patrimonioLiquido: number; dataReferencia: string };

/**
 * Pura: o patrimônio líquido das classes pedidas, a partir do registro_classe.csv da CVM
 * (separado por ";", com cabeçalho). Linha com patrimônio vazio ou data ausente é ignorada.
 */
export function patrimonioDasClasses(csv: string, cnpjs: string[]): Map<string, PatrimonioDeClasse> {
  const queremos = new Set(cnpjs);
  const saida = new Map<string, PatrimonioDeClasse>();
  const linhas = csv.split("\n");
  const cabecalho = (linhas[0] ?? "").trim().split(";");
  const iCnpj = cabecalho.indexOf("CNPJ_Classe");
  const iPl = cabecalho.indexOf("Patrimonio_Liquido");
  const iData = cabecalho.indexOf("Data_Patrimonio_Liquido");
  if (iCnpj < 0 || iPl < 0 || iData < 0) {
    console.error("[CVM] o cadastro de classes mudou de formato: faltam colunas esperadas");
    return saida;
  }

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha) continue;
    const campos = linha.split(";");
    // um nome com ";" deslocaria as colunas em silêncio: a linha torta é descartada
    if (campos.length !== cabecalho.length) continue;
    const cnpj = campos[iCnpj] ?? "";
    if (!queremos.has(cnpj)) continue;
    const patrimonio = Number(campos[iPl]);
    const data = (campos[iData] ?? "").trim();
    if (!Number.isFinite(patrimonio) || patrimonio <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    saida.set(cnpj, { patrimonioLiquido: patrimonio, dataReferencia: data });
  }
  return saida;
}
