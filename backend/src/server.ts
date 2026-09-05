import { app } from "./app.js";
import { env } from "./config/env.js";
import { desconectarBanco } from "./database/prisma.js";

const servidor = app.listen(env.PORT, () => {
  console.log(`🚀 API rodando em http://localhost:${env.PORT}`);
});

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
