import type { Viewport } from "next";
import { Literata, Public_Sans } from "next/font/google";

// Fontes só do site público. A área logada continua com Space Grotesk e
// JetBrains Mono, do layout raiz: as variáveis abaixo existem só nesta árvore,
// e as classes font-leitura e font-interface (globals.css) dependem delas.
//
// Literata: serifa feita para leitura longa em tela — títulos, texto corrido e
// as anotações em itálico. Public Sans: interface, tabelas e números.
// As duas são fontes variáveis: o peso não precisa ser listado, o itálico sim.
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

// O topo do site é tinta: no celular, a barra do navegador continua a página.
export const viewport: Viewport = {
  themeColor: "#0e1b33",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${literata.variable} ${publicSans.variable} font-interface bg-card text-ink`}>
      {children}
    </div>
  );
}
