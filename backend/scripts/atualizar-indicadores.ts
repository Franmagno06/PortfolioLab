// Job de aquecimento em massa: recalcula os indicadores fundamentalistas de
// TODA ação do catálogo, mesmo as que nenhuma carteira aberta recentemente
// tocou. Opcional — desde que indicators.service.ts ganhou refresh
// preguiçoso (busca sozinho o que está ausente ou vencido há mais de 24h,
// a cada GET /indicators), o cache se mantém atualizado sem este script.
// Roda a mesma lógica (indicatorsService.atualizarIndicador), então não há
// dois caminhos de cálculo para o mesmo dado divergirem com o tempo.
//
// Use para aquecer o cache de um catálogo grande de uma vez (ex.: depois de
// popular o banco), ou agendado via cron externo — não há agendador
// embutido no processo da API.
//
// Uso: npm run job:indicadores
import "dotenv/config";
import { desconectarBanco } from "../src/database/prisma.js";
import { atualizarIndicador } from "../src/modules/indicators/indicators.service.js";
import { indicatorsRepository } from "../src/modules/indicators/indicators.repository.js";

// Sequencial, não Promise.all: o Yahoo bloqueia rajada de requisições do
// mesmo IP sem chave, e um catálogo de ações não costuma ter milhares de
// linhas — a espera total fica em segundos, não minutos.
async function main() {
  const acoes = await indicatorsRepository.findAllAcao();
  console.log(`${acoes.length} ações no catálogo. Buscando indicadores...`);

  let atualizados = 0;
  let semDados = 0;

  for (const acao of acoes) {
    const resultado = await atualizarIndicador(acao);
    if (resultado) {
      atualizados++;
    } else {
      semDados++;
      console.log(`  ${acao.ticker}: provedor não respondeu, mantém cache anterior`);
    }
  }

  console.log(`\n${atualizados} atualizados, ${semDados} sem resposta do provedor.`);
}

try {
  await main();
} catch (err) {
  console.error("Falha ao atualizar indicadores:", err);
  process.exitCode = 1;
} finally {
  await desconectarBanco();
}
