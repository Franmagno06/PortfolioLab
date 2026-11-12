import { app } from "./app.js";
import { descreverBanco } from "./config/dbGuard.js";
import { env } from "./config/env.js";
import { desconectarBanco } from "./database/prisma.js";
import { ativosService } from "./modules/ativos/ativos.service.js";
import { indicesService } from "./modules/indices/indices.service.js";

const servidor = app.listen(env.PORT, () => {
  console.log(`🚀 API rodando em http://localhost:${env.PORT}`);
  // Dois bancos no projeto (Docker e Supabase): o log deixa à vista qual está em uso.
  console.log(`🗄️  Banco: ${descreverBanco(env.DATABASE_URL)}`);
});

// Páginas públicas de Ativos: põe o catálogo na fila de renovação, um ativo por vez, sem segurar a
// subida. Só em produção: em desenvolvimento cada reinício do tsx watch refaria dezenas de consultas
// ao Yahoo. A renovação preguiçosa por visita continua valendo em qualquer ambiente.
// AQUECER_CATALOGO=false desliga: no Render gratuito, cada acordar do serviço refaria a fila inteira
// (zips da CVM incluídos) com 0,1 CPU e 512 MB. Ver docs/deploy.md.
if (env.NODE_ENV === "production" && env.AQUECER_CATALOGO) {
  ativosService.aquecerCatalogo();
}

// Séries de índices: o primeiro visitante não paga o SGS lento (cada série tem janelas de 5 anos)
// nem o backfill histórico da B3 em ambiente de desenvolvimento ou produção.
// AQUECER_CATALOGO=false também desliga este: no Render gratuito (0,1 CPU) o aquecimento (Yahoo, SGS e
// backfill da B3) estourava os 5 s do health check logo após a subida, e o Render reiniciava o serviço.
// A leitura continua preguiçosa: o primeiro GET /indices/dados monta e guarda a série.
if (env.NODE_ENV !== "test" && env.AQUECER_CATALOGO) {
  void indicesService.aquecer();
}

// Achado 24: o Render manda SIGTERM e espera antes de matar o processo. Sem
// tratar o sinal, a API morria no meio das requisições em voo e deixava o pool
// do Prisma aberto. Aqui o servidor para de aceitar conexões novas, termina as
// que já começaram e só então fecha o banco.
async function desligar(sinal: string) {
  console.log(`${sinal} recebido — encerrando`);
  servidor.close(async (erro) => {
    if (erro) console.error("Erro ao fechar o servidor HTTP:", erro);
    await desconectarBanco();
    process.exit(erro ? 1 : 0);
  });
}

process.on("SIGTERM", () => void desligar("SIGTERM"));
process.on("SIGINT", () => void desligar("SIGINT"));
