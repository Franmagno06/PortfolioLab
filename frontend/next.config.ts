import type { NextConfig } from "next";

// Endereço do backend. Em produção, defina API_URL nas variáveis de
// ambiente da plataforma (ex: https://portfoliolab-api.onrender.com).
const API_URL = process.env.API_URL ?? "http://localhost:3333";

const nextConfig: NextConfig = {
  experimental: {
    // O proxy dos rewrites corta a requisição em 30s por padrão e devolve
    // "socket hang up". A análise de relatório passa disso: a IA sozinha tem
    // teto de 240s (backend/src/modules/reports/gemini.ts:TIMEOUT_MS), e um
    // 429 da API já consome ~29s nas tentativas. 300s cobre a IA mais o
    // download da CVM.
    proxyTimeout: 300_000,
    // O padrão é 10 MB, mas o backend aceita PDF de até 25 MB
    // (reports.routes.ts). O multipart soma alguns bytes ao arquivo.
    proxyClientMaxBodySize: 26 * 1024 * 1024,
  },
  // Proxy: o navegador chama /api/... no próprio site e o Next repassa
  // para o backend. Vantagens: sem CORS e, como tudo fica na mesma origem,
  // o cookie de sessão continua funcionando com SameSite=Strict.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
