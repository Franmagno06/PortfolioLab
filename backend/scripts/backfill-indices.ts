/**
 * Preenche o histórico diário de IFIX, SMLL e IDIV (endpoint público da B3, de 2011 até hoje) e aquece as
 * demais séries. Só acrescenta: o que já está em index_points fica como está.
 *
 * A API já faz isso sozinha ao subir (o histórico entra em segundo plano). O script serve para preencher
 * antes, esperando até o fim, e para conferir o resultado.
 *
 *   npm run indices:backfill        banco do .env (Docker local)
 *
 * Contra o Supabase de produção, só com o pedido de quem é dono do banco, trocando o arquivo de ambiente:
 *   npx tsx --env-file=.env.supabase scripts/backfill-indices.ts
 */
import "dotenv/config";
import { descreverBanco } from "../src/config/dbGuard.js";
import { desconectarBanco } from "../src/database/prisma.js";
import { indicesService } from "../src/modules/indices/indices.service.js";

async function main() {
  console.log(`Banco de destino: ${descreverBanco(process.env.DATABASE_URL)}`);

  console.log("\nHistórico da B3 (16 chamadas por índice, pode levar um minuto)...");
  const gravados = await indicesService.preencherHistoricoDaB3();

  console.log("Aquecendo as demais séries (Banco Central e Yahoo)...");
  const dados = await indicesService.montarDados();

  console.log("\nPontos por série:");
  console.log(`  Selic mensal:    ${dados.selicMensal.length}`);
  console.log(`  IPCA mensal:     ${dados.ipcaMensal.length}`);
  console.log(`  CDI mensal:      ${dados.cdiMensal.length}`);
  console.log(`  CDI taxa mensal: ${dados.cdiTaxaMensal.length}`);
  console.log(`  Ibovespa:        ${dados.pontos.ibovespa.length}`);
  console.log(`  S&P 500:         ${dados.pontos.sp500.length}`);
  for (const slug of ["ifix", "smll", "idiv"] as const) {
    const primeiro = dados.pontos[slug][0]?.data ?? "sem pontos";
    console.log(`  ${slug.toUpperCase()}:            ${gravados[slug]} no banco, desde ${primeiro}`);
  }

  const semHistorico = (["ifix", "smll", "idiv"] as const).filter((s) => !(dados.pontos[s][0]?.data ?? "9").startsWith("2011"));
  if (semHistorico.length > 0) {
    console.error(`\nSem histórico desde 2011: ${semHistorico.join(", ")}. A B3 não respondeu ou o banco recusou a gravação.`);
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (err) {
  console.error("Falha no backfill de índices:", err);
  process.exitCode = 1;
} finally {
  await desconectarBanco();
}
