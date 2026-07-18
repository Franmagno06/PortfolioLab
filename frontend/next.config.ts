import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy: o navegador chama /api/... no próprio site (localhost:3000)
  // e o Next repassa para o backend (localhost:3333).
  // Vantagens: sem CORS e o cookie de sessão funciona naturalmente.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3333/:path*",
      },
    ];
  },
};

export default nextConfig;
