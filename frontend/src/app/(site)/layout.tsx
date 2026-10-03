// Site público: as fontes e a cor da barra do navegador vêm do layout raiz,
// que vale para o site inteiro desde que a área logada adotou a v2. Aqui fica
// só o fundo: a página inicial é papel branco, e não o caderno da área logada.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-card text-ink">{children}</div>;
}
