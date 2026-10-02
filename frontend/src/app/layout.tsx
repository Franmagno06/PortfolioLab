import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Space Grotesk: geométrica com personalidade — títulos e interface.
// JetBrains Mono: números tabulares — valores financeiros alinhados.
const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

const jet = JetBrains_Mono({
  variable: "--font-jet",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "PortfolioLab",
  description:
    "Plataforma educacional de acompanhamento, simulação e análise de carteira de investimentos",
};

// Mesma cor do body: no mobile a barra do navegador encosta no fundo da página
// em vez de cortar a tela com uma faixa de outra cor.
export const viewport: Viewport = {
  themeColor: "#f4f4ef",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${grotesk.variable} ${jet.variable} h-full antialiased`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
