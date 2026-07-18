import type { Metadata } from "next";
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
