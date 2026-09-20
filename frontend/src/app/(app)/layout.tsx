import { Sidebar, TopbarMobile } from "@/components/sidebar";

// Área logada: coluna fixa a partir de lg, gaveta abaixo disso.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <TopbarMobile />
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
