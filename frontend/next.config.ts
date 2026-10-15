import createMDX from "@next/mdx";
import type { NextConfig } from "next";

// Endereço do backend. Em produção, defina API_URL nas variáveis de
// ambiente da plataforma (ex: https://portfoliolab-api.onrender.com).
const API_URL = process.env.API_URL ?? "http://localhost:3333";

// Só o E2E das páginas de ativos define estas variáveis (playwright.ativos.config.ts): sobe um segundo
// `next dev` ao lado do que a pessoa já usa, e os dois não podem dividir a pasta .next nem o tsconfig.
const DIST_DIR_DO_E2E = process.env.NEXT_DIST_DIR;

const nextConfig: NextConfig = {
  ...(DIST_DIR_DO_E2E && { distDir: DIST_DIR_DO_E2E, typescript: { tsconfigPath: "tsconfig.e2e.json" } }),
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
  // Cabeçalhos de segurança que não mudam entre requisições. O
  // Content-Security-Policy NÃO está aqui: ele usa nonce, que precisa ser
  // sorteado a cada requisição, e por isso vive em src/proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Um ano, subdomínios incluídos: depois da primeira visita o
          // navegador se recusa a falar HTTP com este host.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Impede o navegador de "adivinhar" um tipo diferente do declarado.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // frame-ancestors do CSP já cobre isto nos navegadores atuais; fica
          // pelos antigos, que entendem só este cabeçalho.
          { key: "X-Frame-Options", value: "DENY" },
          // Não vaza o caminho interno que o usuário estava vendo para sites
          // de terceiros — os links das notícias saem para fora.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Esta aplicação não usa nenhuma dessas APIs; desligá-las remove a
          // possibilidade de um script injetado pedir acesso.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
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

// Os artigos de /aprender são .mdx em src/content/aprender/artigos e entram por import dinâmico,
// não como rotas. O frontmatter YAML é lido à parte (lib/aprender/artigos.ts); o plugin só o
// descarta do HTML; o remark-gfm traz as tabelas. Plugins por NOME (string), porque o Turbopack não aceita função aqui.
const withMDX = createMDX({
  options: { remarkPlugins: ["remark-frontmatter", "remark-gfm"] },
});

export default withMDX(nextConfig);
