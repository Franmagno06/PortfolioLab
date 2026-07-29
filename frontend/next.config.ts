import type { NextConfig } from "next";

// Endereço do backend. Em produção, defina API_URL nas variáveis de
// ambiente da plataforma (ex: https://portfoliolab-api.onrender.com).
const API_URL = process.env.API_URL ?? "http://localhost:3333";

const nextConfig: NextConfig = {
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
