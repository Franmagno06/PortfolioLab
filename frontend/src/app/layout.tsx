import type { Metadata, Viewport } from "next";
import { Literata, Public_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Tipografia da v2, no site inteiro — página inicial, área logada e login:
// - Literata: títulos, texto corrido e as anotações em itálico. Serifa feita
//   para leitura longa em tela.
// - Public Sans: interface, tabelas e números (com .tnum, algarismos tabulares).
// - Space Grotesk: só o logotipo (Wordmark, via font-sans).
// As três são fontes variáveis: o peso não precisa ser listado, o itálico sim.
const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PortfolioLab",
  description:
    "Plataforma educacional de acompanhamento, simulação e análise de carteira de investimentos",
};

// Todas as telas começam pelo cabeçalho tinta (site e área logada) ou pelo
// fundo tinta (login): no celular, a barra do navegador continua a página.
export const viewport: Viewport = {
  themeColor: "#0e1b33",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${grotesk.variable} ${literata.variable} ${publicSans.variable} h-full antialiased`}
    >
      <body className="min-h-screen font-interface">{children}</body>
    </html>
  );
}
